import { supabase } from './supabase';

/**
 * Unified Capacity Manager
 * Manages time slot availability across ALL training types (group, private, semi-private)
 * Ensures cross-program blocking: if a slot is booked for ANY program, it's unavailable for others
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

// Define all available time slots for each program type
// Based on requirements: Mon/Wed/Thu = private only, Tue/Fri = group only

const GROUP_TRAINING_TIMES = [
  '4:30 PM',
  '5:45 PM',
  '7:00 PM',
  '8:15 PM'
];

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
const MAX_PRIVATE_CAPACITY = 1;

/**
 * Check real-time availability for a specific time slot across ALL programs
 */
export const checkSlotAvailability = async (
  day: string,
  time: string
): Promise<SlotAvailability | null> => {
  try {
    // Query Supabase for all bookings at this time slot
    const { data: bookings, error } = await supabase
      .from('registrations')
      .select('form_data')
      .or(`form_data->groupSelectedDays.cs.{${day}},form_data->privateSelectedDays.cs.{${day}},form_data->semiPrivateAvailability.cs.{${day}}`)
      .eq('payment_status', 'active');

    if (error) {
      console.error('Error checking slot availability:', error);
      return null;
    }

    let bookedSpots = 0;
    let maxCapacity = 0;
    const programTypes: string[] = [];

    // Check if this is a group training slot
    if (GROUP_TRAINING_DAYS.includes(day) && GROUP_TRAINING_TIMES.includes(time)) {
      programTypes.push('group');
      maxCapacity = MAX_GROUP_CAPACITY;

      // Count group bookings at this time
      const groupBookings = bookings?.filter(b =>
        b.form_data?.programType === 'group' &&
        b.form_data?.groupSelectedDays?.includes(day)
      ) || [];
      bookedSpots += groupBookings.length;
    }

    // Check if this is a private training slot
    if (PRIVATE_TRAINING_DAYS.includes(day) && PRIVATE_TRAINING_TIMES.includes(time)) {
      programTypes.push('private', 'semi-private');
      maxCapacity = MAX_PRIVATE_CAPACITY;

      // Count private/semi-private bookings at this time
      const privateBookings = bookings?.filter(b =>
        (b.form_data?.programType === 'private' || b.form_data?.programType === 'semi-private') &&
        (b.form_data?.privateSelectedDays?.includes(day) || b.form_data?.semiPrivateAvailability?.includes(day))
      ) || [];
      bookedSpots += privateBookings.length;
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
