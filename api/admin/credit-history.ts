import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Inline Supabase client - lib/supabase.ts is not bundled by Vercel
let _getSupabaseAdmin(): ReturnType<typeof createClient> | null = null;
const getSupabaseAdmin = () => {
  if (!_getSupabaseAdmin()) {
    _getSupabaseAdmin() = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _getSupabaseAdmin();
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { firebase_uid } = req.query;

  if (!firebase_uid || typeof firebase_uid !== 'string') {
    return res.status(400).json({ error: 'firebase_uid is required' });
  }

  try {
    // Get credit purchases
    const { data: purchases, error: purchaseError } = await getSupabaseAdmin()
      .from('credit_purchases')
      .select('*')
      .eq('firebase_uid', firebase_uid)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50);

    if (purchaseError) throw purchaseError;

    // Get credit usage (session bookings with player info)
    const { data: bookings, error: bookingError } = await getSupabaseAdmin()
      .from('session_bookings')
      .select(`
        id,
        session_type,
        credits_used,
        created_at,
        registration_id,
        registrations!inner(form_data)
      `)
      .eq('firebase_uid', firebase_uid)
      .eq('status', 'booked')
      .order('created_at', { ascending: false })
      .limit(50);

    if (bookingError) throw bookingError;

    // Get credit adjustments
    const { data: adjustments, error: adjustmentError } = await getSupabaseAdmin()
      .from('credit_adjustments')
      .select('*')
      .eq('firebase_uid', firebase_uid)
      .order('created_at', { ascending: false })
      .limit(50);

    if (adjustmentError) throw adjustmentError;

    // Combine all into a single history array
    const history = [
      ...purchases.map(p => ({
        id: `purchase-${p.id}`,
        type: 'purchase' as const,
        amount: p.credits_purchased,
        description: `Purchased ${p.package_type || 'credit'} package`,
        created_at: p.created_at,
        player_name: null,
        admin_email: null,
        reason: null
      })),
      ...bookings.map((b: any) => ({
        id: `booking-${b.id}`,
        type: 'usage' as const,
        amount: b.credits_used || 0,
        description: `Booked ${b.session_type} session`,
        created_at: b.created_at,
        player_name: b.registrations?.form_data?.playerFullName || null,
        admin_email: null,
        reason: null
      })),
      ...adjustments.map(a => ({
        id: `adjustment-${a.id}`,
        type: 'adjustment' as const,
        amount: a.adjustment,
        description: 'Admin adjustment',
        created_at: a.created_at,
        player_name: null,
        admin_email: a.admin_email,
        reason: a.reason
      }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.status(200).json({ history });

  } catch (error) {
    console.error('Error fetching credit history:', error);
    res.status(500).json({ error: 'Failed to fetch credit history' });
  }
}