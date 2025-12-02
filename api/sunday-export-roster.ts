import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Sunday Roster Export API Endpoint (Admin Only)
 * GET /api/sunday-export-roster
 *
 * Exports the complete roster for a specific Sunday practice date as CSV.
 * Returns a downloadable CSV file with all bookings and attendance data.
 *
 * Query Parameters:
 *   - date: ISO date string (YYYY-MM-DD) of the Sunday to export
 *
 * Returns:
 *   - CSV file download with headers:
 *     Date, Time Slot, Age Group, Player Name, Category, Parent Name, Email, Phone, Attendance Status
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
    const { date } = req.query;

    // Validate date parameter
    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing date parameter. Use YYYY-MM-DD format',
        code: 'INVALID_DATE_FORMAT',
      });
    }

    // Get roster data using the database function
    const { data, error } = await getSupabase().rpc('get_sunday_roster', {
      p_practice_date: date,
    });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Database query failed',
        code: 'DATABASE_ERROR',
        details: error.message,
      });
    }

    if (!data.success || !data.roster || !data.roster.slots) {
      return res.status(404).json({
        success: false,
        error: 'No roster data found for this date',
        code: 'NO_DATA_FOUND',
      });
    }

    // Build CSV content
    const csvLines: string[] = [];

    // CSV Header
    csvLines.push('Date,Time Slot,Age Group,Player Name,Category,Parent Name,Email,Attendance Status,Notes');

    // Process each slot and booking
    const slots = data.roster.slots;
    for (const slot of slots) {
      const timeRange = slot.time_range;
      const ageGroup = `${slot.min_category} - ${slot.max_category}`;

      if (slot.bookings && slot.bookings.length > 0) {
        for (const booking of slot.bookings) {
          const row = [
            date,
            escapeCSV(timeRange),
            escapeCSV(ageGroup),
            escapeCSV(booking.player_name),
            escapeCSV(booking.player_category),
            escapeCSV(booking.parent_name),
            escapeCSV(booking.parent_email),
            escapeCSV(booking.attendance_status || 'pending'),
            escapeCSV(booking.attendance_notes || ''),
          ];
          csvLines.push(row.join(','));
        }
      } else {
        // Empty slot - add a row showing no bookings
        csvLines.push(`${date},"${timeRange}","${ageGroup}","(No bookings)","","","","",""`);
      }
    }

    const csvContent = csvLines.join('\n');

    // Set response headers for CSV download
    const filename = `sunday-roster-${date}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    return res.status(200).send(csvContent);
  } catch (error: any) {
    console.error('Sunday roster export error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to export Sunday roster',
      code: 'SERVER_ERROR',
    });
  }
}

/**
 * Helper function to escape CSV values
 * Wraps values in quotes if they contain commas, quotes, or newlines
 */
function escapeCSV(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';

  const stringValue = String(value);

  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}
