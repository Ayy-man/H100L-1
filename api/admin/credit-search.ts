import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const searchTerm = q.trim().toLowerCase();

    // Search parents by email
    const { data: parentData, error: parentError } = await supabaseAdmin
      .from('parent_credits')
      .select(`
        firebase_uid,
        parent_email,
        credits_remaining
      `)
      .ilike('parent_email', `%${searchTerm}%`)
      .limit(10);

    if (parentError) throw parentError;

    // Search by player name
    const { data: registrationData, error: registrationError } = await supabaseAdmin
      .from('registrations')
      .select(`
        form_data,
        firebase_uid
      `)
      .ilike('form_data->>player_name', `%${searchTerm}%`)
      .limit(20);

    if (registrationError) throw registrationError;

    // Combine and deduplicate results
    const userMap = new Map<string, any>();

    // Add parent email matches
    parentData?.forEach(parent => {
      userMap.set(parent.firebase_uid, {
        firebase_uid: parent.firebase_uid,
        parent_email: parent.parent_email,
        credits_remaining: parent.credits_remaining,
        children: []
      });
    });

    // Add player name matches and get additional details
    for (const registration of registrationData || []) {
      const formData = registration.form_data;
      const uid = registration.firebase_uid;

      const player = {
        name: formData.player_name,
        category: formData.player_category
      };

      if (userMap.has(uid)) {
        userMap.get(uid).children.push(player);
      } else {
        // Get parent credits for this user
        const { data: credits } = await supabaseAdmin
          .from('parent_credits')
          .select('parent_email, credits_remaining')
          .eq('firebase_uid', uid)
          .single();

        userMap.set(uid, {
          firebase_uid: uid,
          parent_email: credits?.parent_email || 'Unknown',
          credits_remaining: credits?.credits_remaining || 0,
          children: [player]
        });
      }
    }

    // Enhance results with additional stats
    const users = await Promise.all(
      Array.from(userMap.values()).map(async (user) => {
        // Get total credits purchased
        const { data: purchases } = await supabaseAdmin
          .from('credit_purchases')
          .select('credits, created_at')
          .eq('firebase_uid', user.firebase_uid)
          .eq('status', 'completed');

        const totalCredits = purchases?.reduce((sum, p) => sum + p.credits, 0) || 0;
        const lastPurchase = purchases?.length > 0
          ? purchases.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
          : null;

        // Get last activity (booking or adjustment)
        const { data: lastBooking } = await supabaseAdmin
          .from('session_bookings')
          .select('created_at')
          .eq('firebase_uid', user.firebase_uid)
          .order('created_at', { ascending: false })
          .limit(1);

        const { data: lastAdjustment } = await supabaseAdmin
          .from('credit_adjustments')
          .select('created_at')
          .eq('firebase_uid', user.firebase_uid)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastActivity = [
          lastBooking?.[0]?.created_at,
          lastAdjustment?.[0]?.created_at
        ].filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

        return {
          ...user,
          total_credits: totalCredits,
          total_purchases: purchases?.length || 0,
          last_purchase: lastPurchase,
          last_activity: lastActivity
        };
      })
    );

    // Sort by relevance (exact email match first, then by last activity)
    users.sort((a, b) => {
      const aExactMatch = a.parent_email.toLowerCase() === searchTerm;
      const bExactMatch = b.parent_email.toLowerCase() === searchTerm;

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