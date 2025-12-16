import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Inline types (Vercel bundling doesn't resolve ../types/credits)
type CreditPackageType = 'single' | '10_pack' | '20_pack' | '50_pack';
type CreditPurchaseStatus = 'active' | 'expired' | 'exhausted';

interface CreditPurchaseInfo {
  id: string;
  package_type: CreditPackageType;
  credits_remaining: number;
  expires_at: string;
  status: CreditPurchaseStatus;
}

interface CreditBalanceResponse {
  total_credits: number;
  purchases: CreditPurchaseInfo[];
}

interface CreditBalanceSummary {
  total_credits: number;
  expiring_soon: number;
  next_expiry_date: string | null;
}

// Inline Supabase client for Vercel bundling
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const firebase_uid = req.query.firebase_uid as string;

    // Validate required field
    if (!firebase_uid) {
      return res.status(400).json({
        error: 'Missing required query parameter: firebase_uid',
      });
    }

    const supabase = getSupabase();

    // Get parent credit balance
    const { data: parentCredits, error: creditError } = await supabase
      .from('parent_credits')
      .select('total_credits')
      .eq('firebase_uid', firebase_uid)
      .single();

    if (creditError && creditError.code !== 'PGRST116') {
      console.error('Error fetching credit balance:', creditError);
      return res.status(500).json({ error: 'Database error' });
    }

    const totalCredits = parentCredits?.total_credits || 0;

    // Get active credit purchases with remaining credits
    const { data: purchases, error: purchaseError } = await supabase
      .from('credit_purchases')
      .select('id, package_type, credits_remaining, expires_at, status')
      .eq('firebase_uid', firebase_uid)
      .eq('status', 'active')
      .gt('credits_remaining', 0)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true });

    if (purchaseError) {
      console.error('Error fetching purchases:', purchaseError);
      return res.status(500).json({ error: 'Database error' });
    }

    // Calculate credits expiring in next 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringSoon = (purchases || [])
      .filter((p) => new Date(p.expires_at) <= thirtyDaysFromNow)
      .reduce((sum, p) => sum + p.credits_remaining, 0);

    const nextExpiry = purchases && purchases.length > 0
      ? purchases[0].expires_at
      : null;

    const purchaseInfo: CreditPurchaseInfo[] = (purchases || []).map((p) => ({
      id: p.id,
      package_type: p.package_type,
      credits_remaining: p.credits_remaining,
      expires_at: p.expires_at,
      status: p.status,
    }));

    const response: CreditBalanceResponse & { summary: CreditBalanceSummary } = {
      total_credits: totalCredits,
      purchases: purchaseInfo,
      summary: {
        total_credits: totalCredits,
        expiring_soon: expiringSoon,
        next_expiry_date: nextExpiry,
      },
    };

    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Credit balance error:', error);
    return res.status(500).json({
      error: 'Failed to fetch credit balance',
    });
  }
}
