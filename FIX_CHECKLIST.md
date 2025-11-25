# FIX CHECKLIST - SniperZone Hockey Training System

## Status Legend
- [ ] Not started
- [🔄] In progress
- [x] Completed

---

## ISSUE 1: Private Training Rescheduling Errors (400 Error - Both "This Week Only" and "Permanent")

**Root Cause:**
The API at `api/reschedule-private.ts` queries registrations with `.eq('payment_status', 'active')` but there is NO 'active' status in the system. Valid statuses are: `pending`, `succeeded`, `failed`, `canceled`, `verified`.

**Files Fixed:**
- `api/reschedule-private.ts` - Lines 91, 174, 236-240

**Solution Applied:**
Changed `.eq('payment_status', 'active')` to `.in('payment_status', ['succeeded', 'verified'])`.
Also improved registration ID exclusion logic.

**Status:** [x] Completed

---

## ISSUE 2: Semi-Private Training Rescheduling Error (Internal Server Error)

**Root Cause:**
Same issue as Issue 1 - the API at `api/reschedule-semi-private.ts` also queries with `.eq('payment_status', 'active')`.

**Files Fixed:**
- `api/reschedule-semi-private.ts` - Lines 181, 248, 314

**Solution Applied:**
Changed `.eq('payment_status', 'active')` to `.in('payment_status', ['succeeded', 'verified'])`.
Also improved registration ID exclusion logic.

**Status:** [x] Completed

---

## ISSUE 3: Semi-Private Calendar Shows Wrong Time Slot

**Root Cause:**
In `components/dashboard/TrainingSchedule.tsx` line 562, the semi-private modal was passed `form_data.privateTimeSlot` instead of `form_data.semiPrivateTimeSlot`.

**Files Fixed:**
- `components/dashboard/TrainingSchedule.tsx` - Line 562

**Solution Applied:**
Changed `timeSlot: form_data.privateTimeSlot` to `timeSlot: form_data.semiPrivateTimeSlot`.

**Status:** [x] Completed

---

## ISSUE 4: Private Training Calendar Missing Weekend Days

**Root Cause:**
In `components/dashboard/TrainingSchedule.tsx` lines 123-128, the `dayMap` for private training only included Monday-Friday, but private training is available 7 days a week.

**Files Fixed:**
- `components/dashboard/TrainingSchedule.tsx` - Lines 123-128

**Solution Applied:**
Added `sunday: 0` and `saturday: 6` to the private training dayMap.

**Status:** [x] Completed

---

## ISSUE 5: Sunday Booking Not Showing for Group Training

**Root Cause:**
The database function `get_next_sunday_slot` was rejecting M7-M10 players (`IF v_player_category_num < 11`) even though there's a M7-M11 slot available.

**Files Created:**
- `database/FIX_SUNDAY_M7_ELIGIBILITY.sql` - SQL fix to allow M7-M15 players

**Solution Applied:**
Created SQL fix that changes the eligibility check from `< 11` to `< 7` to allow all M7-M15 players.
**ACTION REQUIRED:** Run the SQL file in Supabase dashboard.

**Status:** [x] Completed (SQL file created - needs to be run in Supabase)

---

## ISSUE 6: Admin Panel - Unpaired/Paired Semi-Private Players Not Showing

**Root Cause:**
1. The `create-subscription.ts` API was setting `payment_status: 'active'` instead of `'succeeded'`
2. Semi-private players were NOT being added to the `unpaired_semi_private` table during registration

**Files Fixed:**
- `api/create-subscription.ts` - Fixed payment_status and added semi-private player insertion
- `api/stripe-webhook.ts` - Fixed payment_status mapping (for consistency)

**Solution Applied:**
1. Changed `payment_status: 'active'` to `'succeeded'` in subscription creation
2. Added automatic insertion of semi-private players into `unpaired_semi_private` table on successful payment
3. Added status mapping helper in webhook for Stripe status -> our status

**Status:** [x] Completed

---

## SUMMARY OF ALL FIXES

### Files Modified:
1. `api/reschedule-private.ts` - Fixed payment_status queries
2. `api/reschedule-semi-private.ts` - Fixed payment_status queries
3. `components/dashboard/TrainingSchedule.tsx` - Fixed timeSlot field and weekend days
4. `api/create-subscription.ts` - Fixed payment_status and added semi-private unpaired insertion
5. `api/stripe-webhook.ts` - Fixed payment_status mapping

### Files Created:
1. `database/FIX_SUNDAY_M7_ELIGIBILITY.sql` - SQL fix for Sunday booking eligibility

### Database Action Required:
Run `database/FIX_SUNDAY_M7_ELIGIBILITY.sql` in Supabase SQL editor to fix Sunday booking for M7-M10 players.

---

*Last updated: 2025-11-25*
*All code fixes completed. Database SQL needs to be run manually.*
