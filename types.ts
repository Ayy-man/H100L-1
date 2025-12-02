export enum Language {
  FR = 'fr',
  EN = 'en',
}

export type PlayerCategory = 'M9' | 'M11' | 'M13' | 'M13 Elite' | 'M15' | 'M15 Elite' | 'M18' | 'Junior' | 'Unknown';
export type BookingFrequency = '1x' | '2x';
export type BookingDay = 'tuesday' | 'friday'; // Legacy - keeping for backward compatibility
export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type ProgramType = 'group' | 'private' | 'semi-private';

export interface MedicalFile {
  url: string;
  filename: string;
  size: number;
  uploadedAt: string;
}

export interface MedicalFiles {
  actionPlan?: MedicalFile;
  medicalReport?: MedicalFile;
}

export interface BookingRequest {
  category: PlayerCategory;
  frequency: BookingFrequency;
  day?: BookingDay; // Optional for 2x, required for 1x
}

export interface Availability {
  timeSlot: string;
  canBook2x: boolean;
  available2xSlots: number;
  canBook1xTuesday: boolean;
  available1xTuesdaySlots: number;
  canBook1xFriday: boolean;
  available1xFridaySlots: number;
}

// Full form data structure
export interface FormData {
  // Step 1
  playerFullName: string;
  dateOfBirth: string;
  playerCategory: PlayerCategory | '';
  parentFullName: string;
  parentEmail: string;
  parentPhone: string;
  parentCity: string;
  parentPostalCode: string;
  communicationLanguage: 'French' | 'English' | '';
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyRelationship: string;

  // Step 2
  programType: ProgramType | '';

  // Group Details - New 7-day schedule with monthly booking
  groupFrequency: '1x' | '2x' | '';
  /** @deprecated Use groupSelectedDays instead. Kept for backward compatibility with existing data. */
  groupDay: 'tuesday' | 'friday' | '';
  groupSelectedDays: WeekDay[]; // Preferred: Selected days of the week for recurring training
  groupMonthlyDates: string[]; // Generated dates for the current month (ISO format: YYYY-MM-DD)

  // Private Details
  privateFrequency: '1x' | '2x' | 'one-time' | '';
  privateSelectedDays: string[];
  privateTimeSlot: string;

  // Semi-Private Details
  semiPrivateAvailability: string[];
  semiPrivateTimeSlot: string; // Preferred: Single time slot string (e.g., "9-10")
  /** @deprecated Use semiPrivateTimeSlot instead. Kept for backward compatibility with existing data. */
  semiPrivateTimeWindows: string[];
  semiPrivateMatchingPreference: string;

  // Step 3
  position: string;
  dominantHand: 'Left' | 'Right' | '';
  currentLevel: string;
  jerseySize: string;
  primaryObjective: 'Shooting' | 'Puck Handling' | 'Skating' | 'Endurance' | '';
  hasAllergies: boolean;
  allergiesDetails: string;
  hasMedicalConditions: boolean;
  medicalConditionsDetails: string;
  carriesMedication: boolean;
  medicationDetails: string;
  actionPlan: File | null;
  medicalReport: File | null;
  medicalFiles?: MedicalFiles; // Stored URLs after upload
  photoVideoConsent: boolean;
  policyAcceptance: boolean;
}

// Firebase Authentication Types
export interface FirebaseUserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  createdAt: string;
}

// Notification Types
export type NotificationType =
  | 'pairing_created'      // Semi-private pairing was created
  | 'pairing_dissolved'    // Semi-private pairing was dissolved
  | 'schedule_changed'     // Schedule was changed (one-time or permanent)
  | 'payment_confirmed'    // Payment was confirmed by admin
  | 'payment_received'     // Stripe payment received
  | 'sunday_booking'       // Sunday practice booked
  | 'sunday_reminder'      // Sunday practice reminder
  | 'waitlist_update'      // Waitlist status update
  | 'admin_message'        // General admin message
  | 'system';              // System notification

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  created_at: string;
  user_id: string;           // Firebase UID for parent, 'admin' for admin notifications
  user_type: 'parent' | 'admin';
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  read: boolean;
  read_at: string | null;
  data?: Record<string, any>; // Additional context data (registration_id, player_name, etc.)
  action_url?: string;        // Optional link to relevant page
  expires_at?: string;        // Optional expiration date
}

// Registration with Firebase fields (matches Supabase table structure)
export interface Registration {
  id: string;
  created_at: string;
  updated_at: string;
  payment_status: 'pending' | 'succeeded' | 'verified' | 'failed' | 'canceled' | null;
  payment_method_id: string | null;
  // Manual confirmation fields (admin override)
  manually_confirmed?: boolean;
  manually_confirmed_by?: string;
  manually_confirmed_at?: string;
  manually_confirmed_reason?: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;

  // Firebase authentication fields
  firebase_uid: string | null;
  parent_email: string | null;
  firebase_user_created_at: string | null;

  // Form data
  form_data: FormData;
}
