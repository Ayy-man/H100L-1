import { WeekDay } from '../types';

/**
 * Get a local date string in YYYY-MM-DD format without UTC conversion
 * This avoids the timezone shift bug where toISOString() converts to UTC
 *
 * @param date - Date object (defaults to current date)
 * @returns Date string in YYYY-MM-DD format using local timezone
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate dates for the current month based on selected days of the week
 * @param selectedDays - Array of weekday strings (e.g., ['monday', 'wednesday'])
 * @returns Array of date strings in ISO format (YYYY-MM-DD)
 */
export function generateMonthlyDates(selectedDays: WeekDay[]): string[] {
  if (selectedDays.length === 0) return [];

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Get the first and last day of the current month
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

  const dayNameToNumber: Record<WeekDay, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const selectedDayNumbers = selectedDays.map(day => dayNameToNumber[day]);
  const dates: string[] = [];

  // Iterate through each day of the month
  for (let date = new Date(firstDayOfMonth); date <= lastDayOfMonth; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay();
    if (selectedDayNumbers.includes(dayOfWeek)) {
      // Format as YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
  }

  return dates;
}

/**
 * Format a date string for display
 * @param dateString - ISO format date string (YYYY-MM-DD)
 * @returns Formatted date string (e.g., "Mon, Jan 15")
 */
export function formatDateForDisplay(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00'); // Add time to avoid timezone issues
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get the current month name and year
 * @returns Formatted string (e.g., "January 2025")
 */
export function getCurrentMonthYear(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Check if a date is in the past
 * @param dateString - ISO format date string (YYYY-MM-DD)
 * @returns True if the date is before today
 */
export function isDateInPast(dateString: string): boolean {
  const date = new Date(dateString + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Get remaining dates in the current month (excluding past dates)
 * @param allDates - Array of all dates for the month
 * @returns Array of dates that are today or in the future
 */
export function getRemainingDates(allDates: string[]): string[] {
  return allDates.filter(date => !isDateInPast(date));
}
