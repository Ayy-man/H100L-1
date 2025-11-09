import { PlayerCategory } from '../types';

export const MAX_CAPACITY_PER_DAY = 6;

export interface TimeSlotInfo {
  time: string;
  applicableCategories: PlayerCategory[];
}

export const TIME_SLOTS: TimeSlotInfo[] = [
  { time: '4:30-5:30 PM', applicableCategories: ['M9', 'M11'] },
  { time: '5:45-6:45 PM', applicableCategories: ['M11', 'M13'] },
  { time: '7:00-8:00 PM', applicableCategories: ['M13 Elite', 'M15'] },
  { time: '8:15-9:15 PM', applicableCategories: ['M15 Elite', 'M18', 'Junior'] },
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
