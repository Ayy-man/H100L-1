import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Inline types for Vercel bundling
type SessionType = 'group' | 'sunday' | 'private' | 'semi_private';
type BookingStatus = 'confirmed' | 'cancelled' | 'attended' | 'no_show';

interface BookingWithDetails {
  id: string;
  firebase_uid: string;
  registration_id: string;
  session_type: SessionType;
  session_date: string;
  time_slot: string;
  status: BookingStatus;
  credits_used: number;
  amount_paid: number | null;
  stripe_payment_id: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  player_name: string;
  player_category: string;
  parent_email: string | null;
}

// Use service role key to bypass RLS
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
  try {
    const supabase = getSupabase();

    switch (req.method) {
      case 'GET':
        return handleGet(req, res, supabase);
      case 'PUT':
        return handlePut(req, res, supabase);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Admin bookings handler error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// GET: Fetch bookings with filters
async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  supabase: ReturnType<typeof createClient>
) {
  try {
    const {
      date_start,
      date_end,
      status,
      session_type,
      search,
    } = req.query;

    let query = supabase
      .from('session_bookings')
      .select(`
        *,
        registrations!inner (
          form_data,
          parent_email
        )
      `)
      .order('session_date', { ascending: true })
      .order('time_slot', { ascending: true });

    // Apply date range filter
    if (date_start) {
      query = query.gte('session_date', date_start as string);
    }
    if (date_end) {
      query = query.lte('session_date', date_end as string);
    }

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status as string);
    }

    // Apply session type filter
    if (session_type && session_type !== 'all') {
      query = query.eq('session_type', session_type as string);
    }

    const { data: bookings, error } = await query;

    if (error) {
      console.error('Error fetching bookings:', error);
      return res.status(500).json({ error: 'Database error fetching bookings' });
    }

    // Transform bookings to include player details
    const transformedBookings: BookingWithDetails[] = (bookings || []).map((booking: any) => ({
      id: booking.id,
      firebase_uid: booking.firebase_uid,
      registration_id: booking.registration_id,
      session_type: booking.session_type,
      session_date: booking.session_date,
      time_slot: booking.time_slot,
      status: booking.status,
      credits_used: booking.credits_used,
      amount_paid: booking.amount_paid,
      stripe_payment_id: booking.stripe_payment_id,
      cancellation_reason: booking.cancellation_reason,
      created_at: booking.created_at,
      updated_at: booking.updated_at,
      player_name: booking.registrations?.form_data?.playerFullName || 'Unknown',
      player_category: booking.registrations?.form_data?.playerCategory || 'Unknown',
      parent_email: booking.registrations?.parent_email || null,
    }));

    // Apply search filter (after transform to search player names)
    let filteredBookings = transformedBookings;
    if (search && typeof search === 'string' && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredBookings = transformedBookings.filter(
        (b) =>
          b.player_name.toLowerCase().includes(searchLower) ||
          (b.parent_email && b.parent_email.toLowerCase().includes(searchLower))
      );
    }

    // Calculate summary stats
    const stats = {
      total: filteredBookings.length,
      confirmed: filteredBookings.filter((b) => b.status === 'confirmed').length,
      attended: filteredBookings.filter((b) => b.status === 'attended').length,
      cancelled: filteredBookings.filter((b) => b.status === 'cancelled').length,
      no_show: filteredBookings.filter((b) => b.status === 'no_show').length,
      credits_used: filteredBookings.reduce((sum, b) => sum + (b.credits_used || 0), 0),
      direct_revenue: filteredBookings.reduce((sum, b) => sum + (b.amount_paid || 0), 0),
      by_type: {
        group: filteredBookings.filter((b) => b.session_type === 'group').length,
        sunday: filteredBookings.filter((b) => b.session_type === 'sunday').length,
        private: filteredBookings.filter((b) => b.session_type === 'private').length,
        semi_private: filteredBookings.filter((b) => b.session_type === 'semi_private').length,
      },
    };

    return res.status(200).json({
      bookings: filteredBookings,
      stats,
    });
  } catch (error: any) {
    console.error('Get bookings error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch bookings' });
  }
}

// PUT: Update booking status
async function handlePut(
  req: VercelRequest,
  res: VercelResponse,
  supabase: ReturnType<typeof createClient>
) {
  try {
    const { booking_id, status, cancellation_reason } = req.body;

    if (!booking_id) {
      return res.status(400).json({ error: 'booking_id is required' });
    }

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const validStatuses = ['confirmed', 'cancelled', 'attended', 'no_show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Fetch current booking to check if it exists
    const { data: existingBooking, error: fetchError } = await supabase
      .from('session_bookings')
      .select('id, status, credits_used, firebase_uid')
      .eq('id', booking_id)
      .single();

    if (fetchError || !existingBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // If cancelling and credits were used, refund them
    let creditsRefunded = 0;
    if (status === 'cancelled' && existingBooking.status === 'confirmed' && existingBooking.credits_used > 0) {
      const { error: refundError } = await supabase
        .from('parent_credits')
        .update({
          total_credits: supabase.rpc('increment_credits', {
            uid: existingBooking.firebase_uid,
            amount: existingBooking.credits_used,
          }),
        })
        .eq('firebase_uid', existingBooking.firebase_uid);

      // Alternative: direct increment
      const { data: parentCredits } = await supabase
        .from('parent_credits')
        .select('total_credits')
        .eq('firebase_uid', existingBooking.firebase_uid)
        .single();

      if (parentCredits) {
        await supabase
          .from('parent_credits')
          .update({
            total_credits: parentCredits.total_credits + existingBooking.credits_used,
          })
          .eq('firebase_uid', existingBooking.firebase_uid);
        creditsRefunded = existingBooking.credits_used;
      }
    }

    // Update booking status
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'cancelled' && cancellation_reason) {
      updateData.cancellation_reason = cancellation_reason;
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from('session_bookings')
      .update(updateData)
      .eq('id', booking_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return res.status(500).json({ error: 'Failed to update booking' });
    }

    return res.status(200).json({
      booking: updatedBooking,
      message: `Booking status updated to ${status}`,
      credits_refunded: creditsRefunded,
    });
  } catch (error: any) {
    console.error('Update booking error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update booking' });
  }
}
