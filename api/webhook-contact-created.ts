import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendContactCreated } from './_lib/n8nWebhook';

// Inline Supabase client for Vercel bundling
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

/**
 * Webhook trigger: Contact Created
 *
 * Called after registration to send contact info to n8n/GHL.
 * Fetches full registration data from DB to ensure accuracy.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { registration_id, firebase_uid } = req.body;

    if (!registration_id || !firebase_uid) {
      return res.status(400).json({
        error: 'Missing required fields: registration_id, firebase_uid',
      });
    }

    const supabase = getSupabase();

    // Fetch the registration to get full form data
    const { data: registration, error: fetchError } = await supabase
      .from('registrations')
      .select('form_data, parent_email, firebase_uid')
      .eq('id', registration_id)
      .eq('firebase_uid', firebase_uid)
      .single();

    if (fetchError || !registration) {
      console.error('Error fetching registration:', fetchError);
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Send webhook to n8n
    const success = await sendContactCreated(
      registration.firebase_uid,
      registration.form_data,
      registration.parent_email
    );

    return res.status(200).json({
      success,
      message: success
        ? 'Contact created webhook sent'
        : 'Webhook skipped (N8N_WEBHOOK_URL not configured)',
    });
  } catch (error: any) {
    console.error('Webhook contact created error:', error);
    return res.status(500).json({
      error: 'Failed to send webhook',
    });
  }
}
