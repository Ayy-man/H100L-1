# CURRENT ISSUES CHECKLIST - 2025-11-25

## Critical Issues

### 1. [x] Semi-Private Reschedule - 500 Internal Server Error
- **Status:** FIXED
- **Fix:** Changed `.insert().onConflict()` to `.upsert()` syntax
- **Commit:** Fixed in reschedule-semi-private.ts

### 2. [x] Private Reschedule - Shows All Slots as Booked (Red)
- **Status:** FIXED
- **Fix:** Excluded current registration from availability check
- **Commit:** Fixed in reschedule-private.ts

### 3. [x] Group One-Time Reschedule - Doesn't Actually Change Anything
- **Status:** FIXED
- **Fix:**
  - Modal now sends `specificDate` instead of `effectiveDate` for one-time changes
  - Created `/api/schedule-exceptions` endpoint
  - TrainingSchedule now fetches and applies schedule exceptions
  - Added "One-time Change" badge for exception sessions
- **Commit:** Fixed in RescheduleGroupModal.tsx, TrainingSchedule.tsx, api/schedule-exceptions.ts

### 4. [x] Semi-Private Calendar - Can't See Booked Dates
- **Status:** FIXED
- **Fix:** TrainingSchedule now checks both `semiPrivateTimeSlot` and `semiPrivateTimeWindows` fields
- **Commit:** Fixed in TrainingSchedule.tsx, create-subscription.ts

---

## UI/UX Issues

### 5. [x] Homepage Shows "Max 6 players" Instead of Live Capacity
- **Status:** FIXED
- **Fix:**
  - Created `/api/group-capacity` endpoint to fetch real-time booking counts
  - TrainingSchedule now displays "X/6 spots filled" with color-coded status
- **Commit:** Fixed in TrainingSchedule.tsx, api/group-capacity.ts

### 6. [ ] Schedule Page Shows Irrelevant Legends
- **Status:** Poor UX
- **Location:** SchedulePage.tsx calendar legends
- **Error:** Shows "Synthetic Ice" and "Real Ice" for private/semi-private users
- **Fix:** Only show relevant legends based on program type

### 7. [ ] Sunday Booking Status Not Showing on Schedule Calendar
- **Status:** Partially broken
- **Error:** Homepage shows "Booked" but schedule calendar shows "Ice"
- **Root Cause:** `get_upcoming_sunday_slots` DB function only checks `booking_status='confirmed'`
- **Fix:** SQL update needed in Supabase to check `!= 'cancelled'` instead

---

## Notes
- Stripe errors (r.stripe.com blocked) are caused by ad blocker - NOT a code issue
- Permissions-Policy header warning is from browser - NOT a code issue
