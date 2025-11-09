import { TIME_SLOTS, MAX_CAPACITY_PER_DAY, findSlotForCategory } from './timeSlots';
import { PlayerCategory, Availability, BookingRequest } from '../types';

interface DailySchedule {
  tuesday: number;
  friday: number;
}

// In a real application, this state would come from a database.
// This is our mock "database" of current bookings.
const bookingState: Record<string, DailySchedule> = TIME_SLOTS.reduce((acc, slot) => {
  acc[slot.time] = { tuesday: 0, friday: 0 };
  return acc;
}, {} as Record<string, DailySchedule>);


/**
 * Checks the current availability for a given player category.
 * @param category The player's age category.
 * @returns An Availability object or null if the category is invalid.
 */
export const getAvailability = (category: PlayerCategory): Availability | null => {
  const slotInfo = findSlotForCategory(category);
  if (!slotInfo) {
    return null;
  }

  const currentBookings = bookingState[slotInfo.time];
  const spotsLeftTue = MAX_CAPACITY_PER_DAY - currentBookings.tuesday;
  const spotsLeftFri = MAX_CAPACITY_PER_DAY - currentBookings.friday;

  const available2xSlots = Math.min(spotsLeftTue, spotsLeftFri);

  return {
    timeSlot: slotInfo.time,
    canBook2x: available2xSlots > 0,
    available2xSlots: available2xSlots,
    canBook1xTuesday: spotsLeftTue > 0,
    available1xTuesdaySlots: spotsLeftTue,
    canBook1xFriday: spotsLeftFri > 0,
    available1xFridaySlots: spotsLeftFri,
  };
};

/**
 * (Internal) Updates the booking state. In a real app, this would be a database transaction.
 * @param request The validated booking request to commit.
 * @returns True if the update was successful.
 */
export const _updateBookingState = (request: BookingRequest): boolean => {
    const slotInfo = findSlotForCategory(request.category);
    if (!slotInfo) return false;

    const slotBookings = bookingState[slotInfo.time];

    if (request.frequency === '2x') {
        slotBookings.tuesday++;
        slotBookings.friday++;
    } else if (request.frequency === '1x' && request.day) {
        slotBookings[request.day]++;
    } else {
        return false; // Invalid 1x request
    }
    return true;
}
