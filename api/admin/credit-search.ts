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

  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const searchTerm = q.trim().toLowerCase();

    // Search registrations by parent email or player name
    // (parent_email is stored in registrations, not parent_credits)
    const { data: registrationData, error: registrationError } = await getSupabaseAdmin()
      .from('registrations')
      .select(`
        id,
        form_data,
        firebase_uid,
        parent_email
      `)
      .or(`parent_email.ilike.%${searchTerm}%,form_data->>'playerFullName'.ilike.%${searchTerm}%`)
      .not('firebase_uid', 'is', null)
      .limit(30);

    if (registrationError) throw registrationError;

    // Group by firebase_uid to get unique users
    const userMap = new Map<string, any>();

    for (const registration of registrationData || []) {
      const formData = registration.form_data as any;
      const uid = registration.firebase_uid;
      if (!uid) continue;

      const player = {
        name: formData?.playerFullName || 'Unknown',
        category: formData?.playerCategory || 'Unknown'
      };

      if (userMap.has(uid)) {
        userMap.get(uid).children.push(player);
      } else {
        // Get parent credits for this user
        const { data: credits } = await getSupabaseAdmin()
          .from('parent_credits')
          .select('total_credits')
          .eq('firebase_uid', uid)
          .single();

        userMap.set(uid, {
          firebase_uid: uid,
          parent_email: registration.parent_email || formData?.parentEmail || 'Unknown',
          total_credits: credits?.total_credits || 0,
          children: [player]
        });
      }
    }

    // Enhance results with additional stats
    const users = await Promise.all(
      Array.from(userMap.values()).map(async (user) => {
        // Get total credits purchased
        const { data: purchases } = await getSupabaseAdmin()
          .from('credit_purchases')
          .select('credits_purchased, created_at')
          .eq('firebase_uid', user.firebase_uid)
          .eq('status', 'completed');

        const totalPurchased = purchases?.reduce((sum, p) => sum + (p.credits_purchased || 0), 0) || 0;
        const lastPurchase = purchases?.length
          ? purchases.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
          : null;

        // Get last activity (booking or adjustment)
        const { data: lastBooking } = await getSupabaseAdmin()
          .from('session_bookings')
          .select('created_at')
          .eq('firebase_uid', user.firebase_uid)
          .order('created_at', { ascending: false })
          .limit(1);

        const { data: lastAdjustment } = await getSupabaseAdmin()
          .from('credit_adjustments')
          .select('created_at')
          .eq('firebase_uid', user.firebase_uid)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastActivity = [
          lastBooking?.[0]?.created_at,
          lastAdjustment?.[0]?.created_at
        ].filter(Boolean).sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0];

        return {
          ...user,
          total_purchased: totalPurchased,
          total_purchases: purchases?.length || 0,
          last_purchase: lastPurchase,
          last_activity: lastActivity
        };
      })
    );

    // Sort by relevance (exact email match first, then by last activity)
    users.sort((a, b) => {
      const aExactMatch = a.parent_email?.toLowerCase() === searchTerm;
      const bExactMatch = b.parent_email?.toLowerCase() === searchTerm;

      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      const aActivity = a.last_activity ? new Date(a.last_activity).getTime() : 0;
      const bActivity = b.last_activity ? new Date(b.last_activity).getTime() : 0;

      return bActivity - aActivity;
    });

    res.status(200).json({ users: users.slice(0, 10) });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
}
