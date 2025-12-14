import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit = 50, offset = 0, template_id } = req.query;

    let query = supabaseAdmin
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