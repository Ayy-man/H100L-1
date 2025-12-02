import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Sunday Capacities API Endpoint
 * GET /api/sunday-capacities
 *
 * Gets capacity information for all upcoming Sunday practice sessions.
 * Used by admin panel to show at-a-glance booking status.
 *
 * Query Parameters:
 *   - startDate: ISO date string (optional, defaults to today)
 *   - endDate: ISO date string (optional, defaults to 3 months from start)
 *
 * Returns:
 *   - success: boolean
 *   - capacities: object mapping date strings to capacity info
 */

// Lazy-initialized Supabase client to avoid cold start issues
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
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { startDate, endDate } = req.query;

    // Default date range: today to 3 months from now
    const start = startDate ? new Date(startDate as string) : new Date();
    const end = endDate ? new Date(endDate as string) : new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Query all Sunday slots in date range
    const { data: slotsData, error: slotsError } = await getSupabase()
      .from('sunday_practice_slots')
      .select('practice_date, max_capacity, current_bookings')
      .gte('practice_date', start.toISOString().split('T')[0])
      .lte('practice_date', end.toISOString().split('T')[0])
      .eq('is_active', true)
      .order('practice_date');

    if (slotsError) {
      console.error('Database error:', slotsError);
      return res.status(500).json({
        success: false,
        error: 'Database query failed',
        details: slotsError.message,
      });
    }

    // Aggregate capacity by date
    const capacities: Record<string, { total: number; booked: number }> = {};

    if (slotsData) {
      for (const slot of slotsData) {
        const dateKey = slot.practice_date;
        if (!capacities[dateKey]) {
          capacities[dateKey] = { total: 0, booked: 0 };
        }
        capacities[dateKey].total += slot.max_capacity || 0;
        capacities[dateKey].booked += slot.current_bookings || 0;
      }
    }

    return res.status(200).json({
      success: true,
      capacities,
    });
  } catch (error: any) {
    console.error('Sunday capacities error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get Sunday capacities',
    });
  }
}
