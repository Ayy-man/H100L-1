import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Type definitions inline to avoid import issues
interface SessionBookingWithDetails {
  id: string;
  firebase_uid: string;
  registration_id: string;
  session_type: string;
  session_date: string;
  time_slot: string;
  credits_used: number;
  credit_purchase_id: string | null;
  price_paid: number | null;
  stripe_payment_intent_id: string | null;
  is_recurring: boolean;
  recurring_schedule_id: string | null;
  status: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  player_name: string;
  player_category: string;
}

interface MyBookingsResponse {
  bookings: SessionBookingWithDetails[];
  total_count: number;
}

const VALID_STATUSES = ['booked', 'attended', 'cancelled', 'no_show'];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // =========================================================================
  // STEP 1: Check environment variables FIRST
  // =========================================================================
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('MISSING ENV: VITE_SUPABASE_URL is not set');
    return res.status(503).json({
      error: 'Service configuration error',
      details: 'VITE_SUPABASE_URL environment variable is not set',
      fix: 'Add VITE_SUPABASE_URL to Vercel Environment Variables',
    });
  }

  if (!supabaseServiceKey) {
    console.error('MISSING ENV: SUPABASE_SERVICE_ROLE_KEY is not set');
    return res.status(503).json({
      error: 'Service configuration error',
      details: 'SUPABASE_SERVICE_ROLE_KEY environment variable is not set',
      fix: 'Add SUPABASE_SERVICE_ROLE_KEY to Vercel Environment Variables',
    });
  }

  // =========================================================================
  // STEP 2: Parse and validate query parameters
  // =========================================================================
  const firebase_uid = req.query.firebase_uid as string;
  const status = (req.query.status as string) || 'all';
  const from_date = req.query.from_date as string;
  const to_date = req.query.to_date as string;
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;

  if (!firebase_uid) {
    return res.status(400).json({
      error: 'Missing required query parameter: firebase_uid',
    });
  }

  if (status !== 'all' && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}, or "all"`,
    });
  }

  // =========================================================================
  // STEP 3: Create Supabase client (inside handler for fresh env vars)
  // =========================================================================
  let supabase;
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  } catch (clientError: any) {
    console.error('Failed to create Supabase client:', clientError);
    return res.status(500).json({
      error: 'Failed to initialize database client',
      details: clientError.message,
    });
  }

  // =========================================================================
  // STEP 4: Query session_bookings table
  // =========================================================================
  try {
    let query = supabase
      .from('session_bookings')
      .select('*', { count: 'exact' })
      .eq('firebase_uid', firebase_uid);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (from_date) {
      query = query.gte('session_date', from_date);
    }

    if (to_date) {
      query = query.lte('session_date', to_date);
    }

    query = query
      .order('session_date', { ascending: true })
      .order('time_slot', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: bookings, error: bookingsError, count } = await query;

    if (bookingsError) {
      console.error('Supabase query error:', bookingsError);
      return res.status(500).json({
        error: 'Database query failed',
        details: bookingsError.message,
        code: bookingsError.code,
        hint: bookingsError.hint,
      });
    }

    // =========================================================================
    // STEP 5: Handle empty results
    // =========================================================================
    if (!bookings || bookings.length === 0) {
      const response: MyBookingsResponse = {
        bookings: [],
        total_count: 0,
      };
      return res.status(200).json(response);
    }

    // =========================================================================
    // STEP 6: Fetch player names from registrations
    // =========================================================================
    const registrationIds = [...new Set(bookings.map((b: any) => b.registration_id).filter(Boolean))];

    let playerMap = new Map<string, { name: string; category: string }>();

    if (registrationIds.length > 0) {
      const { data: registrations, error: regError } = await supabase
        .from('registrations')
        .select('id, form_data')
        .in('id', registrationIds);

      if (regError) {
        console.warn('Failed to fetch registrations (non-fatal):', regError);
        // Continue without player names
      } else if (registrations) {
        registrations.forEach((r: any) => {
          playerMap.set(r.id, {
            name: r.form_data?.playerFullName || 'Unknown',
            category: r.form_data?.playerCategory || 'Unknown',
          });
        });
      }
    }

    // =========================================================================
    // STEP 7: Transform and return results
    // =========================================================================
    const bookingsWithDetails: SessionBookingWithDetails[] = bookings.map((b: any) => {
      const player = playerMap.get(b.registration_id) || { name: 'Unknown', category: 'Unknown' };
      return {
        id: b.id,
        firebase_uid: b.firebase_uid,
        registration_id: b.registration_id,
        session_type: b.session_type,
        session_date: b.session_date,
        time_slot: b.time_slot,
        credits_used: b.credits_used || 0,
        credit_purchase_id: b.credit_purchase_id,
        price_paid: b.price_paid,
        stripe_payment_intent_id: b.stripe_payment_intent_id,
        is_recurring: b.is_recurring || false,
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
      total_count: count || bookings.length,
    };

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('Unexpected error in my-bookings:', error);
    return res.status(500).json({
      error: 'Unexpected server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
