import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      return handleGet(req, res);
    case 'POST':
      return handlePost(req, res);
    case 'PUT':
      return handlePut(req, res);
    case 'DELETE':
      return handleDelete(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).json({ error: `Method ${method} Not Allowed` });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { report_type } = req.query;

    let query = supabaseAdmin
      .from('report_templates')
      .select('*')
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false });

    if (report_type) {
      query = query.eq('report_type', report_type);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({ templates: data || [] });
  } catch (error) {
    console.error('Error fetching report templates:', error);
    res.status(500).json({ error: 'Failed to fetch report templates' });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  try {
    const template = req.body;

    const { data, error } = await supabaseAdmin
      .from('report_templates')
      .insert({
        ...template,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ template: data });
  } catch (error) {
    console.error('Error creating report template:', error);
    res.status(500).json({ error: 'Failed to create report template' });
  }
}

async function handlePut(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('report_templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ template: data });
  } catch (error) {
    console.error('Error updating report template:', error);
    res.status(500).json({ error: 'Failed to update report template' });
  }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    const { error } = await supabaseAdmin
      .from('report_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(204).end();
  } catch (error) {
    console.error('Error deleting report template:', error);
    res.status(500).json({ error: 'Failed to delete report template' });
  }
}