/**
 * Maps player categories to their assigned Group Training time slots
 * Based on age groups and training schedule requirements
 */

export function getGroupTimeSlot(category: string): string {
  const timeSlotMap: Record<string, string> = {
    'M9': '4:30 PM - 5:30 PM',
    'M11': '4:30 PM - 5:30 PM',
    'M11 Elite': '5:45 PM - 6:45 PM',
    'M13': '5:45 PM - 6:45 PM',
    'M13 Elite': '7:00 PM - 8:00 PM',
    'M15': '7:00 PM - 8:00 PM',
    'M15 Elite': '8:15 PM - 9:15 PM',
    'M18': '8:15 PM - 9:15 PM',
    'Junior': '8:15 PM - 9:15 PM',
  };

  return timeSlotMap[category] || '';
}

/**
 * Gets the French translation for a time slot
 */
export function getTimeSlotFrench(timeSlot: string): string {
  // Times remain the same in French, just using 24-hour format preference
  return timeSlot.replace('PM', '').replace('AM', '').trim();
}
