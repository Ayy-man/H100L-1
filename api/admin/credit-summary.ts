import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Create Supabase admin client - done once per request
function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Get current date for expiry calculations
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 1. Total parents with credits
    const { data: totalParents, error: totalParentsError } = await supabase
      .from('parent_credits')
      .select('firebase_uid');

    if (totalParentsError) {
      console.error('Error fetching parent_credits:', totalParentsError);
      // Continue with empty data instead of throwing
    }

    // 2. Total credits in system
    const { data: totalCreditsData, error: totalCreditsError } = await supabase
      .from('parent_credits')
      .select('total_credits');

    if (totalCreditsError) {
      console.error('Error fetching total_credits:', totalCreditsError);
    }

    const totalCredits = totalCreditsData?.reduce((sum, pc) => sum + (pc.total_credits || 0), 0) || 0;

    // 3. Active purchases with credits remaining (for expiry calculations)
    const { data: activePurchases, error: activePurchasesError } = await supabase
      .from('credit_purchases')
      .select('id, credits_remaining, expires_at, firebase_uid, package_type')
      .gt('credits_remaining', 0)
      .eq('status', 'active');

    if (activePurchasesError) {
      console.error('Error fetching active purchases:', activePurchasesError);
    }

    // Calculate expiring credits
    let expiring30Days = 0;
    let expiring7Days = 0;
    let expiring1Day = 0;

    activePurchases?.forEach(purchase => {
      const expiresAt = new Date(purchase.expires_at);
      if (expiresAt <= thirtyDaysFromNow) expiring30Days += purchase.credits_remaining;
      if (expiresAt <= sevenDaysFromNow) expiring7Days += purchase.credits_remaining;
      if (expiresAt <= oneDayFromNow) expiring1Day += purchase.credits_remaining;
    });

    // 4. Total revenue from credit purchases
    const { data: allPurchases, error: allPurchasesError } = await supabase
      .from('credit_purchases')
      .select('price_paid, created_at, package_type, status')
      .eq('status', 'completed');

    if (allPurchasesError) {
      console.error('Error fetching all purchases:', allPurchasesError);
    }

    const totalRevenue = allPurchases?.reduce((sum, p) => sum + (Number(p.price_paid) || 0), 0) || 0;

    // 5. Monthly revenue (current month)
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const monthlyRevenue = allPurchases?.filter(p =>
      new Date(p.created_at) >= currentMonth
    ).reduce((sum, p) => sum + (Number(p.price_paid) || 0), 0) || 0;

    // 6. Credits used today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: usageData, error: usageError } = await supabase
      .from('session_bookings')
      .select('credits_used, created_at')
      .eq('status', 'confirmed')
      .gte('created_at', today.toISOString());

    if (usageError) {
      console.error('Error fetching usage data:', usageError);
    }

    const creditsUsedToday = usageData?.reduce((sum, b) => sum + (b.credits_used || 0), 0) || 0;

    // 7. Credits used this month
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const { data: monthlyUsageData, error: monthlyUsageError } = await supabase
      .from('session_bookings')
      .select('credits_used')
      .eq('status', 'confirmed')
      .gte('created_at', firstDayOfMonth.toISOString());

    if (monthlyUsageError) {
      console.error('Error fetching monthly usage:', monthlyUsageError);
    }

    const creditsUsedThisMonth = monthlyUsageData?.reduce((sum, b) => sum + (b.credits_used || 0), 0) || 0;

    // 8. Package distribution from completed purchases
    const packageStats = allPurchases?.reduce((acc, p) => {
      const type = p.package_type || 'single';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // 9. Recent credit adjustments (last 10)
    const { data: recentActivity, error: activityError } = await supabase
      .from('credit_adjustments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (activityError) {
      console.error('Error fetching credit adjustments:', activityError);
      // Table might not exist - continue with empty array
    }

    // 10. Recent purchases (NEW - for Recent Payments section)
    const { data: recentPurchases, error: recentPurchasesError } = await supabase
      .from('credit_purchases')
      .select('id, firebase_uid, package_type, credits_purchased, price_paid, status, created_at, stripe_checkout_session_id')
      .order('created_at', { ascending: false })
      .limit(15);

    if (recentPurchasesError) {
      console.error('Error fetching recent purchases:', recentPurchasesError);
    }

    // Enrich recent purchases with parent emails
    const enrichedRecentPurchases = [];
    if (recentPurchases && recentPurchases.length > 0) {
      // Get unique firebase_uids
      const uids = [...new Set(recentPurchases.map(p => p.firebase_uid))];

      // Fetch parent emails from registrations table
      const { data: parentData } = await supabase
        .from('registrations')
        .select('form_data')
        .in('form_data->>firebase_uid', uids);

      // Build email lookup map
      const emailMap: Record<string, string> = {};
      parentData?.forEach(reg => {
        const uid = reg.form_data?.firebase_uid;
        const email = reg.form_data?.parentEmail || reg.form_data?.email;
        if (uid && email) {
          emailMap[uid] = email;
        }
      });

      // Enrich purchases with emails
      for (const purchase of recentPurchases) {
        enrichedRecentPurchases.push({
          ...purchase,
          parent_email: emailMap[purchase.firebase_uid] || 'Unknown'
        });
      }
    }

    // 11. Daily revenue for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyRevenue = allPurchases?.filter(p =>
      new Date(p.created_at) >= thirtyDaysAgo
    ).reduce((acc, p) => {
      const date = new Date(p.created_at).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + (Number(p.price_paid) || 0);
      return acc;
    }, {} as Record<string, number>) || {};

    // Generate array of last 30 days with revenue
    const revenueChart = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      const dateStr = date.toISOString().split('T')[0];
      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: dailyRevenue[dateStr] || 0
      };
    });

    // Return comprehensive summary
    res.status(200).json({
      overview: {
        totalParents: totalParents?.length || 0,
        totalCredits,
        activePurchases: activePurchases?.length || 0,
        totalRevenue: Math.round(totalRevenue * 100), // Convert to cents for consistency
        monthlyRevenue: Math.round(monthlyRevenue * 100),
        creditsUsedToday,
        creditsUsedThisMonth
      },
      expiry: {
        expiring30Days,
        expiring7Days,
        expiring1Day
      },
      packageDistribution: packageStats,
      recentActivity: recentActivity || [],
      recentPurchases: enrichedRecentPurchases,
      revenueChart
    });

  } catch (error) {
    console.error('Error fetching credit summary:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to fetch credit summary', details: message });
  }
}
