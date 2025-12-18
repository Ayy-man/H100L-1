import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Inline Supabase client for Vercel bundling (no caching to avoid stale connections)
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

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

// Capacity limits (must match purchase-session.ts and types/credits.ts)
const MAX_GROUP_CAPACITY = 6;
const MAX_PRIVATE_CAPACITY = 1;
const MAX_SEMI_PRIVATE_CAPACITY = 3;

// Sunday slot capacity - inlined to avoid Vercel bundling issues with lib/ imports
// 7:30 AM slot (M7, M9, M11): 12 players
// 8:30 AM slot (M13, M15): 10 players
const SUNDAY_SLOT_CAPACITY: Record<string, number> = {
  '7:30 AM': 12,
  '8:30 AM': 10,
};
const DEFAULT_SUNDAY_CAPACITY = 12;

// Helper to extract category number from string like "M13", "M15 Elite", etc.
function extractCategoryNumber(category: string): number {
  if (!category) return 0;
  if (category === 'Junior') return 18;
  const match = category.match(/M(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

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
 * Normalize category to match expected format
 * Handles: case variations, 'Adult' -> 'Junior' mapping, whitespace
 */
function normalizeCategory(category: string | null): string | null {
  if (!category) return null;

  const trimmed = category.trim();

  // Map 'Adult' to 'Junior' (Adult was incorrectly allowed before)
  if (trimmed.toLowerCase() === 'adult') {
    return 'Junior';
  }

  // Normalize common categories (case-insensitive matching)
  const categoryMap: Record<string, string> = {
    'm7': 'M7',
    'm9': 'M9',
    'm11': 'M11',
    'm13': 'M13',
    'm13 elite': 'M13 Elite',
    'm15': 'M15',
    'm15 elite': 'M15 Elite',
    'm18': 'M18',
    'junior': 'Junior',
    'unknown': 'Unknown',
  };

  const normalized = categoryMap[trimmed.toLowerCase()];
  return normalized || trimmed; // Return original if no mapping found
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

  // Normalize the category
  const normalizedCategory = normalizeCategory(category);

  // If no category or 'Unknown' after normalization, return ALL slots as fallback
  // This prevents blocking users with data issues
  if (!normalizedCategory || normalizedCategory === 'Unknown') {
    console.warn('[check-availability] No valid category found, returning all slots as fallback');
    return sessionType === 'sunday' ? ALL_SUNDAY_TIMES : ALL_GROUP_TIMES;
  }

  if (sessionType === 'sunday') {
    // Find Sunday slots that include this category
    const slots = Object.entries(SUNDAY_SLOTS_BY_CATEGORY)
      .filter(([_, categories]) => categories.includes(normalizedCategory))
      .map(([time]) => time);

    // If category doesn't match any Sunday slot (e.g., M18/Junior)
    // Return all Sunday slots as fallback to allow booking (business can validate later)
    if (slots.length === 0) {
      console.warn(`[check-availability] No Sunday slots for category "${normalizedCategory}", returning all as fallback`);
      return ALL_SUNDAY_TIMES;
    }
    return slots;
  }

  // Group training - find slots for this category
  const slots = Object.entries(GROUP_SLOTS_BY_CATEGORY)
    .filter(([_, categories]) => categories.includes(normalizedCategory))
    .map(([time]) => time);

  // Fallback: if no slots found for category, log and return all
  if (slots.length === 0) {
    console.warn(`[check-availability] No slots for category "${normalizedCategory}", returning all`);
    return ALL_GROUP_TIMES;
  }

  return slots;
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

  // Determine time slots based on session type
  // Note: Sunday uses slot-specific capacity, others use fixed capacity
  let timeSlots: string[];
  let maxCapacity: number;
  const isSundaySession = sessionType === 'sunday';

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
      // maxCapacity is determined per-slot below for Sunday
      maxCapacity = DEFAULT_SUNDAY_CAPACITY; // fallback
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

  // Sunday sessions use different tables (sunday_practice_slots / sunday_bookings)
  if (isSundaySession) {
    console.log('[check-availability] Querying Sunday slots for date:', date, 'Type:', typeof date);

    // Query ALL active sunday_practice_slots and filter by date in JavaScript
    // This bypasses any PostgREST date casting issues
    const { data: allSundaySlots, error: sundayError } = await supabase
      .from('sunday_practice_slots')
      .select('id, practice_date, start_time, end_time, available_spots, max_capacity, min_category, max_category, is_active')
      .eq('is_active', true)
      .order('practice_date', { ascending: true });

    console.log('[check-availability] All active Sunday slots from DB:', {
      count: allSundaySlots?.length ?? 0,
      dates: allSundaySlots?.map(s => s.practice_date),
      error: sundayError?.message
    });

    // Filter slots by matching date in JavaScript
    const sundaySlots = allSundaySlots?.filter(slot => {
      // Handle different possible date formats from Supabase
      const slotDate = String(slot.practice_date).split('T')[0]; // Get YYYY-MM-DD part
      const requestedDate = String(date).split('T')[0];
      const matches = slotDate === requestedDate;
      console.log('[check-availability] Date comparison:', { slotDate, requestedDate, matches });
      return matches;
    }) || [];

    console.log('[check-availability] Filtered slots for', date, ':', sundaySlots.length);

    if (sundayError) {
      console.error('[check-availability] Error querying Sunday slots:', sundayError);
      return [];
    }

    if (sundaySlots.length === 0) {
      console.log('[check-availability] No Sunday slots found for date:', date);
      return [];
    }

    // Convert database slots to TimeSlotOption format
    // Filter by player category if provided
    const normalizedCategory = normalizeCategory(playerCategory);
    const playerCategoryNum = normalizedCategory ? extractCategoryNumber(normalizedCategory) : null;

    console.log('[check-availability] Processing Sunday slots:', {
      playerCategory,
      normalizedCategory,
      playerCategoryNum,
      slotsToProcess: sundaySlots.length
    });

    for (const slot of sundaySlots) {
      // Format time from "07:30:00" to "7:30 AM"
      // Handle both "HH:MM:SS" and potential "HH:MM:SS.microseconds" formats
      const timeStr = String(slot.start_time);
      const timeParts = timeStr.split(':');
      const hours = timeParts[0];
      const minutes = timeParts[1];
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const time = `${displayHour}:${minutes} ${ampm}`;

      console.log('[check-availability] Processing slot:', {
        rawTime: slot.start_time,
        parsedTime: time,
        minCategory: slot.min_category,
        maxCategory: slot.max_category,
        availableSpots: slot.available_spots
      });

      // Check if player category matches this slot
      if (playerCategoryNum !== null) {
        const minCatNum = extractCategoryNumber(slot.min_category);
        const maxCatNum = extractCategoryNumber(slot.max_category);
        console.log('[check-availability] Category check:', {
          playerCategoryNum,
          minCatNum,
          maxCatNum,
          passes: playerCategoryNum >= minCatNum && playerCategoryNum <= maxCatNum
        });
        if (playerCategoryNum < minCatNum || playerCategoryNum > maxCatNum) {
          console.log('[check-availability] Skipping slot - category mismatch');
          continue; // Skip slots that don't match player's category
        }
      }

      const currentBookings = slot.max_capacity - slot.available_spots;
      slots.push({
        time,
        available: slot.available_spots > 0,
        currentBookings,
        maxCapacity: slot.max_capacity,
      });
    }

    console.log('[check-availability] Final Sunday slots:', slots);
    return slots;
  }

  // Non-Sunday sessions: query session_bookings table
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
  // Early env var validation
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[check-availability] Missing env vars:', {
      hasUrl: !!process.env.VITE_SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    return res.status(500).json({ error: 'Server configuration error' });
  }

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
