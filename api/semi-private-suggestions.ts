import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Semi-Private Suggestions API
 *
 * Used during REGISTRATION to show:
 * 1. Times where unpaired players are waiting (suggested times)
 * 2. Times that are blocked by existing private/semi-private bookings
 *
 * This helps new registrants pick times with potential partners.
 */

const AVAILABLE_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const AVAILABLE_TIME_SLOTS = ['8-9', '9-10', '10-11', '11-12', '12-13', '13-14', '14-15'];

// Map display times to slot format
const TIME_DISPLAY_TO_SLOT: { [key: string]: string } = {
  '8:00 AM': '8-9',
  '9:00 AM': '9-10',
  '10:00 AM': '10-11',
  '11:00 AM': '11-12',
  '12:00 PM': '12-13',
  '1:00 PM': '13-14',
  '2:00 PM': '14-15',
  '3:00 PM': '14-15', // 3 PM is end of last slot
};

const SLOT_TO_TIME_DISPLAY: { [key: string]: string } = {
  '8-9': '8:00 AM',
  '9-10': '9:00 AM',
  '10-11': '10:00 AM',
  '11-12': '11:00 AM',
  '12-13': '12:00 PM',
  '13-14': '1:00 PM',
  '14-15': '2:00 PM',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playerCategory, selectedDay } = req.body;

    if (!playerCategory) {
      return res.status(400).json({
        success: false,
        error: 'playerCategory is required'
      });
    }

    // 1. Get unpaired players in the same age category
    const { data: unpairedPlayers, error: unpairedError } = await supabase
      .from('unpaired_semi_private')
      .select('*')
      .eq('age_category', playerCategory)
      .eq('status', 'waiting');

    if (unpairedError) {
      console.error('Error fetching unpaired players:', unpairedError);
    }

    // 2. Get all booked slots (private + semi-private with succeeded/verified payment)
    const { data: bookings, error: bookingsError } = await supabase
      .from('registrations')
      .select('form_data')
      .in('payment_status', ['succeeded', 'verified']);

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
    }

    // Build set of blocked slots
    const blockedSlots = new Set<string>();

    bookings?.forEach(b => {
      const isPrivate = b.form_data?.programType === 'private';
      const isSemiPrivate = b.form_data?.programType === 'semi-private';

      if (isPrivate) {
        const days = b.form_data?.privateSelectedDays || [];
        const time = b.form_data?.privateTimeSlot;
        if (time) {
          days.forEach((day: string) => {
            blockedSlots.add(`${day.toLowerCase()}-${time}`);
          });
        }
      }

      if (isSemiPrivate) {
        const days = b.form_data?.semiPrivateAvailability || [];
        const time = b.form_data?.semiPrivateTimeSlot ||
          (b.form_data?.semiPrivateTimeWindows && b.form_data?.semiPrivateTimeWindows[0]);
        if (time) {
          days.forEach((day: string) => {
            blockedSlots.add(`${day.toLowerCase()}-${time}`);
          });
        }
      }
    });

    // 3. Build suggested times from unpaired players' preferences
    const suggestedTimes: Array<{
      day: string;
      time: string;
      displayTime: string;
      partnerCount: number;
      isBlocked: boolean;
    }> = [];

    // Count how many unpaired players want each day/time combo
    const preferenceCount: { [key: string]: number } = {};

    unpairedPlayers?.forEach(player => {
      const days = player.preferred_days || [];
      const times = player.preferred_time_slots || [];

      days.forEach((day: string) => {
        times.forEach((time: string) => {
          const key = `${day.toLowerCase()}-${time}`;
          preferenceCount[key] = (preferenceCount[key] || 0) + 1;
        });
      });
    });

    // Convert to array and add blocked status
    Object.entries(preferenceCount).forEach(([key, count]) => {
      const [day, time] = key.split('-');
      const slotKey = `${day}-${time}`;
      const isBlocked = blockedSlots.has(slotKey);

      // Only suggest if not blocked
      if (!isBlocked) {
        suggestedTimes.push({
          day,
          time,
          displayTime: SLOT_TO_TIME_DISPLAY[time] || time,
          partnerCount: count,
          isBlocked
        });
      }
    });

    // Sort by partner count (most partners first)
    suggestedTimes.sort((a, b) => b.partnerCount - a.partnerCount);

    // 4. If selectedDay is provided, filter suggestions for that day
    const filteredSuggestions = selectedDay
      ? suggestedTimes.filter(s => s.day === selectedDay.toLowerCase())
      : suggestedTimes;

    // 5. Build list of all blocked times (for UI to gray out)
    const blockedTimes: Array<{ day: string; time: string; displayTime: string }> = [];
    blockedSlots.forEach(slot => {
      const [day, time] = slot.split('-');
      blockedTimes.push({
        day,
        time,
        displayTime: SLOT_TO_TIME_DISPLAY[time] || time
      });
    });

    return res.status(200).json({
      success: true,
      suggestedTimes: filteredSuggestions,
      blockedTimes,
      totalUnpairedPlayers: unpairedPlayers?.length || 0,
      message: unpairedPlayers?.length
        ? `${unpairedPlayers.length} player(s) waiting in ${playerCategory} category`
        : `No players currently waiting in ${playerCategory} category`
    });

  } catch (error) {
    console.error('Error in semi-private-suggestions:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
