import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Legacy Field Helpers
 * These functions help read fields that may exist under different names
 * due to schema evolution. Use these when reading form_data from registrations.
 */

interface FormDataLike {
  semiPrivateTimeSlot?: string;
  semiPrivateTimeWindows?: string[];
  groupDay?: string;
  groupSelectedDays?: string[];
  [key: string]: unknown;
}

/**
 * Get semi-private time slot with backward compatibility.
 * Prefers semiPrivateTimeSlot, falls back to first item in semiPrivateTimeWindows.
 */
export function getSemiPrivateTimeSlot(formData: FormDataLike | null | undefined): string | null {
  if (!formData) return null;

  // Prefer the new field
  if (formData.semiPrivateTimeSlot) {
    return formData.semiPrivateTimeSlot;
  }

  // Fall back to legacy field
  if (formData.semiPrivateTimeWindows && formData.semiPrivateTimeWindows.length > 0) {
    return formData.semiPrivateTimeWindows[0];
  }

  return null;
}

/**
 * Get group selected days with backward compatibility.
 * Prefers groupSelectedDays array, falls back to single groupDay.
 */
export function getGroupSelectedDays(formData: FormDataLike | null | undefined): string[] {
  if (!formData) return [];

  // Prefer the new field
  if (formData.groupSelectedDays && formData.groupSelectedDays.length > 0) {
    return formData.groupSelectedDays;
  }

  // Fall back to legacy single day field
  if (formData.groupDay) {
    return [formData.groupDay];
  }

  return [];
}
