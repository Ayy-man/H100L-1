import { supabase } from './supabase';

/**
 * Unified Capacity Manager
 *
 * CAPACITY LOGIC:
 * 1. Group Training: STATIC fixed times (4:30, 5:45, 7:00, 8:15 PM) on Tue/Fri
 *    - Max 6 players per slot
 *    - Only blocks within group program (doesn't conflict with private)
 *
 * 2. Private & Semi-Private: FLEXIBLE times chosen by customer on Mon/Wed/Thu
 *    - Max 1 booking per specific time/day combination
 *    - BLOCKS ACROSS BOTH PROGRAMS: if private booked 3pm Mon → semi-private can't book same slot
 *    - If 2-hour booking, blocks BOTH consecutive hours
 */

export interface TimeSlot {
  id: string;
  time: string; // e.g., "3:00 PM", "4:15 PM"
  day: string; // e.g., "monday", "tuesday"
  programType: 'group' | 'private' | 'semi-private';
  duration: number; // in hours (1 or 2)
  availableSpots: number; // For group: max 6, for private/semi-private: 1
  bookedSpots: number;
  isFull: boolean;
}

export interface SlotAvailability {
  time: string;
  day: string;
  availableSpots: number;
  totalCapacity: number;
  isFull: boolean;
  programTypes: string[]; // Which program types can use this slot
}

// Group training: Fixed static times on Tue/Fri
const GROUP_TRAINING_TIMES = [
  '4:30 PM',
  '5:45 PM',
  '7:00 PM',
  '8:15 PM'
];

// Private/Semi-Private: Flexible times on Mon/Wed/Thu (customer chooses)
const PRIVATE_TRAINING_TIMES = [
  '3:00 PM',
  '4:15 PM',
  '5:30 PM',
  '6:45 PM',
  '8:00 PM'
];

const GROUP_TRAINING_DAYS = ['tuesday', 'friday'];
const PRIVATE_TRAINING_DAYS = ['monday', 'wednesday', 'thursday'];
const MAX_GROUP_CAPACITY = 6;
const MAX_PRIVATE_CAPACITY = 1; // Shared between private AND semi-private

/**
 * Check real-time availability for a specific time slot
 * Handles two separate pools:
 * 1. Group training (static times, 6 max)
 * 2. Private + Semi-Private (flexible times, blocks across both programs)
 */
export const checkSlotAvailability = async (
  day: string,
  time: string
): Promise<SlotAvailability | null> => {
  try {
    let bookedSpots = 0;
    let maxCapacity = 0;
    const programTypes: string[] = [];

    // GROUP TRAINING POOL (static times on Tue/Fri)
    if (GROUP_TRAINING_DAYS.includes(day.toLowerCase()) && GROUP_TRAINING_TIMES.includes(time)) {
      programTypes.push('group');
      maxCapacity = MAX_GROUP_CAPACITY;

      // Query only group bookings on this day (time is static, doesn't need to be queried)
      const { data: groupBookings, error } = await supabase
        .from('registrations')
        .select('form_data')
        .eq('payment_status', 'active')
        .contains('form_data->groupSelectedDays', [day.toLowerCase()]);

      if (error) {
        console.error('Error checking group availability:', error);
        return null;
      }

      // Filter by program type
      bookedSpots = groupBookings?.filter(b => b.form_data?.programType === 'group').length || 0;
    }

    // PRIVATE/SEMI-PRIVATE POOL (flexible times on Mon/Wed/Thu)
    // IMPORTANT: These share the same pool - if one books a time, both are blocked
    else if (PRIVATE_TRAINING_DAYS.includes(day.toLowerCase())) {
      programTypes.push('private', 'semi-private');
      maxCapacity = MAX_PRIVATE_CAPACITY;

      // Query both private AND semi-private on this day
      // Need to check if they selected this specific time
      const { data: bookings, error } = await supabase
        .from('registrations')
        .select('form_data')
        .eq('payment_status', 'active')
        .or(`form_data->programType.eq.private,form_data->programType.eq.semi-private`);

      if (error) {
        console.error('Error checking private/semi-private availability:', error);
        return null;
      }

      // Count bookings that selected this specific day AND time
      // For private: check privateSelectedDays and privateTimeSlot
      // For semi-private: check semiPrivateAvailability and preferred time windows
      bookedSpots = bookings?.filter(b => {
        const isPrivate = b.form_data?.programType === 'private';
        const isSemiPrivate = b.form_data?.programType === 'semi-private';

        if (isPrivate) {
          return b.form_data?.privateSelectedDays?.includes(day) &&
                 b.form_data?.privateTimeSlot === time;
        }

        if (isSemiPrivate) {
          return b.form_data?.semiPrivateAvailability?.includes(day) &&
                 b.form_data?.semiPrivateTimeSlot === time; // Assuming this field exists
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
export const getDayAvailability = async (day: string): Promise<SlotAvailability[]> => {
  const slots: SlotAvailability[] = [];

  // Determine which times to check based on the day
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
 * For 2-hour private sessions, need to check both consecutive slots
 */
export const checkMultiHourAvailability = async (
  day: string,
  startTime: string,
  duration: number // in hours
): Promise<boolean> => {
  if (duration === 1) {
    const availability = await checkSlotAvailability(day, startTime);
    return availability ? !availability.isFull : false;
  }

  // For 2-hour bookings, check both hours
  if (duration === 2) {
    const times = PRIVATE_TRAINING_TIMES;
    const startIndex = times.indexOf(startTime);

    if (startIndex === -1 || startIndex >= times.length - 1) {
      return false; // Invalid start time or no next slot available
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
export const getAvailableSlots = async (
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
    // private or semi-private
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

/**
 * Reserve a time slot (called during registration submission)
 * This is handled by saving the registration with payment_status = 'active'
 * The checkSlotAvailability function will then count it as booked
 */
export const validateBookingRequest = async (
  programType: 'group' | 'private' | 'semi-private',
  selectedDays: string[],
  timeSlot?: string,
  duration: number = 1
): Promise<{ valid: boolean; message: string }> => {
  // Validate day restrictions
  if (programType === 'group') {
    const invalidDays = selectedDays.filter(d => !GROUP_TRAINING_DAYS.includes(d));
    if (invalidDays.length > 0) {
      return {
        valid: false,
        message: `Group training is only available on ${GROUP_TRAINING_DAYS.join(', ')}`
      };
    }
  } else {
    const invalidDays = selectedDays.filter(d => !PRIVATE_TRAINING_DAYS.includes(d));
    if (invalidDays.length > 0) {
      return {
        valid: false,
        message: `Private training is only available on ${PRIVATE_TRAINING_DAYS.join(', ')}`
      };
    }
  }

  // If specific time slot is provided, check availability
  if (timeSlot) {
    for (const day of selectedDays) {
      const isAvailable = duration === 1
        ? (await checkSlotAvailability(day, timeSlot))?.isFull === false
        : await checkMultiHourAvailability(day, timeSlot, duration);

      if (!isAvailable) {
        return {
          valid: false,
          message: `Time slot ${timeSlot} on ${day} is not available`
        };
      }
    }
  }

  return { valid: true, message: 'Booking is valid' };
};
