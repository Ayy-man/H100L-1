/**
 * Sunday Real Ice Practice Booking System Configuration
 *
 * This file contains all configuration settings for the Sunday practice booking system.
 * Centralized configuration makes it easy to adjust business rules without touching code.
 */

export interface SundayPracticeTimeSlot {
  startTime: string;
  endTime: string;
  minCategory: string;
  maxCategory: string;
  displayName: string;
  ageRange: string;
  capacity: number; // Max players for this specific slot
}

export interface SundayPracticeConfig {
  // Capacity Settings
  maxCapacityPerSlot: number;

  // Booking Rules
  weeksAheadAvailable: number; // How many weeks ahead parents can book
  allowCancellation: boolean;
  cancellationDeadlineHours: number | null; // null = can cancel anytime

  // Eligibility Rules
  eligiblePrograms: string[];
  ineligibleCategories: string[];
  minimumCategory: string;

  // Time Slots Configuration
  timeSlots: SundayPracticeTimeSlot[];

  // Location
  location: {
    name: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    fullAddress: string;
  };

  // Auto-generation Settings (for cron job)
  autoGeneration: {
    enabled: boolean;
    weeksAhead: number; // How many weeks ahead to generate slots
    cronSchedule: string; // Cron expression
  };

  // Display Settings
  display: {
    showCapacity: boolean;
    showWaitlist: boolean;
    emptySlotMessage: string;
    fullSlotMessage: string;
    ineligibleMessage: string;
  };

  // Status Messages
  messages: {
    bookingSuccess: string;
    bookingError: string;
    cancellationSuccess: string;
    alreadyBookedError: string;
    slotFullError: string;
    ineligibleError: string;
    paymentRequiredError: string;
  };
}

/**
 * Sunday Practice Configuration
 *
 * Business Rules:
 * 1. Only Group Training players can book
 * 2. M7, M9, and M11 in first slot (7:30-8:30 AM) - 12 kids max
 * 3. M13 and M15 in second slot (8:30-9:30 AM) - 10 kids max
 * 4. Parents can book upcoming Sundays (up to 8 weeks ahead)
 * 5. No cancellation deadline - can cancel anytime before the practice
 * 6. Two time slots based on age groups
 * 7. Slots auto-generated weekly via cron job
 * 8. Attendance tracked by admins
 */
export const SUNDAY_PRACTICE_CONFIG: SundayPracticeConfig = {
  // Capacity Settings
  maxCapacityPerSlot: 12, // Default max for early slot, late slot is 10

  // Booking Rules
  weeksAheadAvailable: 1, // Only book next Sunday (1 week ahead)
  allowCancellation: true,
  cancellationDeadlineHours: null, // No deadline - can cancel anytime

  // Eligibility Rules
  eligiblePrograms: ['group'], // Only Group Training
  ineligibleCategories: ['Unknown'], // Only exclude unknown categories
  minimumCategory: 'M7',

  // Time Slots Configuration
  timeSlots: [
    {
      startTime: '07:30',
      endTime: '08:30',
      minCategory: 'M7',
      maxCategory: 'M11',
      displayName: 'Early Slot (M7-M9-M11)',
      ageRange: 'M7 to M11',
      capacity: 12, // M7, M9, M11 slot - 12 players max
    },
    {
      startTime: '08:30',
      endTime: '09:30',
      minCategory: 'M13',
      maxCategory: 'M15',
      displayName: 'Late Slot (M13-M15)',
      ageRange: 'M13 to M15',
      capacity: 10, // M13, M15 slot - 10 players max
    },
  ],

  // Location
  location: {
    name: 'SniperZone Training Center',
    address: '7515 Boulevard Henri-Bourassa E',
    city: 'Montreal',
    province: 'Quebec',
    postalCode: 'H1E 1N9',
    fullAddress: '7515 Boulevard Henri-Bourassa E, Montreal, Quebec H1E 1N9',
  },

  // Auto-generation Settings (for cron job)
  autoGeneration: {
    enabled: true,
    weeksAhead: 4, // Generate slots 4 weeks in advance
    cronSchedule: '0 0 * * 1', // Every Monday at midnight (cron format)
  },

  // Display Settings
  display: {
    showCapacity: true,
    showWaitlist: false, // No waitlist for now
    emptySlotMessage: 'No slots available for next Sunday. Check back soon!',
    fullSlotMessage: 'This time slot is fully booked',
    ineligibleMessage: 'Sunday practice is only available for Group Training players',
  },

  // Status Messages
  messages: {
    bookingSuccess: 'Your Sunday practice slot has been booked successfully!',
    bookingError: 'Failed to book slot. Please try again.',
    cancellationSuccess: 'Your booking has been cancelled successfully.',
    alreadyBookedError: 'You already have a booking for this Sunday.',
    slotFullError: 'Sorry, this time slot is fully booked.',
    ineligibleError: 'Only Group Training players can book Sunday practice.',
    paymentRequiredError: 'Active subscription required to book Sunday practice.',
  },
};

/**
 * Helper function to check if a player category is eligible
 */
export const isCategoryEligible = (category: string): boolean => {
  return !SUNDAY_PRACTICE_CONFIG.ineligibleCategories.includes(category);
};

/**
 * Helper function to check if a program type is eligible
 */
export const isProgramEligible = (programType: string): boolean => {
  return SUNDAY_PRACTICE_CONFIG.eligiblePrograms.includes(programType);
};

/**
 * Helper function to get the appropriate time slot for a player category
 */
export const getTimeSlotForCategory = (
  category: string
): SundayPracticeTimeSlot | null => {
  const categoryOrder = [
    'M7',
    'M9',
    'M11',
    'M13',
    'M13 Elite',
    'M15',
    'M15 Elite',
    'M18',
    'Junior',
  ];

  const categoryIndex = categoryOrder.indexOf(category);
  if (categoryIndex === -1) return null;

  for (const slot of SUNDAY_PRACTICE_CONFIG.timeSlots) {
    const minIndex = categoryOrder.indexOf(slot.minCategory);
    const maxIndex = categoryOrder.indexOf(slot.maxCategory);

    if (categoryIndex >= minIndex && categoryIndex <= maxIndex) {
      return slot;
    }
  }

  return null;
};

/**
 * Helper function to format time slot for display
 */
export const formatTimeSlot = (startTime: string, endTime: string): string => {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
};

/**
 * Helper function to calculate next Sunday date
 */
export const getNextSunday = (): Date => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  nextSunday.setHours(0, 0, 0, 0);
  return nextSunday;
};

/**
 * Helper function to check if cancellation is allowed
 */
export const canCancelBooking = (practiceDate: Date): boolean => {
  if (!SUNDAY_PRACTICE_CONFIG.allowCancellation) {
    return false;
  }

  const now = new Date();
  const { cancellationDeadlineHours } = SUNDAY_PRACTICE_CONFIG;

  // If no deadline, can always cancel (as long as it's not past)
  if (cancellationDeadlineHours === null) {
    return practiceDate > now;
  }

  // Check if within cancellation deadline
  const deadlineTime = new Date(practiceDate);
  deadlineTime.setHours(deadlineTime.getHours() - cancellationDeadlineHours);

  return now < deadlineTime;
};

/**
 * Helper function to format date for display
 */
export const formatPracticeDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Category Priority Mapping
 * Used to determine which time slot a player should be assigned to
 */
export const CATEGORY_PRIORITY: Record<string, number> = {
  M9: 0,
  M11: 1,
  M13: 2,
  'M13 Elite': 3,
  M15: 4,
  'M15 Elite': 5,
  M18: 6,
  Junior: 7,
  Unknown: -1,
};

/**
 * Booking Status Types
 */
export type BookingStatus = 'confirmed' | 'cancelled' | 'attended' | 'no-show';

/**
 * Booking Status Display
 */
export const BOOKING_STATUS_DISPLAY: Record<
  BookingStatus,
  { label: string; color: string; icon: string }
> = {
  confirmed: {
    label: 'Confirmed',
    color: 'text-green-600 bg-green-50 border-green-200',
    icon: '✓',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-gray-500 bg-gray-50 border-gray-200',
    icon: '✕',
  },
  attended: {
    label: 'Attended',
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    icon: '✓✓',
  },
  'no-show': {
    label: 'No Show',
    color: 'text-red-600 bg-red-50 border-red-200',
    icon: '⚠',
  },
};

/**
 * TypeScript interfaces for API responses
 */
export interface BookingResponse {
  success: boolean;
  booking_id?: string;
  slot_date?: string;
  time_range?: string;
  message?: string;
  error?: string;
  code?: string;
}

export interface NextSlotResponse {
  success: boolean;
  eligible: boolean;
  already_booked?: boolean;
  booking_id?: string;
  next_sunday?: string;
  available_slots?: Array<{
    slot_id: string;
    date: string;
    start_time: string;
    end_time: string;
    time_range: string;
    min_category: string;
    max_category: string;
    available_spots: number;
    max_capacity: number;
  }>;
  reason?: string;
  error?: string;
  code?: string;
}

export interface RosterEntry {
  booking_id: string;
  player_name: string;
  player_category: string;
  parent_email: string;
  parent_name: string;
  booking_status: BookingStatus;
  attended: boolean | null;
  booked_at: string;
}

export interface SundayRosterResponse {
  success: boolean;
  practice_date?: string;
  slots?: Array<{
    slot_id: string;
    time_range: string;
    age_range: string;
    capacity: string;
    bookings: RosterEntry[];
  }>;
  error?: string;
  code?: string;
}

export default SUNDAY_PRACTICE_CONFIG;
