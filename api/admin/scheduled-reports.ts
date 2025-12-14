import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      return handleGet(req, res);
    case 'POST':
      return handlePost(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${method} Not Allowed` });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { status } = req.query;

    let query = supabaseAdmin
      .from('scheduled_reports')
      .select(`
        *,
        report_template:report_templates(name, report_type)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({ reports: data || [] });
  } catch (error) {
    console.error('Error fetching scheduled reports:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled reports' });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  try {
    const report = req.body;

    const { data, error } = await supabaseAdmin
      .from('scheduled_reports')
      .insert({
        ...report,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ report: data });
  } catch (error) {
    console.error('Error creating scheduled report:', error);
    res.status(500).json({ error: 'Failed to create scheduled report' });
  }
}