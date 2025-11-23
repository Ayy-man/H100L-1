/**
 * Timezone Utilities - EST/EDT (America/New_York)
 *
 * All date/time operations in this application should use Eastern Time.
 * These utilities ensure consistent timezone handling across the entire codebase.
 */

const TIMEZONE = 'America/New_York'; // Handles EST/EDT automatically

/**
 * Get current date/time in EST
 */
export function getNowEST(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/**
 * Get today's date (midnight EST) as Date object
 */
export function getTodayEST(): Date {
  const now = getNowEST();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Parse ISO date string (YYYY-MM-DD) as EST date at midnight
 * Avoids timezone shift issues when parsing date-only strings
 */
export function parseISODateEST(dateString: string): Date {
  // dateString should be in format YYYY-MM-DD
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date();
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Format Date as ISO date string (YYYY-MM-DD) in EST
 */
export function formatISODateEST(date: Date): string {
  const estDate = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const year = estDate.getFullYear();
  const month = String(estDate.getMonth() + 1).padStart(2, '0');
  const day = String(estDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get next Sunday from a given date (or today) in EST
 */
export function getNextSundayEST(fromDate?: Date): Date {
  const date = fromDate ? new Date(fromDate) : getTodayEST();
  const dayOfWeek = date.getDay();

  // If today is Sunday, return today at midnight
  if (dayOfWeek === 0) {
    date.setHours(0, 0, 0, 0);
    return date;
  }

  // Otherwise, calculate days until next Sunday
  const daysUntilSunday = 7 - dayOfWeek;
  date.setDate(date.getDate() + daysUntilSunday);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Format date for display using EST timezone
 */
export function formatDateEST(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  };

  return date.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Format date and time for display using EST timezone
 */
export function formatDateTimeEST(date: Date, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  };

  return date.toLocaleString('en-US', defaultOptions);
}

/**
 * Check if a date is the same day in EST
 */
export function isSameDayEST(date1: Date, date2: Date): boolean {
  return formatISODateEST(date1) === formatISODateEST(date2);
}

/**
 * Get start of week (Sunday) for a given date in EST
 */
export function getStartOfWeekEST(date: Date): Date {
  const estDate = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const dayOfWeek = estDate.getDay();
  const startOfWeek = new Date(estDate);
  startOfWeek.setDate(estDate.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
}

/**
 * Add days to a date in EST (handles DST transitions correctly)
 */
export function addDaysEST(date: Date, days: number): Date {
  const estDate = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
  estDate.setDate(estDate.getDate() + days);
  return estDate;
}

/**
 * Get current EST date as YYYY-MM-DD string
 */
export function getTodayISOStringEST(): string {
  return formatISODateEST(getTodayEST());
}

/**
 * Convert UTC timestamp to EST Date
 */
export function utcToEST(utcDate: Date | string | number): Date {
  const date = typeof utcDate === 'string' || typeof utcDate === 'number'
    ? new Date(utcDate)
    : utcDate;

  return new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
}
