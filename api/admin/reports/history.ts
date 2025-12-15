import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Inline Supabase client - lib/supabase.ts is not bundled by Vercel
let _getSupabaseAdmin(): ReturnType<typeof createClient> | null = null;
const getSupabaseAdmin = () => {
  if (!_getSupabaseAdmin()) {
    _getSupabaseAdmin() = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _getSupabaseAdmin();
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit = 50, offset = 0, template_id } = req.query;

    let query = getSupabaseAdmin()
      .from('report_history')
      .select(`
        *,
        report_template:report_templates(name, report_type)
      `)
      .order('created_at', { ascending: false })
      .limit(Number(limit))
      .offset(Number(offset));

    if (template_id) {
      query = query.eq('template_id', template_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({ reports: data || [] });
  } catch (error) {
    console.error('Error fetching report history:', error);
    res.status(500).json({ error: 'Failed to fetch report history' });
  }
}