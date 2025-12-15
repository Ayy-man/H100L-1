import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Inline types (Vercel bundling doesn't resolve ../types/credits)
type CreditPackageType = 'single' | '10_pack' | '20_pack';
type CreditPurchaseStatus = 'active' | 'expired' | 'exhausted';
type SessionType = 'group' | 'sunday' | 'private' | 'semi_private';

interface CreditPurchase {
  id: string;
  firebase_uid: string;
  package_type: CreditPackageType;
  credits_purchased: number;
  price_paid: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  purchased_at: string;
  expires_at: string;
  credits_remaining: number;
  status: CreditPurchaseStatus;
}

interface CreditUsageRecord {
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

interface CreditHistoryResponse {
  purchases: CreditPurchase[];
  usage: CreditUsageRecord[];
  total_count: number;
}

// Inline Supabase client for Vercel bundling
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const firebase_uid = req.query.firebase_uid as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Validate required field
    if (!firebase_uid) {
      return res.status(400).json({
        error: 'Missing required query parameter: firebase_uid',
      });
    }

    const supabase = getSupabase();

    // Get credit purchases
    const { data: purchases, error: purchaseError, count: purchaseCount } = await supabase
      .from('credit_purchases')
      .select('*', { count: 'exact' })
      .eq('firebase_uid', firebase_uid)
      .order('purchased_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (purchaseError) {
      console.error('Error fetching purchases:', purchaseError);
      return res.status(500).json({ error: 'Database error' });
    }

    // Get credit usage (bookings that used credits)
    const { data: bookings, error: bookingError } = await supabase
      .from('session_bookings')
      .select(`
        id,
        registration_id,
        session_type,
        session_date,
        time_slot,
        credits_used,
        created_at,
        registrations!inner (
          form_data
        )
      `)
      .eq('firebase_uid', firebase_uid)
      .gt('credits_used', 0)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (bookingError) {
      console.error('Error fetching usage:', bookingError);
      return res.status(500).json({ error: 'Database error' });
    }

    // Transform bookings to usage records
    const usage: CreditUsageRecord[] = (bookings || []).map((b: any) => ({
      id: b.id,
      booking_id: b.id,
      registration_id: b.registration_id,
      player_name: b.registrations?.form_data?.playerFullName || 'Unknown',
      session_type: b.session_type,
      session_date: b.session_date,
      time_slot: b.time_slot,
      credits_used: b.credits_used,
      used_at: b.created_at,
    }));

    const response: CreditHistoryResponse = {
      purchases: purchases as CreditPurchase[],
      usage,
      total_count: purchaseCount || 0,
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Credit history error:', error);
    return res.status(500).json({
      error: 'Failed to fetch credit history',
    });
  }
}
