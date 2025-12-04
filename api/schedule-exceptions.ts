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
 * Schedule Exceptions API
 *
 * GET /api/schedule-exceptions?registrationId=xxx
 * Returns all active schedule exceptions for a registration
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { registrationId } = req.query;

    if (!registrationId || typeof registrationId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: registrationId'
      });
    }

    // Fetch schedule exceptions for this registration
    // Only get exceptions that are applied and for future/current dates
    // Use local date formatting to match how dates are stored
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;


    const { data: exceptions, error } = await getSupabase()
      .from('schedule_exceptions')
      .select('*')
      .eq('registration_id', registrationId)
      .eq('status', 'applied')
      .gte('exception_date', today)
      .order('exception_date', { ascending: true });

    if (error) {
      console.error('Error fetching schedule exceptions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch schedule exceptions'
      });
    }

    exceptions?.forEach((exc, i) => {
    });

    return res.status(200).json({
      success: true,
      exceptions: exceptions || [],
      debug: {
        today,
        registrationId,
        count: exceptions?.length || 0
      }
    });

  } catch (error) {
    console.error('Error in schedule-exceptions:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
// Redeploy trigger
