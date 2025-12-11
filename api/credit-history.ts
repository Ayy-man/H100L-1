import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import type {
  CreditHistoryResponse,
  CreditPurchase,
  CreditUsageRecord,
} from '../types/credits';

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
