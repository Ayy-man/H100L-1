import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized Supabase client
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
 * Availability Check API
 *
 * NEW (Credit System - BookSessionModal):
 *   GET /api/check-availability?date=2025-01-15&session_type=group
 *   Returns available time slots for booking on that specific date
 *   Checks session_bookings table for actual bookings
 *
 * LEGACY (Registration Form - FormStep2):
 *   POST with action=getSlots&programType=group&selectedDays=[...]
 *   Returns slot availability for registration day selection
 *   Checks registrations table for scheduled days
 */

// Time slots by age category (must match lib/timeSlots.ts)
// Format: 'display time' => [applicable categories]
const GROUP_SLOTS_BY_CATEGORY: Record<string, string[]> = {
  '4:30 PM': ['M7', 'M9', 'M11'],           // 4:30-5:30 PM slot
  '5:45 PM': ['M13', 'M13 Elite'],          // 5:45-6:45 PM slot
  '7:00 PM': ['M15', 'M15 Elite'],          // 7:00-8:00 PM slot
  '8:15 PM': ['M18', 'Junior'],             // 8:15-9:15 PM slot
};

const SUNDAY_SLOTS_BY_CATEGORY: Record<string, string[]> = {
  '7:30 AM': ['M7', 'M9', 'M11'],           // 7:30-8:30 AM slot
  '8:30 AM': ['M13', 'M13 Elite', 'M15', 'M15 Elite'], // 8:30-9:30 AM slot
  // M18, Junior not eligible for Sunday ice
};

// All time slots (for reference)
const ALL_GROUP_TIMES = ['4:30 PM', '5:45 PM', '7:00 PM', '8:15 PM'];
const ALL_SUNDAY_TIMES = ['7:30 AM', '8:30 AM'];
const PRIVATE_TRAINING_TIMES = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'];

// Legacy times (for registration form compatibility)
const LEGACY_GROUP_TIMES = ['4:30 PM', '5:45 PM', '7:00 PM', '8:15 PM'];

// Capacity limits
const MAX_GROUP_CAPACITY = 6;
const MAX_SUNDAY_CAPACITY = 15;
const MAX_PRIVATE_CAPACITY = 1;
const MAX_SEMI_PRIVATE_CAPACITY = 3;

interface TimeSlotOption {
  time: string;
  available: boolean;
  currentBookings: number;
  maxCapacity: number;
}

// ================== NEW CREDIT SYSTEM FUNCTIONS ==================

/**
 * Get player category from registration_id
 */
async function getPlayerCategory(registrationId: string): Promise<string | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('registrations')
    .select('form_data')
    .eq('id', registrationId)
    .single();

  if (error || !data) {
    console.error('Error fetching player category:', error);
    return null;
  }

  return data.form_data?.playerCategory || null;
}

/**
 * Get allowed time slots for a player category and session type
 */
function getAllowedSlotsForCategory(
  category: string | null,
  sessionType: string
): string[] {
  // Private and semi-private have no category restrictions
  if (sessionType === 'private' || sessionType === 'semi_private') {
    return PRIVATE_TRAINING_TIMES;
  }

  // If no category, return empty (shouldn't happen)
  if (!category) {
    return [];
  }

  if (sessionType === 'sunday') {
    // Find Sunday slots that include this category
    return Object.entries(SUNDAY_SLOTS_BY_CATEGORY)
      .filter(([_, categories]) => categories.includes(category))
      .map(([time]) => time);
  }

  // Group training - find slots for this category
  return Object.entries(GROUP_SLOTS_BY_CATEGORY)
    .filter(([_, categories]) => categories.includes(category))
    .map(([time]) => time);
}

/**
 * NEW: Check availability for a specific date and session type
 * Used by BookSessionModal in the credit system
 * Checks session_bookings table for actual bookings
 * Filters slots by player category when registration_id is provided
 */
async function checkDateAvailability(
  date: string,
  sessionType: string,
  registrationId?: string
): Promise<TimeSlotOption[]> {
  const supabase = getSupabase();
  const slots: TimeSlotOption[] = [];

  // Get player category if registration_id provided
  let playerCategory: string | null = null;
  if (registrationId) {
    playerCategory = await getPlayerCategory(registrationId);
  }

  // Determine time slots and capacity based on session type
  let timeSlots: string[];
  let maxCapacity: number;

  switch (sessionType) {
    case 'group':
      // Filter by player category
      timeSlots = registrationId
        ? getAllowedSlotsForCategory(playerCategory, 'group')
        : ALL_GROUP_TIMES;
      maxCapacity = MAX_GROUP_CAPACITY;
      break;
    case 'sunday':
      // Filter by player category (M18/Junior not eligible)
      timeSlots = registrationId
        ? getAllowedSlotsForCategory(playerCategory, 'sunday')
        : ALL_SUNDAY_TIMES;
      maxCapacity = MAX_SUNDAY_CAPACITY;
      break;
    case 'private':
      timeSlots = PRIVATE_TRAINING_TIMES;
      maxCapacity = MAX_PRIVATE_CAPACITY;
      break;
    case 'semi_private':
      timeSlots = PRIVATE_TRAINING_TIMES;
      maxCapacity = MAX_SEMI_PRIVATE_CAPACITY;
      break;
    default:
      timeSlots = registrationId
        ? getAllowedSlotsForCategory(playerCategory, 'group')
        : ALL_GROUP_TIMES;
      maxCapacity = MAX_GROUP_CAPACITY;
  }

  // Check day of week to filter appropriately
  const dayOfWeek = new Date(date + 'T00:00:00').getDay();
  const isSunday = dayOfWeek === 0;

  // Sunday ice only available on Sundays
  if (sessionType === 'sunday' && !isSunday) {
    return [];
  }

  // Group training not available on Sundays (use Sunday Ice instead)
  if (sessionType === 'group' && isSunday) {
    return [];
  }

  // If no valid slots for this category, return empty
  if (timeSlots.length === 0) {
    return [];
  }

  // Get current bookings for this date and session type from session_bookings table
  const { data: bookings, error } = await supabase
    .from('session_bookings')
    .select('time_slot')
    .eq('session_date', date)
    .eq('session_type', sessionType)
    .neq('status', 'cancelled');

  if (error) {
    console.error('Error checking bookings:', error);
    // Return slots as available if we can't check (fail open for UX)
    return timeSlots.map(time => ({
      time,
      available: true,
      currentBookings: 0,
      maxCapacity,
    }));
  }

  // Count bookings per time slot
  const bookingCounts: Record<string, number> = {};
  (bookings || []).forEach((booking) => {
    const time = booking.time_slot;
    bookingCounts[time] = (bookingCounts[time] || 0) + 1;
  });

  // Build slot availability list
  for (const time of timeSlots) {
    const currentBookings = bookingCounts[time] || 0;
    const available = currentBookings < maxCapacity;

    slots.push({
      time,
      available,
      currentBookings,
      maxCapacity,
    });
  }

  return slots;
}

// ================== LEGACY FUNCTIONS (for registration form) ==================

interface SlotAvailability {
  time: string;
  day: string;
  availableSpots: number;
  totalCapacity: number;
  isFull: boolean;
  programTypes: string[];
}

const GROUP_TRAINING_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const PRIVATE_TRAINING_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * LEGACY: Check slot availability for registration form
 * Checks registrations table for scheduled days
 */
const checkSlotAvailability = async (day: string, time: string): Promise<SlotAvailability | null> => {
  try {
    let bookedSpots = 0;
    let maxCapacity = 0;
    const programTypes: string[] = [];

    // GROUP TRAINING POOL
    if (GROUP_TRAINING_DAYS.includes(day.toLowerCase()) && LEGACY_GROUP_TIMES.includes(time)) {
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
    else if (PRIVATE_TRAINING_DAYS.includes(day.toLowerCase()) && PRIVATE_TRAINING_TIMES.includes(time)) {
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

    if (maxCapacity === 0) {
      return null;
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
 * LEGACY: Get availability for all slots on a specific day
 */
const getDayAvailability = async (day: string): Promise<SlotAvailability[]> => {
  const slots: SlotAvailability[] = [];

  if (GROUP_TRAINING_DAYS.includes(day.toLowerCase())) {
    for (const time of LEGACY_GROUP_TIMES) {
      const availability = await checkSlotAvailability(day, time);
      if (availability) slots.push(availability);
    }
  }

  if (PRIVATE_TRAINING_DAYS.includes(day.toLowerCase())) {
    for (const time of PRIVATE_TRAINING_TIMES) {
      const availability = await checkSlotAvailability(day, time);
      if (availability) slots.push(availability);
    }
  }

  return slots;
};

/**
 * LEGACY: Get all available time slots for a specific program type
 */
const getAvailableSlots = async (
  programType: 'group' | 'private' | 'semi-private',
  selectedDays?: string[]
): Promise<SlotAvailability[]> => {
  const availableSlots: SlotAvailability[] = [];

  if (programType === 'group') {
    for (const day of GROUP_TRAINING_DAYS) {
      if (!selectedDays || selectedDays.map(d => d.toLowerCase()).includes(day.toLowerCase())) {
        const daySlots = await getDayAvailability(day);
        availableSlots.push(...daySlots.filter(s => s.programTypes.includes('group')));
      }
    }
  } else {
    for (const day of PRIVATE_TRAINING_DAYS) {
      if (!selectedDays || selectedDays.map(d => d.toLowerCase()).includes(day.toLowerCase())) {
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
    // NEW: Handle credit system queries (GET with date param)
    // Used by BookSessionModal: /api/check-availability?date=2025-01-15&session_type=group&registration_id=xxx
    if (req.method === 'GET' && req.query.date) {
      const { date, session_type = 'group', registration_id } = req.query;

      const slots = await checkDateAvailability(
        date as string,
        session_type as string,
        registration_id as string | undefined
      );

      return res.status(200).json({ slots });
    }

    // LEGACY: Handle registration form queries (POST with action)
    // Used by FormStep2: POST with action=getSlots&programType=group&selectedDays=[...]
    const params = req.method === 'GET' ? req.query : req.body;
    const { action, day, time, programType, selectedDays, duration } = params;

    // Check specific slot availability (legacy)
    if (action === 'checkSlot' && day && time) {
      const availability = await checkSlotAvailability(day as string, time as string);
      return res.status(200).json({ success: true, availability });
    }

    // Check day availability (legacy)
    if (action === 'checkDay' && day) {
      const slots = await getDayAvailability(day as string);
      return res.status(200).json({ success: true, slots });
    }

    // Get all available slots for a program type (legacy)
    if (action === 'getSlots' && programType) {
      const days = selectedDays
        ? (typeof selectedDays === 'string' ? [selectedDays] : selectedDays)
        : undefined;
      const slots = await getAvailableSlots(programType as any, days as string[]);
      return res.status(200).json({ success: true, slots });
    }

    return res.status(400).json({
      error: 'Invalid request. Use ?date=YYYY-MM-DD&session_type=group for booking, or POST with action=getSlots for registration.'
    });
  } catch (error: any) {
    console.error('Availability check error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to check availability'
    });
  }
}
