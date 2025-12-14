# Database Migrations Required

**IMPORTANT**: These SQL files must be run in Supabase SQL Editor in order!

## Required Migrations

### 1. Credit System Schema
**File**: `/database/credit_system_schema.sql`
**Run in Supabase**: SQL Editor

Creates the core credit system tables:
- `parent_credits` - Stores credit balances per parent
- `credit_purchases` - Tracks credit package purchases
- `session_bookings` - Unified booking table for all session types
- `recurring_schedules` - Weekly recurring booking schedules
- `credit_adjustments` - Admin credit adjustments with audit trail
- Various views and functions for credit management

### 2. Credit System Realtime & RLS
**File**: `/database/credit_system_realtime.sql`
**Run in Supabase**: SQL Editor

Sets up:
- Row Level Security (RLS) policies for all credit tables
- Realtime subscriptions for live updates
- Database functions for credit operations
- Indexes for performance

### 3. Report Templates
**File**: `/database/report_templates.sql`
**Run in Supabase**: SQL Editor

Creates:
- `report_templates` - Pre-built report templates
- `scheduled_reports` - Automated report generation
- `report_history` - Report execution history
- `report_subscriptions` - User report subscriptions

## After Running Migrations

1. **Test the admin panel** - Go to `/admin` and check if the Credits tab loads without 500 errors
2. **Verify tables exist** - In Supabase Table Editor, you should see:
   - parent_credits
   - credit_purchases
   - session_bookings
   - credit_adjustments
   - report_templates

## Troubleshooting

If you get errors:
1. Make sure to run the files in the order listed above
2. Check if any tables already exist - you may need to drop them first
3. Ensure SUPABASE_SERVICE_ROLE_KEY is set in your environment variables

## Next Steps

After migrations are applied:
1. The credit admin panel should work correctly
2. Test credit adjustments, search, and analytics
3. Remove legacy tables and components as outlined in the plan