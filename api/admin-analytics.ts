import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

// Types matching AdminDashboard expectations
interface DailyRegistration {
  date: string;
  count: number;
  paid_count: number;
  pending_count: number;
}

interface ProgramDistribution {
  program_type: string;
  count: number;
  percentage: number;
}

interface RevenueByProgram {
  program_type: string;
  registrations: number;
  paid_registrations: number;
  estimated_monthly_revenue: number;
}

interface AgeCategoryDistribution {
  category: string;
  count: number;
  percentage: number;
}

interface AnalyticsSummary {
  total_registrations: number;
  paid_registrations: number;
  total_mrr: number;
  avg_registration_value: number;
  fill_rate_percentage: number;
  this_week_registrations: number;
  last_week_registrations: number;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();

    // Run all queries in parallel for faster response
    const [registrationsResult, creditPurchasesResult, bookingsResult] = await Promise.all([
      supabase
        .from('registrations')
        .select('id, created_at, form_data, payment_status')
        .order('created_at', { ascending: false }),
      supabase
        .from('credit_purchases')
        .select('id, amount, credits, created_at, status')
        .eq('status', 'completed'),
      supabase
        .from('session_bookings')
        .select('id, session_type, session_date, credits_used, amount_paid, status, created_at'),
    ]);

    if (registrationsResult.error) {
      console.error('Error fetching registrations:', registrationsResult.error);
      return res.status(500).json({ error: 'Failed to fetch registrations' });
    }

    if (creditPurchasesResult.error) {
      console.error('Error fetching credit purchases:', creditPurchasesResult.error);
    }

    if (bookingsResult.error) {
      console.error('Error fetching bookings:', bookingsResult.error);
    }

    const regs = registrationsResult.data || [];
    const purchases = creditPurchasesResult.data || [];
    const sessions = bookingsResult.data || [];

    // Calculate daily registrations (last 30 days)
    const dailyRegistrations = calculateDailyRegistrations(regs);

    // Calculate program distribution (based on bookings)
    const programDistribution = calculateProgramDistribution(sessions);

    // Calculate revenue by program
    const revenueByProgram = calculateRevenueByProgram(sessions, purchases);

    // Calculate age category distribution
    const ageDistribution = calculateAgeDistribution(regs);

    // Calculate summary
    const summary = calculateSummary(regs, purchases, sessions);

    return res.status(200).json({
      dailyRegistrations,
      programDistribution,
      revenueByProgram,
      ageDistribution,
      summary,
    });
  } catch (error: any) {
    console.error('Admin analytics error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

function calculateDailyRegistrations(registrations: any[]): DailyRegistration[] {
  const last30Days: DailyRegistration[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const dayRegs = registrations.filter((r) => {
      const regDate = new Date(r.created_at).toISOString().split('T')[0];
      return regDate === dateStr;
    });

    last30Days.push({
      date: dateStr,
      count: dayRegs.length,
      paid_count: dayRegs.filter((r) => r.payment_status === 'verified').length,
      pending_count: dayRegs.filter((r) => r.payment_status !== 'verified').length,
    });
  }

  return last30Days;
}

function calculateProgramDistribution(bookings: any[]): ProgramDistribution[] {
  const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
  const total = activeBookings.length || 1; // Avoid division by zero

  const byType: Record<string, number> = {
    group: 0,
    sunday: 0,
    private: 0,
    semi_private: 0,
  };

  activeBookings.forEach((b) => {
    if (byType.hasOwnProperty(b.session_type)) {
      byType[b.session_type]++;
    }
  });

  const labels: Record<string, string> = {
    group: 'Group Training',
    sunday: 'Sunday Ice',
    private: 'Private Training',
    semi_private: 'Semi-Private',
  };

  return Object.entries(byType).map(([type, count]) => ({
    program_type: labels[type] || type,
    count,
    percentage: Math.round((count / total) * 100),
  }));
}

function calculateRevenueByProgram(bookings: any[], purchases: any[]): RevenueByProgram[] {
  const activeBookings = bookings.filter((b) => b.status !== 'cancelled');

  // Credit value estimation (average from purchases)
  const totalCreditRevenue = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalCredits = purchases.reduce((sum, p) => sum + (p.credits || 0), 0);
  const creditValue = totalCredits > 0 ? totalCreditRevenue / totalCredits : 4500; // Default $45 per credit in cents

  const byType: Record<string, { count: number; directRevenue: number; creditsUsed: number }> = {
    group: { count: 0, directRevenue: 0, creditsUsed: 0 },
    sunday: { count: 0, directRevenue: 0, creditsUsed: 0 },
    private: { count: 0, directRevenue: 0, creditsUsed: 0 },
    semi_private: { count: 0, directRevenue: 0, creditsUsed: 0 },
  };

  activeBookings.forEach((b) => {
    if (byType.hasOwnProperty(b.session_type)) {
      byType[b.session_type].count++;
      byType[b.session_type].directRevenue += b.amount_paid || 0;
      byType[b.session_type].creditsUsed += b.credits_used || 0;
    }
  });

  const labels: Record<string, string> = {
    group: 'Group Training',
    sunday: 'Sunday Ice',
    private: 'Private Training',
    semi_private: 'Semi-Private',
  };

  return Object.entries(byType).map(([type, data]) => ({
    program_type: labels[type] || type,
    registrations: data.count,
    paid_registrations: data.count,
    estimated_monthly_revenue: Math.round(
      (data.directRevenue + data.creditsUsed * creditValue) / 100
    ), // Convert cents to dollars
  }));
}

function calculateAgeDistribution(registrations: any[]): AgeCategoryDistribution[] {
  const total = registrations.length || 1;

  const byCategory: Record<string, number> = {};

  registrations.forEach((r) => {
    const category = r.form_data?.playerCategory || 'Unknown';
    byCategory[category] = (byCategory[category] || 0) + 1;
  });

  return Object.entries(byCategory)
    .map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

function calculateSummary(
  registrations: any[],
  purchases: any[],
  bookings: any[]
): AnalyticsSummary {
  const now = new Date();
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - now.getDay());
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setMilliseconds(-1);

  const thisWeekRegs = registrations.filter((r) => {
    const created = new Date(r.created_at);
    return created >= thisWeekStart;
  }).length;

  const lastWeekRegs = registrations.filter((r) => {
    const created = new Date(r.created_at);
    return created >= lastWeekStart && created < thisWeekStart;
  }).length;

  const paidRegs = registrations.filter((r) => r.payment_status === 'verified').length;

  // Total revenue from credit purchases
  const totalRevenue = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Direct revenue from bookings
  const directRevenue = bookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.amount_paid || 0), 0);

  const totalMRR = Math.round((totalRevenue + directRevenue) / 100); // Convert to dollars

  return {
    total_registrations: registrations.length,
    paid_registrations: paidRegs,
    total_mrr: totalMRR,
    avg_registration_value: registrations.length > 0 ? Math.round(totalMRR / registrations.length) : 0,
    fill_rate_percentage: paidRegs > 0 ? Math.round((paidRegs / registrations.length) * 100) : 0,
    this_week_registrations: thisWeekRegs,
    last_week_registrations: lastWeekRegs,
  };
}
