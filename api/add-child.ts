import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Lazy-initialized Supabase client
let _supabase: ReturnType<typeof createClient> | null = null;
const getSupabase = () => {
  if (!_supabase) {
    _supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
};

interface AddChildRequest {
  firebase_uid: string;
  player_name: string;
  date_of_birth: string;
  player_category: string;
  parent_email?: string;
  // Emergency contact
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_relationship?: string;
  // Hockey info
  position?: string;
  dominant_hand?: string;
  current_level?: string;
  jersey_size?: string;
  primary_objective?: string;
  // Medical info
  has_allergies?: boolean;
  allergies_details?: string;
  has_medical_conditions?: boolean;
  medical_conditions_details?: string;
  carries_medication?: boolean;
  medication_details?: string;
  // Consents
  photo_video_consent?: boolean;
  policy_acceptance?: boolean;
}

/**
 * Add Child API Endpoint
 *
 * Creates a new registration (child) for an existing parent account.
 * Accepts full player profile including emergency contact, hockey info,
 * medical information, and consents.
 *
 * The parent can later:
 * - Buy credits (shared across all children)
 * - Book sessions for any child
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Early env var validation
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[add-child] Missing env vars:', {
      hasUrl: !!process.env.VITE_SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      firebase_uid,
      player_name,
      date_of_birth,
      player_category,
      parent_email,
      // Emergency contact
      emergency_contact_name,
      emergency_contact_phone,
      emergency_relationship,
      // Hockey info
      position,
      dominant_hand,
      current_level,
      jersey_size,
      primary_objective,
      // Medical info
      has_allergies,
      allergies_details,
      has_medical_conditions,
      medical_conditions_details,
      carries_medication,
      medication_details,
      // Consents
      photo_video_consent,
      policy_acceptance,
    } = req.body as AddChildRequest;

    // Validate required fields
    if (!firebase_uid) {
      return res.status(400).json({ error: 'firebase_uid is required' });
    }
    if (!player_name || !player_name.trim()) {
      return res.status(400).json({ error: 'player_name is required' });
    }
    if (!date_of_birth) {
      return res.status(400).json({ error: 'date_of_birth is required' });
    }
    if (!player_category) {
      return res.status(400).json({ error: 'player_category is required' });
    }

    // Validate date format
    const dobDate = new Date(date_of_birth);
    if (isNaN(dobDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date_of_birth format' });
    }

    // Validate category (must match types.ts PlayerCategory, excluding Unknown)
    const validCategories = [
      'M7', 'M9', 'M11',
      'M13', 'M13 Elite',
      'M15', 'M15 Elite',
      'M18', 'Junior'
    ];
    if (!validCategories.includes(player_category)) {
      return res.status(400).json({
        error: `Invalid player_category. Must be one of: ${validCategories.join(', ')}`,
      });
    }

    // Validate required fields for full registration
    if (!emergency_contact_name?.trim()) {
      return res.status(400).json({ error: 'emergency_contact_name is required' });
    }
    if (!emergency_contact_phone?.trim()) {
      return res.status(400).json({ error: 'emergency_contact_phone is required' });
    }
    if (!emergency_relationship?.trim()) {
      return res.status(400).json({ error: 'emergency_relationship is required' });
    }
    if (!jersey_size) {
      return res.status(400).json({ error: 'jersey_size is required' });
    }
    if (!photo_video_consent) {
      return res.status(400).json({ error: 'photo_video_consent is required' });
    }
    if (!policy_acceptance) {
      return res.status(400).json({ error: 'policy_acceptance is required' });
    }

    const supabase = getSupabase();

    // Create full form_data for registration
    const formData = {
      // Basic info
      playerFullName: player_name.trim(),
      dateOfBirth: date_of_birth,
      playerCategory: player_category,
      parentEmail: parent_email || '',
      // Emergency contact
      emergencyContactName: emergency_contact_name.trim(),
      emergencyContactPhone: emergency_contact_phone.trim(),
      emergencyRelationship: emergency_relationship.trim(),
      // Hockey info
      position: position?.trim() || '',
      dominantHand: dominant_hand || '',
      currentLevel: current_level?.trim() || '',
      jerseySize: jersey_size,
      primaryObjective: primary_objective || '',
      // Medical info
      hasAllergies: has_allergies || false,
      allergiesDetails: allergies_details?.trim() || '',
      hasMedicalConditions: has_medical_conditions || false,
      medicalConditionsDetails: medical_conditions_details?.trim() || '',
      carriesMedication: carries_medication || false,
      medicationDetails: medication_details?.trim() || '',
      // Consents
      photoVideoConsent: photo_video_consent,
      policyAcceptance: policy_acceptance,
      // Set defaults for program-related fields (not used in add-child flow)
      programType: 'group',
      groupFrequency: '',
      groupSelectedDays: [],
      parentFullName: '',
      parentPhone: '',
      parentCity: '',
      parentPostalCode: '',
      communicationLanguage: 'en',
    };

    // Insert registration
    const { data: registration, error: insertError } = await supabase
      .from('registrations')
      .insert({
        form_data: formData,
        firebase_uid,
        parent_email: parent_email || null,
        firebase_user_created_at: new Date().toISOString(),
        payment_status: 'verified', // No payment needed for adding child
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to create registration:', insertError);
      return res.status(500).json({
        error: 'Failed to add child. Please try again.',
        details: insertError.message,
      });
    }

    // Ensure parent_credits record exists (for credit sharing)
    const { data: existingCredits } = await supabase
      .from('parent_credits')
      .select('id')
      .eq('firebase_uid', firebase_uid)
      .single();

    if (!existingCredits) {
      // Create parent_credits record with 0 credits
      await supabase
        .from('parent_credits')
        .insert({
          firebase_uid,
          total_credits: 0,
        });
    }

    return res.status(200).json({
      success: true,
      registration_id: registration.id,
      message: `${player_name} has been added successfully!`,
    });
  } catch (error: any) {
    console.error('Add child error:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred. Please try again.',
    });
  }
}
