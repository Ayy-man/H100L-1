import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Cron Job: Generate Sunday Practice Slots
 * Schedule: Every Monday at midnight (0 0 * * 1)
 *
 * This cron job automatically generates Sunday practice time slots
 * for the upcoming weeks. It's called weekly to ensure slots are
 * always available for parents to book.
 *
 * Configuration:
 * - Generates slots for 4 weeks ahead
 * - Creates 2 time slots per Sunday:
 *   - 7:30-8:30 AM (M11 to M13 Elite)
 *   - 8:30-9:30 AM (M13 to Junior)
 * - Each slot has 6 player capacity
 * - Skips Sundays that already have slots
 *
 * Security:
 * - Vercel cron jobs are authenticated automatically
 * - Uses service role key for database access
 * - Validates cron secret header for additional security
 */

// Initialize Supabase with service role for admin access
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow GET requests (Vercel cron uses GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate cron authorization header (Vercel sets this automatically)
  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // If CRON_SECRET is not set, allow in development
    if (process.env.NODE_ENV === 'production') {
      console.error('Unauthorized cron request');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    console.log('[CRON] Starting Sunday slots generation...');

    // Call the database function to generate slots
    const { data, error } = await supabase.rpc('generate_sunday_slots', {
      p_weeks_ahead: 4, // Generate slots 4 weeks in advance
    });

    if (error) {
      console.error('[CRON] Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Database query failed',
        details: error.message,
      });
    }

    // Log the result
    console.log('[CRON] Slot generation result:', data);

    if (!data.success) {
      console.error('[CRON] Generation failed:', data.error);
      return res.status(500).json({
        success: false,
        error: data.error || 'Slot generation failed',
        code: data.code,
      });
    }

    // Success
    console.log(`[CRON] Successfully generated ${data.slots_created} slots`);

    return res.status(200).json({
      success: true,
      slots_created: data.slots_created,
      message: data.message,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[CRON] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate Sunday slots',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Manual Testing:
 *
 * To manually test this cron job locally:
 * 1. Make sure CRON_SECRET is NOT set in your .env (or set NODE_ENV to development)
 * 2. Visit: http://localhost:5173/api/cron-generate-sunday-slots
 *
 * To test in production:
 * 1. Set CRON_SECRET environment variable in Vercel
 * 2. Use curl with authorization header:
 *    curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.vercel.app/api/cron-generate-sunday-slots
 *
 * Vercel Cron Configuration:
 * - The schedule "0 0 * * 1" means: Every Monday at midnight UTC
 * - Adjust timezone in Vercel dashboard if needed
 * - Monitor cron job execution in Vercel dashboard logs
 */
