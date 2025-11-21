-- ============================================
-- ANALYTICS VIEWS FOR ADMIN DASHBOARD
-- ============================================
-- Creates optimized views for analytics and reporting

-- ============================================
-- 1. DAILY REGISTRATION COUNTS
-- ============================================
DROP VIEW IF EXISTS public.daily_registration_counts;

CREATE OR REPLACE VIEW public.daily_registration_counts AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE payment_status = 'paid') as paid_count,
  COUNT(*) FILTER (WHERE payment_status = 'pending') as pending_count
FROM public.registrations
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

COMMENT ON VIEW public.daily_registration_counts IS 'Daily registration counts for the last 30 days';
GRANT SELECT ON public.daily_registration_counts TO anon, authenticated;

-- ============================================
-- 2. PROGRAM TYPE DISTRIBUTION
-- ============================================
DROP VIEW IF EXISTS public.program_distribution;

CREATE OR REPLACE VIEW public.program_distribution AS
SELECT
  (form_data->>'programType')::text as program_type,
  COUNT(*) as count,
  ROUND((COUNT(*)::decimal / (SELECT COUNT(*) FROM public.registrations) * 100), 2) as percentage
FROM public.registrations
WHERE form_data->>'programType' IS NOT NULL
GROUP BY (form_data->>'programType')
ORDER BY count DESC;

COMMENT ON VIEW public.program_distribution IS 'Distribution of registrations by program type with percentages';
GRANT SELECT ON public.program_distribution TO anon, authenticated;

-- ============================================
-- 3. AGE CATEGORY DISTRIBUTION
-- ============================================
DROP VIEW IF EXISTS public.age_category_distribution;

CREATE OR REPLACE VIEW public.age_category_distribution AS
SELECT
  (form_data->>'playerCategory')::text as category,
  COUNT(*) as count,
  ROUND((COUNT(*)::decimal / (SELECT COUNT(*) FROM public.registrations WHERE form_data->>'playerCategory' IS NOT NULL) * 100), 2) as percentage
FROM public.registrations
WHERE form_data->>'playerCategory' IS NOT NULL
GROUP BY (form_data->>'playerCategory')
ORDER BY count DESC;

COMMENT ON VIEW public.age_category_distribution IS 'Distribution of players by age category';
GRANT SELECT ON public.age_category_distribution TO anon, authenticated;

-- ============================================
-- 4. REVENUE BY PROGRAM TYPE
-- ============================================
DROP VIEW IF EXISTS public.revenue_by_program;

CREATE OR REPLACE VIEW public.revenue_by_program AS
SELECT
  (form_data->>'programType')::text as program_type,
  COUNT(*) as registrations,
  COUNT(*) FILTER (WHERE payment_status = 'paid') as paid_registrations,
  -- Estimated monthly revenue based on standard pricing
  CASE
    WHEN form_data->>'programType' = 'group' AND form_data->>'groupFrequency' = '1x' THEN COUNT(*) FILTER (WHERE payment_status = 'paid') * 200
    WHEN form_data->>'programType' = 'group' AND form_data->>'groupFrequency' = '2x' THEN COUNT(*) FILTER (WHERE payment_status = 'paid') * 350
    WHEN form_data->>'programType' = 'private' AND form_data->>'privateFrequency' = '1x' THEN COUNT(*) FILTER (WHERE payment_status = 'paid') * 400
    WHEN form_data->>'programType' = 'private' AND form_data->>'privateFrequency' = '2x' THEN COUNT(*) FILTER (WHERE payment_status = 'paid') * 700
    WHEN form_data->>'programType' = 'semi-private' THEN COUNT(*) FILTER (WHERE payment_status = 'paid') * 300
    ELSE 0
  END as estimated_monthly_revenue
FROM public.registrations
WHERE form_data->>'programType' IS NOT NULL
GROUP BY
  (form_data->>'programType'),
  (form_data->>'groupFrequency'),
  (form_data->>'privateFrequency')
ORDER BY estimated_monthly_revenue DESC;

COMMENT ON VIEW public.revenue_by_program IS 'Estimated revenue breakdown by program type and frequency';
GRANT SELECT ON public.revenue_by_program TO anon, authenticated;

-- ============================================
-- 5. CAPACITY UTILIZATION
-- ============================================
DROP VIEW IF EXISTS public.capacity_utilization;

CREATE OR REPLACE VIEW public.capacity_utilization AS
SELECT
  ts.time_slot_name,
  ts.day_of_week,
  ts.capacity,
  ts.current_registrations,
  ROUND((ts.current_registrations::decimal / ts.capacity::decimal * 100), 2) as utilization_rate,
  (ts.capacity - ts.current_registrations) as available_spots
FROM public.time_slots ts
WHERE ts.is_active = true
ORDER BY utilization_rate DESC;

COMMENT ON VIEW public.capacity_utilization IS 'Capacity utilization rates for all active time slots';
GRANT SELECT ON public.capacity_utilization TO anon, authenticated;

-- ============================================
-- 6. WEEKLY GROWTH METRICS
-- ============================================
DROP VIEW IF EXISTS public.weekly_growth;

CREATE OR REPLACE VIEW public.weekly_growth AS
WITH this_week AS (
  SELECT COUNT(*) as count
  FROM public.registrations
  WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)
),
last_week AS (
  SELECT COUNT(*) as count
  FROM public.registrations
  WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week'
    AND created_at < DATE_TRUNC('week', CURRENT_DATE)
)
SELECT
  this_week.count as this_week_count,
  last_week.count as last_week_count,
  (this_week.count - last_week.count) as growth,
  CASE
    WHEN last_week.count > 0 THEN ROUND(((this_week.count - last_week.count)::decimal / last_week.count * 100), 2)
    ELSE 0
  END as growth_percentage
FROM this_week, last_week;

COMMENT ON VIEW public.weekly_growth IS 'Week-over-week registration growth metrics';
GRANT SELECT ON public.weekly_growth TO anon, authenticated;

-- ============================================
-- 7. KEY METRICS SUMMARY
-- ============================================
DROP VIEW IF EXISTS public.analytics_summary;

CREATE OR REPLACE VIEW public.analytics_summary AS
SELECT
  -- Total registrations
  (SELECT COUNT(*) FROM public.registrations) as total_registrations,

  -- Paid registrations
  (SELECT COUNT(*) FROM public.registrations WHERE payment_status = 'paid') as paid_registrations,

  -- Total estimated MRR
  (SELECT COALESCE(SUM(estimated_monthly_revenue), 0) FROM public.revenue_by_program) as total_mrr,

  -- Average registration value
  CASE
    WHEN (SELECT COUNT(*) FROM public.registrations WHERE payment_status = 'paid') > 0
    THEN (SELECT COALESCE(SUM(estimated_monthly_revenue), 0) FROM public.revenue_by_program) /
         (SELECT COUNT(*) FROM public.registrations WHERE payment_status = 'paid')
    ELSE 0
  END as avg_registration_value,

  -- Overall fill rate
  CASE
    WHEN (SELECT SUM(capacity) FROM public.time_slots WHERE is_active = true) > 0
    THEN ROUND(((SELECT SUM(current_registrations) FROM public.time_slots WHERE is_active = true)::decimal /
                (SELECT SUM(capacity) FROM public.time_slots WHERE is_active = true)::decimal * 100), 2)
    ELSE 0
  END as fill_rate_percentage,

  -- This week's registrations
  (SELECT COUNT(*) FROM public.registrations WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)) as this_week_registrations,

  -- Last week's registrations
  (SELECT COUNT(*) FROM public.registrations
   WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week'
     AND created_at < DATE_TRUNC('week', CURRENT_DATE)) as last_week_registrations;

COMMENT ON VIEW public.analytics_summary IS 'Summary of key analytics metrics for the dashboard';
GRANT SELECT ON public.analytics_summary TO anon, authenticated;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Test daily counts
SELECT * FROM public.daily_registration_counts LIMIT 10;

-- Test program distribution
SELECT * FROM public.program_distribution;

-- Test age distribution
SELECT * FROM public.age_category_distribution;

-- Test revenue
SELECT * FROM public.revenue_by_program;

-- Test capacity utilization
SELECT * FROM public.capacity_utilization;

-- Test weekly growth
SELECT * FROM public.weekly_growth;

-- Test analytics summary
SELECT * FROM public.analytics_summary;
