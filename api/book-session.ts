import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import type {
  BookSessionRequest,
  BookSessionResponse,
  SessionType,
} from '../types/credits';
import { isSessionType, CREDITS_PER_SESSION, MAX_GROUP_CAPACITY } from '../types/credits';

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
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      firebase_uid,
      registration_id,
      session_type,
      session_date,
      time_slot,
      is_recurring = false,
    } = req.body as BookSessionRequest;

    // Validate required fields
    if (!firebase_uid || !registration_id || !session_type || !session_date || !time_slot) {
      return res.status(400).json({
        error: 'Missing required fields: firebase_uid, registration_id, session_type, session_date, time_slot',
      });
    }

    // Validate session type
    if (!isSessionType(session_type)) {
      return res.status(400).json({
        error: 'Invalid session_type. Must be "group", "sunday", "private", or "semi_private"',
      });
    }

    // Check if this session type uses credits or direct payment
    const creditsRequired = CREDITS_PER_SESSION[session_type];

    // If no credits required, redirect to purchase-session endpoint
    if (creditsRequired === 0) {
      return res.status(400).json({
        error: `${session_type} sessions are purchased directly. Use /api/purchase-session endpoint.`,
        redirect: '/api/purchase-session',
      });
    }
    const supabase = getSupabase();

    // Verify registration belongs to this user
    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select('id, firebase_uid')
      .eq('id', registration_id)
      .eq('firebase_uid', firebase_uid)
      .single();

    if (regError || !registration) {
      return res.status(404).json({
        error: 'Registration not found or does not belong to this user',
      });
    }

    // Check slot availability
    const { data: slotCapacity, error: capacityError } = await supabase
      .rpc('get_slot_capacity', {
        p_session_date: session_date,
        p_time_slot: time_slot,
        p_session_type: session_type,
        p_max_capacity: MAX_GROUP_CAPACITY,
      });

    if (capacityError) {
      console.error('Error checking capacity:', capacityError);
      return res.status(500).json({ error: 'Failed to check availability' });
    }

    if (!slotCapacity || slotCapacity.length === 0 || !slotCapacity[0].is_available) {
      return res.status(409).json({
        error: 'This time slot is fully booked. Please select another time.',
      });
    }

    // Check existing booking to prevent duplicates
    const { data: existingBooking } = await supabase
      .from('session_bookings')
      .select('id')
      .eq('registration_id', registration_id)
      .eq('session_date', session_date)
      .eq('time_slot', time_slot)
      .eq('session_type', session_type)
      .neq('status', 'cancelled')
      .single();

    if (existingBooking) {
      return res.status(409).json({
        error: 'This child already has a booking for this session',
      });
    }

    // Check credit balance
    const { data: parentCredits, error: creditError } = await supabase
      .from('parent_credits')
      .select('total_credits')
      .eq('firebase_uid', firebase_uid)
      .single();

    if (creditError && creditError.code !== 'PGRST116') {
      console.error('Error checking credits:', creditError);
      return res.status(500).json({ error: 'Database error' });
    }

    const currentCredits = parentCredits?.total_credits || 0;

    if (currentCredits < creditsRequired) {
      return res.status(402).json({
        error: `Insufficient credits. You have ${currentCredits} credit(s), but ${creditsRequired} is required.`,
        credits_required: creditsRequired,
        credits_available: currentCredits,
      });
    }

    // Deduct credit using the database function (FIFO)
    const { data: purchaseId, error: deductError } = await supabase
      .rpc('deduct_credit', {
        p_firebase_uid: firebase_uid,
        p_credits_to_deduct: creditsRequired,
      });

    if (deductError) {
      console.error('Error deducting credit:', deductError);
      return res.status(500).json({
        error: 'Failed to deduct credit. Please try again.',
      });
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('session_bookings')
      .insert({
        firebase_uid,
        registration_id,
        session_type,
        session_date,
        time_slot,
        credits_used: creditsRequired,
        credit_purchase_id: purchaseId,
        is_recurring,
        status: 'booked',
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Error creating booking:', bookingError);
      // Try to refund the credit since booking failed
      await supabase.rpc('refund_credit', {
        p_firebase_uid: firebase_uid,
        p_purchase_id: purchaseId,
        p_credits_to_refund: creditsRequired,
      });
      return res.status(500).json({
        error: 'Failed to create booking. Credit has been refunded.',
      });
    }

    // Get updated credit balance
    const { data: updatedCredits } = await supabase
      .from('parent_credits')
      .select('total_credits')
      .eq('firebase_uid', firebase_uid)
      .single();

    const response: BookSessionResponse = {
      booking,
      credits_remaining: updatedCredits?.total_credits || 0,
      message: `Session booked successfully! ${creditsRequired} credit used.`,
    };

    return res.status(201).json(response);
  } catch (error: any) {
    console.error('Book session error:', error);
    return res.status(500).json({
      error: 'Failed to book session',
    });
  }
}
