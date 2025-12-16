/**
 * Credit System Types
 *
 * This file contains all TypeScript types for the credit-based payment system.
 * Credits are at the PARENT level (firebase_uid) and shared across all children.
 *
 * @module types/credits
 * @created December 11, 2025
 */

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

/** Credit package types available for purchase */
export type CreditPackageType = 'single' | '10_pack' | '20_pack' | '50_pack';

/** Session types that can be booked */
export type SessionType = 'group' | 'sunday' | 'private' | 'semi_private';

/** Booking status for session bookings */
export type BookingStatus = 'booked' | 'attended' | 'cancelled' | 'no_show';

/** Credit purchase status */
export type CreditPurchaseStatus = 'active' | 'expired' | 'exhausted';

/** Recurring schedule status reasons */
export type RecurringPausedReason = 'insufficient_credits' | 'user_paused' | 'slot_unavailable' | null;

/** Day of week for recurring schedules */
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// =============================================================================
// CREDIT PRICING CONFIGURATION
// =============================================================================

/** Credit package pricing configuration */
export const CREDIT_PRICING = {
  single: {
    credits: 1,
    price: 4500, // $45.00 CAD in cents
    priceFormatted: '$45.00',
    description: 'Single Session',
    validityMonths: 12,
  },
  '10_pack': {
    credits: 10,
    price: 35000, // $350.00 CAD in cents
    priceFormatted: '$350.00',
    perCreditPrice: 3500, // $35.00 per credit
    description: '10-Session Package',
    validityMonths: 12,
  },
  '20_pack': {
    credits: 20,
    price: 50000, // $500.00 CAD in cents
    priceFormatted: '$500.00',
    perCreditPrice: 2500, // $25.00 per credit
    description: '20-Session Package',
    validityMonths: 12,
  },
  '50_pack': {
    credits: 50,
    price: 100000, // $1,000.00 CAD in cents
    priceFormatted: '$1,000.00',
    perCreditPrice: 2000, // $20.00 per credit
    description: '50-Session Package',
    validityMonths: 12,
  },
} as const;

/** Direct purchase session pricing (not credit-based) */
export const SESSION_PRICING = {
  sunday: {
    price: 5000, // $50.00 CAD in cents
    priceFormatted: '$50.00',
    description: 'Sunday Ice Practice',
  },
  semi_private: {
    price: 6900, // $69.00 CAD in cents
    priceFormatted: '$69.00',
    description: 'Semi-Private Training',
  },
  private: {
    price: 8999, // $89.99 CAD in cents
    priceFormatted: '$89.99',
    description: 'Private Training',
  },
} as const;

/** Credits required per session type */
export const CREDITS_PER_SESSION = {
  group: 1,
  sunday: 0, // Paid directly, not with credits
  private: 0, // Paid directly, not with credits
  semi_private: 0, // Paid directly, not with credits
} as const;

// =============================================================================
// DATABASE TABLE INTERFACES
// =============================================================================

/**
 * Parent credit balance (at firebase_uid level)
 * Maps to: parent_credits table
 */
export interface ParentCredits {
  id: string; // UUID
  firebase_uid: string;
  total_credits: number;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Credit purchase record
 * Maps to: credit_purchases table
 */
export interface CreditPurchase {
  id: string; // UUID
  firebase_uid: string;
  package_type: CreditPackageType;
  credits_purchased: number;
  price_paid: number; // Decimal stored as number
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  purchased_at: string; // ISO timestamp
  expires_at: string; // ISO timestamp
  credits_remaining: number;
  status: CreditPurchaseStatus;
}

/**
 * Session booking record
 * Maps to: session_bookings table
 */
export interface SessionBooking {
  id: string; // UUID
  firebase_uid: string;
  registration_id: string; // UUID reference to registrations

  // Session details
  session_type: SessionType;
  session_date: string; // Date string (YYYY-MM-DD)
  time_slot: string; // e.g., '5:45 PM'

  // Credit tracking (for group sessions)
  credits_used: number;
  credit_purchase_id: string | null; // UUID reference to credit_purchases

  // Payment tracking (for paid sessions)
  price_paid: number | null;
  stripe_payment_intent_id: string | null;

  // Recurring booking support
  is_recurring: boolean;
  recurring_schedule_id: string | null; // UUID reference to recurring_schedules

  // Status tracking
  status: BookingStatus;
  cancelled_at: string | null; // ISO timestamp
  cancellation_reason: string | null;

  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Recurring schedule record
 * Maps to: recurring_schedules table
 */
export interface RecurringSchedule {
  id: string; // UUID
  firebase_uid: string;
  registration_id: string; // UUID reference to registrations

  session_type: SessionType;
  day_of_week: DayOfWeek;
  time_slot: string;

  is_active: boolean;
  paused_reason: RecurringPausedReason;

  last_booked_date: string | null; // Date string (YYYY-MM-DD)
  next_booking_date: string | null; // Date string (YYYY-MM-DD)

  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/** Request to purchase credits */
export interface PurchaseCreditsRequest {
  firebase_uid: string;
  package_type: CreditPackageType;
  success_url: string;
  cancel_url: string;
}

/** Response from purchase credits endpoint */
export interface PurchaseCreditsResponse {
  checkout_url: string;
  session_id: string;
}

/** Request to get credit balance */
export interface CreditBalanceRequest {
  firebase_uid: string;
}

/** Response from credit balance endpoint */
export interface CreditBalanceResponse {
  total_credits: number;
  purchases: CreditPurchaseInfo[];
}

/** Simplified purchase info for balance display */
export interface CreditPurchaseInfo {
  id: string;
  package_type: CreditPackageType;
  credits_remaining: number;
  expires_at: string;
  status: CreditPurchaseStatus;
}

/** Request to get credit history */
export interface CreditHistoryRequest {
  firebase_uid: string;
  limit?: number;
  offset?: number;
}

/** Response from credit history endpoint */
export interface CreditHistoryResponse {
  purchases: CreditPurchase[];
  usage: CreditUsageRecord[];
  total_count: number;
}

/** Credit usage record for history */
export interface CreditUsageRecord {
  id: string;
  booking_id: string;
  registration_id: string;
  player_name: string;
  session_type: SessionType;
  session_date: string;
  time_slot: string;
  credits_used: number;
  used_at: string;
}

/** Request to book a session */
export interface BookSessionRequest {
  firebase_uid: string;
  registration_id: string;
  session_type: SessionType;
  session_date: string; // YYYY-MM-DD
  time_slot: string;
  is_recurring?: boolean;
}

/** Response from book session endpoint */
export interface BookSessionResponse {
  booking: SessionBooking;
  credits_remaining: number;
  message: string;
}

/** Request to cancel a booking */
export interface CancelBookingRequest {
  booking_id: string;
  firebase_uid: string;
  reason?: string;
}

/** Response from cancel booking endpoint */
export interface CancelBookingResponse {
  success: boolean;
  credits_refunded: number;
  credits_remaining: number;
  message: string;
}

/** Request to get user's bookings */
export interface MyBookingsRequest {
  firebase_uid: string;
  status?: BookingStatus | 'all';
  from_date?: string;
  to_date?: string;
}

/** Response from my-bookings endpoint */
export interface MyBookingsResponse {
  bookings: SessionBookingWithDetails[];
  total_count: number;
}

/** Session booking with registration details */
export interface SessionBookingWithDetails extends SessionBooking {
  player_name: string;
  player_category: string;
}

/** Request to purchase a paid session (Sunday/Private/Semi-Private) */
export interface PurchaseSessionRequest {
  firebase_uid: string;
  registration_id: string;
  session_type: 'sunday' | 'private' | 'semi_private';
  session_date: string;
  time_slot: string;
  success_url: string;
  cancel_url: string;
}

/** Response from purchase session endpoint */
export interface PurchaseSessionResponse {
  checkout_url: string;
  session_id: string;
}

/** Request to create/update recurring schedule */
export interface RecurringScheduleRequest {
  firebase_uid: string;
  registration_id: string;
  session_type: SessionType;
  day_of_week: DayOfWeek;
  time_slot: string;
}

/** Response from recurring schedule endpoint */
export interface RecurringScheduleResponse {
  schedule: RecurringSchedule;
  message: string;
}

/** Request for admin to adjust credits */
export interface AdminAdjustCreditsRequest {
  firebase_uid: string;
  adjustment: number; // Positive to add, negative to subtract
  reason: string;
  admin_id: string;
}

/** Response from admin adjust credits endpoint */
export interface AdminAdjustCreditsResponse {
  success: boolean;
  new_balance: number;
  message: string;
}

// =============================================================================
// NOTIFICATION TYPES FOR CREDIT SYSTEM
// =============================================================================

/** Additional notification types for credit system */
export type CreditNotificationType =
  | 'credits_purchased'      // Credits purchased successfully
  | 'credits_low'            // Credit balance is low (e.g., < 3)
  | 'credits_expiring'       // Credits expiring soon (e.g., within 30 days)
  | 'credits_expired'        // Credits have expired
  | 'booking_confirmed'      // Session booking confirmed
  | 'booking_cancelled'      // Booking cancelled, credit refunded
  | 'recurring_paused'       // Recurring booking paused (insufficient credits)
  | 'recurring_resumed'      // Recurring booking resumed
  | 'session_reminder';      // Upcoming session reminder

// =============================================================================
// STRIPE METADATA TYPES
// =============================================================================

/** Metadata attached to Stripe checkout sessions for credit purchases */
export interface CreditPurchaseMetadata {
  type: 'credit_purchase';
  firebase_uid: string;
  package_type: CreditPackageType;
  credits: string; // Stripe metadata must be strings
}

/** Metadata attached to Stripe checkout sessions for session purchases */
export interface SessionPurchaseMetadata {
  type: 'session_purchase';
  firebase_uid: string;
  registration_id: string;
  session_type: SessionType;
  session_date: string;
  time_slot: string;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/** Capacity information for a time slot */
export interface SlotCapacity {
  session_date: string;
  time_slot: string;
  session_type: SessionType;
  current_bookings: number;
  max_capacity: number;
  available_spots: number;
  is_available: boolean;
}

/** Credit balance summary for dashboard display */
export interface CreditBalanceSummary {
  total_credits: number;
  expiring_soon: number; // Credits expiring within 30 days
  next_expiry_date: string | null;
}

/** Booking calendar day data */
export interface BookingCalendarDay {
  date: string;
  bookings: SessionBookingWithDetails[];
  hasBookings: boolean;
}

// =============================================================================
// CONSTANTS FOR BUSINESS RULES
// =============================================================================

/** Cancellation policy: hours before session for free cancellation */
export const CANCELLATION_WINDOW_HOURS = 24;

/** Credit expiry warning threshold in days */
export const CREDIT_EXPIRY_WARNING_DAYS = 30;

/** Low credit balance warning threshold */
export const LOW_CREDIT_THRESHOLD = 3;

/** Maximum credits per package purchase */
export const MAX_CREDITS_PER_PURCHASE = 50;

/** Maximum time slots per day */
export const MAX_GROUP_CAPACITY = 6;

/** Sunday ice practice capacity */
export const SUNDAY_ICE_CAPACITY = 20;

// =============================================================================
// TYPE GUARDS
// =============================================================================

/** Type guard for SessionType */
export function isSessionType(value: string): value is SessionType {
  return ['group', 'sunday', 'private', 'semi_private'].includes(value);
}

/** Type guard for CreditPackageType */
export function isCreditPackageType(value: string): value is CreditPackageType {
  return ['single', '10_pack', '20_pack', '50_pack'].includes(value);
}

/** Type guard for BookingStatus */
export function isBookingStatus(value: string): value is BookingStatus {
  return ['booked', 'attended', 'cancelled', 'no_show'].includes(value);
}

/** Type guard for DayOfWeek */
export function isDayOfWeek(value: string): value is DayOfWeek {
  return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(value);
}
