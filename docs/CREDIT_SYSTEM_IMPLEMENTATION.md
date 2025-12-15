# SniperZone Credit System Implementation Documentation

## Overview
**Date Started**: December 14, 2025
**Urgency**: Critical - "Needed to go live yesterday"
**Objective**: Complete rework of admin panel around credit-based payment system

## Initial Problems

### Error Reports
1. **Admin panel showing blue screen** - Multiple component errors
2. **credit-summary API returning 500** - Missing supabaseAdmin client
3. **report_templates 404 error** - Tables exist but no API endpoints
4. **Legacy tables cluttering system** - Old booking system needs removal

## Migration Files Created

### `/supabase/migrations/`
1. **20251211_remove_session_type_restrictions.sql**
   - Purpose: Allow all session types (group, sunday, private, semi_private)
   - Added '10_pack' to credit purchase packages

2. **20251214_credit_system_schema.sql**
   - Main credit system tables
   - Core tables: parent_credits, credit_purchases, session_bookings, credit_adjustments, notifications

3. **20251214_report_templates.sql**
   - Reporting system tables
   - Tables: report_templates, scheduled_reports, report_history

4. **20251214_credit_system_realtime.sql**
   - Realtime subscription setup
   - Enabled realtime on key tables

5. **20251214_drop_legacy_tables.sql**
   - Removes old booking system
   - Dropped: time_slots, sunday_bookings, semi_private_pairings, etc.

6. **20251215_cleanup_legacy_triggers.sql**
   - Removes triggers referencing deleted tables
   - Addresses trigger errors

7. **20251215_find_and_drop_triggers.sql** (Latest)
   - Comprehensive trigger removal
   - Programmatically finds and drops all problematic triggers

## Code Changes

### 1. Supabase Client (`/lib/supabase.ts`)
```typescript
// Added supabaseAdmin for server-side operations
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    if (typeof window !== 'undefined') {
      throw new Error('supabaseAdmin can only be used on server side');
    }
    // Lazy initialization only on server
  }
});
```

### 2. Admin APIs Created
- `/api/admin/credit-summary.ts` - Credit system overview
- `/api/admin/credit-search.ts` - User credit search
- `/api/admin/credit-history.ts` - Transaction history
- `/api/admin-adjust-credits.ts` - Manual credit adjustments
- `/api/admin/report-*.ts` - Reporting system APIs

### 3. Component Fixes
- **AdminCreditDashboard.tsx**: Fixed JSX syntax errors
  - Line 153: Added missing opening parenthesis
  - Line 304-305: Fixed fragment closure
- **AdminDashboard.tsx**: Removed references to deleted tables
  - Commented out fetchCapacityData(), fetchAnalyticsData()

## Errors Encountered

### 1. Client-side Supabase Admin Error
```
SUPABASE ADMIN ERROR: Missing service role key
```
- **Cause**: Initializing on client side
- **Fix**: Lazy proxy with window check

### 2. JSX Build Errors
```
Expected ")" but found "{"
Unexpected closing "div" tag
```
- **Cause**: Mismatched parentheses in AdminCreditDashboard
- **Fix**: Proper fragment and conditional closure

### 3. Database Field Error
```
column "credits_remaining" does not exist in parent_credits
```
- **Cause**: Wrong field name
- **Fix**: Changed to `total_credits`

### 4. Trigger Error (Current Issue)
```
ERROR: 42P01: relation "public.time_slots" does not exist
CONTEXT: PL/pgSQL function update_time_slot_counts()
```
- **Cause**: Trigger still referencing deleted table
- **Status**: Attempting to fix with comprehensive trigger removal

## Current State

### Database Tables
✅ **Created**: parent_credits, credit_purchases, session_bookings, credit_adjustments, notifications
✅ **Kept**: registrations, children, parent_profiles, recurring_schedules
❌ **Deleted**: time_slots, sunday_bookings, semi_private_pairings, schedule_changes

### Environment Variables (All Configured)
✅ SUPABASE_SERVICE_ROLE_KEY
✅ SUPABASE_URL, SUPABASE_ANON_KEY
✅ VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
✅ All Firebase and Stripe keys

### What's Working
- Build completes successfully
- Admin panel loads without blue screen
- Credit system tables exist
- Environment variables configured

### What's Broken
- **Trigger error** on registration inserts/updates
- **Credit APIs** return 500 until trigger fixed

## Solution in Progress

### Latest Fix Attempt
**File**: `20251215_find_and_drop_triggers.sql`

This migration:
1. Identifies all triggers on registrations table
2. Programmatically drops triggers referencing time_slots
3. Drops the problematic functions
4. Reports remaining issues

### Immediate Action Required
Run the latest migration in Supabase SQL Editor to remove the trigger causing the time_slots error.

## Next Steps After Fix

1. **Test registration creation** - Verify trigger error is resolved
2. **Test credit APIs** - Check admin credit functionality
3. **Test credit purchases** - Verify Stripe integration works
4. **Test credit usage** - Ensure credits are deducted for bookings

## Technical Decisions

1. **Unified Booking System**: All session types now use `session_bookings` table
2. **FIFO Credit Usage**: Oldest credits used first (tracked via credit_purchases)
3. **Parent-level Credits**: Credits shared across all children under same parent
4. **Admin Audit Trail**: All credit adjustments logged with admin details

## Migration Order Dependencies

1. First: Schema creation
2. Second: Data migration (if needed)
3. Third: Drop legacy tables
4. Fourth: Clean up triggers/functions

## Rollback Plan

If critical issues arise:
1. Disable credit system via feature flags
2. Restore legacy table structures from backup
3. Revert API changes to old booking system