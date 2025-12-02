import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

/**
 * Group Capacity API
 *
 * GET /api/group-capacity?days=monday,tuesday
 * Returns capacity information for specified days
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { days } = req.query;

    if (!days || typeof days !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: days (comma-separated list)'
      });
    }

    const dayList = days.toLowerCase().split(',').map(d => d.trim());

    // Fetch capacity for each day
    const capacityResults = await Promise.all(
      dayList.map(async (day) => {
        const { data: bookings, error } = await getSupabase()
          .from('registrations')
          .select('form_data, id')
          .in('payment_status', ['succeeded', 'verified'])
          .contains('form_data->groupSelectedDays', [day]);

        if (error) {
          console.error(`Error checking capacity for ${day}:`, error);
          return {
            day,
            spotsUsed: 0,
            spotsRemaining: 6,
            totalCapacity: 6,
            error: 'Failed to check capacity'
          };
        }

        // Count only group training registrations
        const currentBookings = bookings?.filter(
          b => b.form_data?.programType === 'group'
        ).length || 0;

        const spotsRemaining = Math.max(0, 6 - currentBookings);

        return {
          day,
          spotsUsed: currentBookings,
          spotsRemaining,
          totalCapacity: 6,
          isFull: spotsRemaining === 0
        };
      })
    );

    return res.status(200).json({
      success: true,
      capacity: capacityResults.reduce((acc, item) => {
        acc[item.day] = item;
        return acc;
      }, {} as Record<string, typeof capacityResults[0]>)
    });

  } catch (error) {
    console.error('Error in group-capacity:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
