export enum Language {
  FR = 'fr',
  EN = 'en',
}

export type PlayerCategory = 'M9' | 'M11' | 'M13' | 'M13 Elite' | 'M15' | 'M15 Elite' | 'M18' | 'Junior' | 'Unknown';
export type BookingFrequency = '1x' | '2x';
export type BookingDay = 'tuesday' | 'friday';
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
  parentEmail: string;
  parentPhone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyRelationship: string;

  // Step 2
  programType: ProgramType | '';
  
  // Group Details
  groupFrequency: '1x' | '2x' | '';
  groupDay: 'tuesday' | 'friday' | '';

  // Private Details
  privateFrequency: '1x' | '2x' | 'one-time' | '';
  privateSelectedDays: string[];
  privateTimeSlot: string;

  // Semi-Private Details
  semiPrivateAvailability: string[];
  semiPrivateTimeWindows: string[];
  semiPrivateMatchingPreference: string;

  // Step 3
  position: string;
  dominantHand: 'Left' | 'Right' | '';
  currentLevel: string;
  jerseySize: string;
  hasAllergies: boolean;
  allergiesDetails: string;
  hasMedicalConditions: boolean;
  medicalConditionsDetails: string;
  actionPlan: File | null;
  medicalReport: File | null;
  medicalFiles?: MedicalFiles; // Stored URLs after upload
  photoVideoConsent: boolean;
  policyAcceptance: boolean;
}
