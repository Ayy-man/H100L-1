import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import type {
  MyBookingsResponse,
  SessionBookingWithDetails,
  BookingStatus,
} from '../types/credits';
import { isBookingStatus } from '../types/credits';

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
    const status = req.query.status as string || 'all';
    const from_date = req.query.from_date as string;
    const to_date = req.query.to_date as string;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    // Validate required field
    if (!firebase_uid) {
      return res.status(400).json({
        error: 'Missing required query parameter: firebase_uid',
      });
    }

    // Validate status if provided
    if (status !== 'all' && !isBookingStatus(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be "booked", "attended", "cancelled", "no_show", or "all"',
      });
    }

    const supabase = getSupabase();

    // First check if session_bookings table exists and has any data for this user
    // Use a simpler query without joins to be more resilient
    let query = supabase
      .from('session_bookings')
      .select('*', { count: 'exact' })
      .eq('firebase_uid', firebase_uid);

    // Filter by status if not 'all'
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Filter by date range if provided
    if (from_date) {
      query = query.gte('session_date', from_date);
    }
    if (to_date) {
      query = query.lte('session_date', to_date);
    }

    // Order by date and apply pagination
    query = query
      .order('session_date', { ascending: true })
      .order('time_slot', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: bookings, error, count } = await query;

    if (error) {
      console.error('Error fetching bookings:', error);
      return res.status(500).json({ error: 'Database error', details: error.message });
    }

    // If no bookings, return empty array immediately
    if (!bookings || bookings.length === 0) {
      const response: MyBookingsResponse = {
        bookings: [],
        total_count: 0,
      };
      return res.status(200).json(response);
    }

    // Get registration IDs to fetch player names
    const registrationIds = [...new Set(bookings.map((b: any) => b.registration_id))];

    // Fetch player names from registrations
    const { data: registrations } = await supabase
      .from('registrations')
      .select('id, form_data')
      .in('id', registrationIds);

    // Create lookup map for player names
    const playerMap = new Map<string, { name: string; category: string }>();
    (registrations || []).forEach((r: any) => {
      playerMap.set(r.id, {
        name: r.form_data?.playerFullName || 'Unknown',
        category: r.form_data?.playerCategory || 'Unknown',
      });
    });

    // Transform bookings to include player details
    const bookingsWithDetails: SessionBookingWithDetails[] = bookings.map((b: any) => {
      const player = playerMap.get(b.registration_id) || { name: 'Unknown', category: 'Unknown' };
      return {
        id: b.id,
        firebase_uid: b.firebase_uid,
        registration_id: b.registration_id,
        session_type: b.session_type,
        session_date: b.session_date,
        time_slot: b.time_slot,
        credits_used: b.credits_used,
        credit_purchase_id: b.credit_purchase_id,
        price_paid: b.price_paid,
        stripe_payment_intent_id: b.stripe_payment_intent_id,
        is_recurring: b.is_recurring,
        recurring_schedule_id: b.recurring_schedule_id,
        status: b.status,
        cancelled_at: b.cancelled_at,
        cancellation_reason: b.cancellation_reason,
        created_at: b.created_at,
        updated_at: b.updated_at,
        player_name: player.name,
        player_category: player.category,
      };
    });

    const response: MyBookingsResponse = {
      bookings: bookingsWithDetails,
      total_count: count || 0,
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('My bookings error:', error);
    return res.status(500).json({
      error: 'Failed to fetch bookings',
    });
  }
}
