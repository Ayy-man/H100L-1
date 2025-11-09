import { getAvailability, _updateBookingState } from './capacityManager';
import { BookingRequest, PlayerCategory, Availability } from '../types';

/**
 * Public API to check availability for a category.
 * @param category The player's category.
 * @returns Availability object or null.
 */
export const checkAvailability = (category: PlayerCategory): Availability | null => {
    return getAvailability(category);
}

interface BookingResult {
    success: boolean;
    message: string;
    assignedSlot?: string;
    assignedDays?: string[];
}

/**
 * Validates and processes a booking request.
 * If successful, it updates the central booking state.
 * @param request The booking request to process.
 * @returns A result object indicating success or failure.
 */
export const makeBooking = (request: BookingRequest): BookingResult => {
    const availability = getAvailability(request.category);

    if (!availability) {
        return { success: false, message: 'Invalid player category or no available time slots for this group.' };
    }

    // --- Validation ---
    if (request.frequency === '2x') {
        if (!availability.canBook2x) {
            return { success: false, message: `Sorry, 2x/week sessions are full for the ${availability.timeSlot} slot.` };
        }
    } else if (request.frequency === '1x') {
        if (!request.day) {
            return { success: false, message: 'You must specify a day (Tuesday or Friday) for 1x/week sessions.' };
        }
        if (request.day === 'tuesday' && !availability.canBook1xTuesday) {
             return { success: false, message: `Sorry, Tuesday sessions are full for the ${availability.timeSlot} slot.` };
        }
        if (request.day === 'friday' && !availability.canBook1xFriday) {
             return { success: false, message: `Sorry, Friday sessions are full for the ${availability.timeSlot} slot.` };
        }
    } else {
        return { success: false, message: 'Invalid booking frequency specified.' };
    }

    // --- Assignment ---
    const updateSuccess = _updateBookingState(request);

    if (updateSuccess) {
        return {
            success: true,
            message: 'Booking successful!',
            assignedSlot: availability.timeSlot,
            assignedDays: request.frequency === '2x' ? ['Tuesday', 'Friday'] : [request.day!],
        }
    }
    
    // This case should ideally not be reached if validation is correct (e.g. race conditions)
    return { success: false, message: 'An unexpected error occurred while confirming the booking. Please try again.' };
};
