import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get current date for expiry calculations
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 1. Total parents with credits
    const { data: totalParents, error: totalParentsError } = await supabaseAdmin
      .from('parent_credits')
      .select('firebase_uid');

    if (totalParentsError) throw totalParentsError;

    // 2. Total credits in system
    const { data: totalCreditsData, error: totalCreditsError } = await supabaseAdmin
      .from('parent_credits')
      .select('credits_remaining');

    if (totalCreditsError) throw totalCreditsError;

    const totalCredits = totalCreditsData?.reduce((sum, pc) => sum + pc.credits_remaining, 0) || 0;

    // 3. Expiring credits
    const { data: expiringCredits, error: expiringError } = await supabaseAdmin
      .from('credit_purchases')
      .select('credits_remaining, expires_at, firebase_uid')
      .gt('credits_remaining', 0);

    if (expiringError) throw expiringError;

    let expiring30Days = 0;
    let expiring7Days = 0;
    let expiring1Day = 0;

    expiringCredits?.forEach(purchase => {
      const expiresAt = new Date(purchase.expires_at);
      if (expiresAt <= thirtyDaysFromNow) expiring30Days += purchase.credits_remaining;
      if (expiresAt <= sevenDaysFromNow) expiring7Days += purchase.credits_remaining;
      if (expiresAt <= oneDayFromNow) expiring1Day += purchase.credits_remaining;
    });

    // 4. Total revenue from credit purchases
    const { data: revenueData, error: revenueError } = await supabaseAdmin
      .from('credit_purchases')
      .select('amount, created_at');

    if (revenueError) throw revenueError;

    const totalRevenue = revenueData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    // 5. Monthly revenue (current month)
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const monthlyRevenue = revenueData?.filter(p =>
      new Date(p.created_at) >= currentMonth
    ).reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    // 6. Credits used today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: usageData, error: usageError } = await supabaseAdmin
      .from('session_bookings')
      .select('credits_used, created_at')
      .eq('status', 'confirmed')
      .gte('created_at', today.toISOString());

    if (usageError) throw usageError;

    const creditsUsedToday = usageData?.reduce((sum, b) => sum + (b.credits_used || 0), 0) || 0;

    // 7. Active purchases (non-zero balance)
    const activePurchases = expiringCredits?.length || 0;

    // 8. Credits used this month
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const { data: monthlyUsageData, error: monthlyUsageError } = await supabaseAdmin
      .from('session_bookings')
      .select('credits_used')
      .eq('status', 'confirmed')
      .gte('created_at', firstDayOfMonth.toISOString());

    if (monthlyUsageError) throw monthlyUsageError;

    const creditsUsedThisMonth = monthlyUsageData?.reduce((sum, b) => sum + (b.credits_used || 0), 0) || 0;

    // 9. Package distribution
    const { data: packageData, error: packageError } = await supabaseAdmin
      .from('credit_purchases')
      .select('package_type, credits')
      .eq('status', 'completed');

    if (packageError) throw packageError;

    const packageStats = packageData?.reduce((acc, p) => {
      const type = p.package_type || 'single';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 10. Recent activity (last 10 adjustments)
    const { data: recentActivity, error: activityError } = await supabaseAdmin
      .from('credit_adjustments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (activityError) throw activityError;

    // 11. Daily revenue for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const { data: dailyRevenueData, error: dailyRevenueError } = await supabaseAdmin
      .from('credit_purchases')
      .select('amount, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .eq('status', 'completed');

    if (dailyRevenueError) throw dailyRevenueError;

    const dailyRevenue = dailyRevenueData?.reduce((acc, p) => {
      const date = new Date(p.created_at).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + (p.amount || 0);
      return acc;
    }, {} as Record<string, number>);

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
        activePurchases,
        totalRevenue,
        monthlyRevenue,
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
      revenueChart
    });

  } catch (error) {
    console.error('Error fetching credit summary:', error);
    res.status(500).json({ error: 'Failed to fetch credit summary' });
  }
}