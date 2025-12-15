/**
 * n8n Webhook Helper
 *
 * Sends webhooks to n8n for parent communication via GHL (SMS/Email).
 * Fire and forget - logs errors but doesn't retry.
 */

// =============================================================================
// TYPES
// =============================================================================

export type WebhookEventType =
  | 'contact_created'
  | 'contact_updated'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'credits_purchased'
  | 'credits_low'
  | 'credits_expiring'
  | 'session_reminder';

export interface ContactInfo {
  firebase_uid: string;
  email: string;
  phone: string;
  name: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  postal_code?: string;
  language: 'English' | 'French';
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface ChildInfo {
  name: string;
  date_of_birth: string;
  category: string;
  program_type: string;
  position?: string;
  dominant_hand?: string;
  level?: string;
  jersey_size?: string;
  objective?: string;
  medical: {
    has_allergies: boolean;
    allergies_details?: string;
    has_conditions: boolean;
    conditions_details?: string;
    carries_medication: boolean;
    medication_details?: string;
  };
}

export interface PaymentInfo {
  total_spent: number;
  credits_purchased: number;
  last_purchase_date: string;
}

export interface BookingInfo {
  id: string;
  player_name: string;
  session_type: string;
  session_date: string;
  time_slot: string;
  credits_used?: number;
  price_paid?: number;
}

export interface CreditInfo {
  action: 'purchased' | 'low' | 'expiring';
  amount?: number;
  new_balance: number;
  package_type?: string;
  price_paid?: number;
  expires_at?: string;
  expiring_credits?: number;
}

// =============================================================================
// WEBHOOK PAYLOADS
// =============================================================================

export interface ContactCreatedPayload {
  event_type: 'contact_created';
  timestamp: string;
  contact: ContactInfo;
  emergency_contact: EmergencyContact;
  children: ChildInfo[];
}

export interface ContactUpdatedPayload {
  event_type: 'contact_updated';
  timestamp: string;
  contact: ContactInfo;
  payment_info: PaymentInfo;
  children?: ChildInfo[];
}

export interface BookingPayload {
  event_type: 'booking_confirmed' | 'booking_cancelled';
  timestamp: string;
  contact: ContactInfo;
  booking: BookingInfo;
  credits_refunded?: number;
}

export interface CreditsPayload {
  event_type: 'credits_purchased' | 'credits_low' | 'credits_expiring';
  timestamp: string;
  contact: ContactInfo;
  credits: CreditInfo;
}

export interface SessionReminderPayload {
  event_type: 'session_reminder';
  timestamp: string;
  contact: ContactInfo;
  booking: BookingInfo;
}

export type WebhookPayload =
  | ContactCreatedPayload
  | ContactUpdatedPayload
  | BookingPayload
  | CreditsPayload
  | SessionReminderPayload;

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Send webhook to n8n
 *
 * Fire and forget - logs errors but doesn't throw.
 * Returns true if successful, false if failed.
 */
export async function sendN8nWebhook(payload: WebhookPayload): Promise<boolean> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[n8n] N8N_WEBHOOK_URL not configured, skipping webhook');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[n8n] Webhook failed: ${response.status} ${response.statusText}`);
      return false;
    }

    console.log(`[n8n] Webhook sent: ${payload.event_type}`);
    return true;
  } catch (error) {
    console.error('[n8n] Webhook error:', error);
    return false;
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract contact info from registration data
 */
export function extractContactFromRegistration(
  firebaseUid: string,
  formData: Record<string, any>,
  parentEmail: string
): ContactInfo {
  const fullName = formData.parentFullName || '';
  const nameParts = fullName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return {
    firebase_uid: firebaseUid,
    email: parentEmail,
    phone: formData.parentPhone || '',
    name: fullName,
    first_name: firstName,
    last_name: lastName,
    city: formData.parentCity || '',
    postal_code: formData.parentPostalCode || '',
    language: formData.communicationLanguage || 'English',
  };
}

/**
 * Extract emergency contact from form data
 */
export function extractEmergencyContact(formData: Record<string, any>): EmergencyContact {
  return {
    name: formData.emergencyContactName || '',
    phone: formData.emergencyContactPhone || '',
    relationship: formData.emergencyRelationship || '',
  };
}

/**
 * Extract child info from form data
 */
export function extractChildInfo(formData: Record<string, any>): ChildInfo {
  return {
    name: formData.playerFullName || '',
    date_of_birth: formData.dateOfBirth || '',
    category: formData.playerCategory || '',
    program_type: formData.programType || '',
    position: formData.position || '',
    dominant_hand: formData.dominantHand || '',
    level: formData.currentLevel || '',
    jersey_size: formData.jerseySize || '',
    objective: formData.primaryObjective || '',
    medical: {
      has_allergies: formData.hasAllergies || false,
      allergies_details: formData.allergiesDetails || '',
      has_conditions: formData.hasMedicalConditions || false,
      conditions_details: formData.medicalConditionsDetails || '',
      carries_medication: formData.carriesMedication || false,
      medication_details: formData.medicationDetails || '',
    },
  };
}

/**
 * Create minimal contact info for notifications
 */
export function createMinimalContact(
  firebaseUid: string,
  email: string,
  phone: string,
  name: string,
  language: 'English' | 'French' = 'English'
): ContactInfo {
  return {
    firebase_uid: firebaseUid,
    email,
    phone,
    name,
    language,
  };
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Send contact_created webhook
 */
export async function sendContactCreated(
  firebaseUid: string,
  formData: Record<string, any>,
  parentEmail: string
): Promise<boolean> {
  const payload: ContactCreatedPayload = {
    event_type: 'contact_created',
    timestamp: new Date().toISOString(),
    contact: extractContactFromRegistration(firebaseUid, formData, parentEmail),
    emergency_contact: extractEmergencyContact(formData),
    children: [extractChildInfo(formData)],
  };

  return sendN8nWebhook(payload);
}

/**
 * Send booking_confirmed webhook
 */
export async function sendBookingConfirmed(
  contact: ContactInfo,
  booking: BookingInfo
): Promise<boolean> {
  const payload: BookingPayload = {
    event_type: 'booking_confirmed',
    timestamp: new Date().toISOString(),
    contact,
    booking,
  };

  return sendN8nWebhook(payload);
}

/**
 * Send booking_cancelled webhook
 */
export async function sendBookingCancelled(
  contact: ContactInfo,
  booking: BookingInfo,
  creditsRefunded: number = 0
): Promise<boolean> {
  const payload: BookingPayload = {
    event_type: 'booking_cancelled',
    timestamp: new Date().toISOString(),
    contact,
    booking,
    credits_refunded: creditsRefunded,
  };

  return sendN8nWebhook(payload);
}

/**
 * Send credits_purchased webhook
 */
export async function sendCreditsPurchased(
  contact: ContactInfo,
  credits: CreditInfo
): Promise<boolean> {
  const payload: CreditsPayload = {
    event_type: 'credits_purchased',
    timestamp: new Date().toISOString(),
    contact,
    credits: { ...credits, action: 'purchased' },
  };

  return sendN8nWebhook(payload);
}

/**
 * Send credits_low webhook
 */
export async function sendCreditsLow(
  contact: ContactInfo,
  currentBalance: number
): Promise<boolean> {
  const payload: CreditsPayload = {
    event_type: 'credits_low',
    timestamp: new Date().toISOString(),
    contact,
    credits: {
      action: 'low',
      new_balance: currentBalance,
    },
  };

  return sendN8nWebhook(payload);
}

/**
 * Send credits_expiring webhook
 */
export async function sendCreditsExpiring(
  contact: ContactInfo,
  expiringCredits: number,
  expiresAt: string,
  currentBalance: number
): Promise<boolean> {
  const payload: CreditsPayload = {
    event_type: 'credits_expiring',
    timestamp: new Date().toISOString(),
    contact,
    credits: {
      action: 'expiring',
      expiring_credits: expiringCredits,
      expires_at: expiresAt,
      new_balance: currentBalance,
    },
  };

  return sendN8nWebhook(payload);
}

/**
 * Send session_reminder webhook
 */
export async function sendSessionReminder(
  contact: ContactInfo,
  booking: BookingInfo
): Promise<boolean> {
  const payload: SessionReminderPayload = {
    event_type: 'session_reminder',
    timestamp: new Date().toISOString(),
    contact,
    booking,
  };

  return sendN8nWebhook(payload);
}

/**
 * Send contact_updated webhook (after purchase)
 */
export async function sendContactUpdated(
  contact: ContactInfo,
  paymentInfo: PaymentInfo
): Promise<boolean> {
  const payload: ContactUpdatedPayload = {
    event_type: 'contact_updated',
    timestamp: new Date().toISOString(),
    contact,
    payment_info: paymentInfo,
  };

  return sendN8nWebhook(payload);
}
