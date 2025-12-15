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
}

/**
 * Add Child API Endpoint
 *
 * Creates a new registration (child) for an existing parent account.
 * This is a simplified flow that only requires basic child information.
 *
 * The parent can later:
 * - Buy credits (shared across all children)
 * - Book sessions for any child
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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

    // Validate category
    const validCategories = ['M7', 'M9', 'M11', 'M13', 'M15', 'M18', 'Adult'];
    if (!validCategories.includes(player_category)) {
      return res.status(400).json({
        error: `Invalid player_category. Must be one of: ${validCategories.join(', ')}`,
      });
    }

    const supabase = getSupabase();

    // Create minimal form_data for registration
    const formData = {
      playerFullName: player_name.trim(),
      dateOfBirth: date_of_birth,
      playerCategory: player_category,
      parentEmail: parent_email || '',
      // Set defaults for required fields
      programType: 'group', // Default, can be changed when booking
      groupFrequency: '',
      groupSelectedDays: [],
      // These will be filled in if/when needed
      parentFullName: '',
      parentPhone: '',
      parentCity: '',
      parentPostalCode: '',
      communicationLanguage: 'en',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyRelationship: '',
      jerseySize: '',
      photoVideoConsent: true,
      policyAcceptance: true,
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
