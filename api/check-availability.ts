import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized Supabase client to avoid issues with process.env at module load time
let _supabase: SupabaseClient | null = null;

const getSupabase = (): SupabaseClient => {
  if (!_supabase) {
    _supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
};

/**
 * Unified Capacity Manager (Inlined to avoid Vercel bundling issues)
 *
 * CAPACITY LOGIC:
 * 1. Group Training: STATIC fixed times (4:30, 5:45, 7:00, 8:15 PM) available 7 days/week
 *    - Max 6 players per slot
 *    - Only blocks within group program (doesn't conflict with private)
 *
 * 2. Private & Semi-Private: FLEXIBLE times 8 AM-3 PM, available 7 days/week
 *    - Hourly slots: 8-9, 9-10, 10-11, 11-12, 12-1, 1-2, 2-3 AM (7 slots per day)
 *    - Max 1 booking per specific time/day combination
 *    - BLOCKS ACROSS BOTH PROGRAMS: if private booked 9am Mon → semi-private can't book same slot
 */

interface SlotAvailability {
  time: string;
  day: string;
  availableSpots: number;
  totalCapacity: number;
  isFull: boolean;
  programTypes: string[];
}

// Group training: Fixed static times, available 7 days/week
const GROUP_TRAINING_TIMES = ['4:30 PM', '5:45 PM', '7:00 PM', '8:15 PM'];

// Private/Semi-Private: Flexible times 8 AM-3 PM
const PRIVATE_TRAINING_TIMES = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM'];

const GROUP_TRAINING_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const PRIVATE_TRAINING_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MAX_GROUP_CAPACITY = 6;
const MAX_PRIVATE_CAPACITY = 1;

/**
 * Check real-time availability for a specific time slot
 */
const checkSlotAvailability = async (day: string, time: string): Promise<SlotAvailability | null> => {
  try {
    let bookedSpots = 0;
    let maxCapacity = 0;
    const programTypes: string[] = [];

    // GROUP TRAINING POOL
    if (GROUP_TRAINING_DAYS.includes(day.toLowerCase()) && GROUP_TRAINING_TIMES.includes(time)) {
      programTypes.push('group');
      maxCapacity = MAX_GROUP_CAPACITY;

      const { data: groupBookings, error } = await getSupabase()
        .from('registrations')
        .select('form_data')
        .in('payment_status', ['succeeded', 'verified']);

      if (error) {
        console.error('Error checking group availability:', error);
        return null;
      }

      bookedSpots = groupBookings?.filter(b => {
        if (b.form_data?.programType !== 'group') return false;
        const selectedDays = b.form_data?.groupSelectedDays || [];
        return selectedDays.map((d: string) => d.toLowerCase()).includes(day.toLowerCase());
      }).length || 0;
    }

    // PRIVATE/SEMI-PRIVATE POOL
    else if (PRIVATE_TRAINING_DAYS.includes(day.toLowerCase())) {
      programTypes.push('private', 'semi-private');
      maxCapacity = MAX_PRIVATE_CAPACITY;

      const { data: bookings, error } = await getSupabase()
        .from('registrations')
        .select('form_data')
        .in('payment_status', ['succeeded', 'verified']);

      if (error) {
        console.error('Error checking private/semi-private availability:', error);
        return null;
      }

      bookedSpots = bookings?.filter(b => {
        const isPrivate = b.form_data?.programType === 'private';
        const isSemiPrivate = b.form_data?.programType === 'semi-private';

        if (isPrivate) {
          const selectedDays = b.form_data?.privateSelectedDays || [];
          return selectedDays.map((d: string) => d.toLowerCase()).includes(day.toLowerCase()) &&
                 b.form_data?.privateTimeSlot === time;
        }

        if (isSemiPrivate) {
          const availableDays = b.form_data?.semiPrivateAvailability || [];
          return availableDays.map((d: string) => d.toLowerCase()).includes(day.toLowerCase()) &&
                 b.form_data?.semiPrivateTimeSlot === time;
        }

        return false;
      }).length || 0;
    }

    const availableSpots = Math.max(0, maxCapacity - bookedSpots);

    return {
      time,
      day,
      availableSpots,
      totalCapacity: maxCapacity,
      isFull: availableSpots === 0,
      programTypes
    };
  } catch (error) {
    console.error('Error in checkSlotAvailability:', error);
    return null;
  }
};

/**
 * Get availability for all slots on a specific day
 */
const getDayAvailability = async (day: string): Promise<SlotAvailability[]> => {
  const slots: SlotAvailability[] = [];

  if (GROUP_TRAINING_DAYS.includes(day)) {
    for (const time of GROUP_TRAINING_TIMES) {
      const availability = await checkSlotAvailability(day, time);
      if (availability) slots.push(availability);
    }
  }

  if (PRIVATE_TRAINING_DAYS.includes(day)) {
    for (const time of PRIVATE_TRAINING_TIMES) {
      const availability = await checkSlotAvailability(day, time);
      if (availability) slots.push(availability);
    }
  }

  return slots;
};

/**
 * Check if a multi-hour booking is possible
 */
const checkMultiHourAvailability = async (day: string, startTime: string, duration: number): Promise<boolean> => {
  if (duration === 1) {
    const availability = await checkSlotAvailability(day, startTime);
    return availability ? !availability.isFull : false;
  }

  if (duration === 2) {
    const times = PRIVATE_TRAINING_TIMES;
    const startIndex = times.indexOf(startTime);

    if (startIndex === -1 || startIndex >= times.length - 1) {
      return false;
    }

    const endTime = times[startIndex + 1];
    const slot1 = await checkSlotAvailability(day, startTime);
    const slot2 = await checkSlotAvailability(day, endTime);

    return slot1 && slot2 && !slot1.isFull && !slot2.isFull;
  }

  return false;
};

/**
 * Get all available time slots for a specific program type
 */
const getAvailableSlots = async (
  programType: 'group' | 'private' | 'semi-private',
  selectedDays?: string[]
): Promise<SlotAvailability[]> => {
  const availableSlots: SlotAvailability[] = [];

  if (programType === 'group') {
    for (const day of GROUP_TRAINING_DAYS) {
      if (!selectedDays || selectedDays.includes(day)) {
        const daySlots = await getDayAvailability(day);
        availableSlots.push(...daySlots.filter(s => s.programTypes.includes('group')));
      }
    }
  } else {
    for (const day of PRIVATE_TRAINING_DAYS) {
      if (!selectedDays || selectedDays.includes(day)) {
        const daySlots = await getDayAvailability(day);
        availableSlots.push(...daySlots.filter(s =>
          s.programTypes.includes('private') || s.programTypes.includes('semi-private')
        ));
      }
    }
  }

  return availableSlots;
};

// ================== API HANDLER ==================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, day, time, programType, selectedDays, duration } = req.method === 'GET' ? req.query : req.body;

    // Check specific slot availability
    if (action === 'checkSlot' && day && time) {
      const availability = await checkSlotAvailability(day as string, time as string);
      return res.status(200).json({ success: true, availability });
    }

    // Check day availability (all slots for a day)
    if (action === 'checkDay' && day) {
      const slots = await getDayAvailability(day as string);
      return res.status(200).json({ success: true, slots });
    }

    // Get all available slots for a program type
    if (action === 'getSlots' && programType) {
      const days = selectedDays ? (typeof selectedDays === 'string' ? [selectedDays] : selectedDays) : undefined;
      const slots = await getAvailableSlots(programType as any, days as string[]);
      return res.status(200).json({ success: true, slots });
    }

    // Check multi-hour availability
    if (action === 'checkMultiHour' && day && time && duration) {
      const available = await checkMultiHourAvailability(
        day as string,
        time as string,
        parseInt(duration as string)
      );
      return res.status(200).json({ success: true, available });
    }

    return res.status(400).json({
      error: 'Invalid request. Provide action, day, time, programType, or duration as needed.'
    });
  } catch (error: any) {
    console.error('Availability check error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to check availability'
    });
  }
}
