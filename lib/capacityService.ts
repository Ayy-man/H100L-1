/**
 * Capacity Management Service
 * Checks real-time availability for Group Training time slots from Supabase
 */

import { supabase } from './supabase';

export interface CapacityInfo {
  currentCapacity: number;
  maxCapacity: number;
  available: number;
  isFull: boolean;
}

const MAX_CAPACITY_PER_SLOT = 6;

/**
 * Checks capacity for a specific time slot and day combination
 * @param timeSlot - The assigned time slot (e.g., "4:30 PM - 5:30 PM")
 * @param frequency - Either "1x" or "2x"
 * @param day - Either "tuesday", "friday", or "both" (for 2x)
 */
export async function checkCapacity(
  timeSlot: string,
  frequency: '1x' | '2x',
  day: 'tuesday' | 'friday' | 'both'
): Promise<CapacityInfo> {
  try {
    // Query all Group Training registrations from Supabase
    const { data, error } = await supabase
      .from('registrations')
      .select('form_data');

    if (error) {
      console.error('Capacity check error:', error);
      // Return optimistic result on error
      return {
        currentCapacity: 0,
        maxCapacity: MAX_CAPACITY_PER_SLOT,
        available: MAX_CAPACITY_PER_SLOT,
        isFull: false,
      };
    }

    // Count registrations that match this time slot and day
    const matchingRegistrations = (data || []).filter((registration: any) => {
      const formData = registration.form_data;

      // Only count Group Training registrations
      if (formData.programType !== 'group') return false;

      // Check if the time slot matches (derived from player category)
      // We need to calculate their assigned time slot
      const registeredCategory = formData.playerCategory;
      const registeredTimeSlot = getTimeSlotFromCategory(registeredCategory);
      if (registeredTimeSlot !== timeSlot) return false;

      // Check day matching logic
      if (frequency === '2x') {
        // For 2x/week, count all 2x registrations in this time slot
        return formData.groupFrequency === '2x';
      } else {
        // For 1x/week, only count registrations for the specific day
        return formData.groupFrequency === '1x' && formData.groupDay === day;
      }
    });

    const currentCapacity = matchingRegistrations.length;
    const available = MAX_CAPACITY_PER_SLOT - currentCapacity;

    return {
      currentCapacity,
      maxCapacity: MAX_CAPACITY_PER_SLOT,
      available: available > 0 ? available : 0,
      isFull: available <= 0,
    };
  } catch (error) {
    console.error('Unexpected capacity check error:', error);
    return {
      currentCapacity: 0,
      maxCapacity: MAX_CAPACITY_PER_SLOT,
      available: MAX_CAPACITY_PER_SLOT,
      isFull: false,
    };
  }
}

/**
 * Helper function to derive time slot from player category
 * (mirrors the logic in timeSlotAssignment.ts)
 */
function getTimeSlotFromCategory(category: string): string {
  const timeSlotMap: Record<string, string> = {
    'M9': '4:30 PM - 5:30 PM',
    'M11': '4:30 PM - 5:30 PM',
    'M13': '5:45 PM - 6:45 PM',
    'M15': '5:45 PM - 6:45 PM',
    'M18': '7:00 PM - 8:00 PM',
    'Junior': '7:00 PM - 8:00 PM',
  };
  return timeSlotMap[category] || '';
}
