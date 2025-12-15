import { PlayerCategory } from '../types';

export const MAX_CAPACITY_PER_DAY = 6;

export interface TimeSlotInfo {
  time: string;
  applicableCategories: PlayerCategory[];
}

// Weekday group training time slots
export const TIME_SLOTS: TimeSlotInfo[] = [
  { time: '4:30-5:30 PM', applicableCategories: ['M7', 'M9', 'M11'] },
  { time: '5:45-6:45 PM', applicableCategories: ['M13', 'M13 Elite'] },
  { time: '7:00-8:00 PM', applicableCategories: ['M15', 'M15 Elite'] },
  { time: '8:15-9:15 PM', applicableCategories: ['M18', 'Junior'] },
];

// Sunday ice practice time slots (only M7-M15 eligible)
export const SUNDAY_TIME_SLOTS: TimeSlotInfo[] = [
  { time: '7:30-8:30 AM', applicableCategories: ['M7', 'M9', 'M11'] },
  { time: '8:30-9:30 AM', applicableCategories: ['M13', 'M13 Elite', 'M15', 'M15 Elite'] },
];

/**
 * Finds the corresponding time slot for a given player category.
 * @param category The player's age category.
 * @returns The time slot information or null if not found.
 */
export const findSlotForCategory = (category: PlayerCategory): TimeSlotInfo | null => {
  if (category === 'Unknown') return null;
  return TIME_SLOTS.find(slot => slot.applicableCategories.includes(category)) || null;
};

/**
 * Finds the Sunday ice practice time slot for a given player category.
 * @param category The player's age category.
 * @returns The Sunday time slot information or null if not eligible.
 */
export const findSundaySlotForCategory = (category: PlayerCategory): TimeSlotInfo | null => {
  if (category === 'Unknown') return null;
  // M18 and Junior are not eligible for Sunday ice
  if (category === 'M18' || category === 'Junior') return null;
  return SUNDAY_TIME_SLOTS.find(slot => slot.applicableCategories.includes(category)) || null;
};
