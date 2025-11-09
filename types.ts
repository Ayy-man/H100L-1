export enum Language {
  FR = 'fr',
  EN = 'en',
}

export type PlayerCategory = 'M9' | 'M11' | 'M13' | 'M13 Elite' | 'M15' | 'M15 Elite' | 'M18' | 'Junior' | 'Unknown';
export type BookingFrequency = '1x' | '2x';
export type BookingDay = 'tuesday' | 'friday';
export type ProgramType = 'group' | 'private' | 'semi-private';

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
  playerCategory: 'M9' | 'M11' | 'M13' | 'M15' | 'M18' | 'Junior' | '';
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
  
  // Group Details
  groupFrequency: '1x' | '2x' | '';
  groupDay: 'tuesday' | 'friday' | '';
  sundayPractice: boolean;

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
  medicalReport: File | null;
  photoVideoConsent: boolean;
  policyAcceptance: boolean;
}
