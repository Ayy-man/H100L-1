# Testing Checklist - SniperZone Fixes

**Date:** 2025-11-25
**Branch:** `claude/review-and-fix-issues-01WtTqKYxKWrF2GhqRP36ZDG`

---

## Pre-Testing Setup

- [ ] Deploy the code changes to your environment
- [ ] Run `database/FIX_SUNDAY_M7_ELIGIBILITY.sql` in Supabase SQL Editor
- [ ] Clear browser cache / use incognito mode

---

## Issue 1: Private Training Rescheduling

### Test: "This Week Only" Change
1. [ ] Log in as a **Private Training** parent (payment status: `succeeded` or `verified`)
2. [ ] Go to Dashboard → Training Schedule
3. [ ] Click "Reschedule" button
4. [ ] Select "This Week Only"
5. [ ] Select a new day/time from the calendar grid
6. [ ] Click "Confirm Reschedule"
7. [ ] **Expected:** Success message, no 400 error

### Test: "Permanent Change"
1. [ ] Same steps as above but select "Permanent Change"
2. [ ] **Expected:** Success message, schedule updates permanently

---

## Issue 2: Semi-Private Training Rescheduling

### Test: "This Week Only" Change
1. [ ] Log in as a **Semi-Private Training** parent (payment status: `succeeded` or `verified`)
2. [ ] Go to Dashboard → Training Schedule
3. [ ] Click "Reschedule" button
4. [ ] Select "This Week Only"
5. [ ] Select a new day/time
6. [ ] Click "Confirm Reschedule"
7. [ ] **Expected:** Success message, no 500 internal server error

### Test: "Permanent Change"
1. [ ] Same steps but select "Permanent Change"
2. [ ] **Expected:** Success message, pairing status info shown

---

## Issue 3: Semi-Private Calendar Time Slot

### Test: Current Schedule Display
1. [ ] Log in as a **Semi-Private Training** parent
2. [ ] Go to Dashboard → Training Schedule
3. [ ] Click "Reschedule" button
4. [ ] Check the header showing "Current: [day] at [time]"
5. [ ] **Expected:** Shows the correct `semiPrivateTimeSlot` (e.g., "9-10"), NOT empty or wrong

---

## Issue 4: Private Training Calendar Weekend Days

### Test: Weekend Sessions Display
1. [ ] Log in as a **Private Training** parent who selected Saturday or Sunday
2. [ ] Go to Dashboard → Training Schedule
3. [ ] Look at "Next 8 Sessions" list
4. [ ] **Expected:** Saturday/Sunday sessions appear in the list (not missing)

### Test: Calendar Grid
1. [ ] Click "Reschedule" button
2. [ ] **Expected:** Saturday and Sunday columns appear in the weekly grid

---

## Issue 5: Sunday Booking (Requires DB Fix)

**Prerequisites:**
- Run `database/FIX_SUNDAY_M7_ELIGIBILITY.sql` in Supabase
- Use a Group Training player with category M7, M9, or M11

### Test: M7-M10 Player Eligibility
1. [ ] Log in as a **Group Training** parent with M7, M9, or M11 player
2. [ ] Go to Dashboard → Training Schedule
3. [ ] Look for Sunday sessions in "Next 8 Sessions"
4. [ ] **Expected:** Sunday sessions appear with "Book Now" button

### Test: Booking Flow
1. [ ] Click "Book Now" on a Sunday session
2. [ ] **Expected:** Success message, status changes to "Booked"

### Test: M13-M15 Player
1. [ ] Log in as a Group Training parent with M13 or M15 player
2. [ ] **Expected:** Should also see Sunday sessions and be able to book

---

## Issue 6: Admin Panel - Semi-Private Matching

### Test: New Semi-Private Registration
1. [ ] Complete a NEW semi-private registration through the form
2. [ ] Complete payment successfully
3. [ ] Go to Admin Panel → Matching tab
4. [ ] **Expected:** New player appears in "Unpaired Players" list

### Test: Existing Unpaired Players
1. [ ] Go to Admin Panel → Matching tab
2. [ ] Check "Unpaired Players" count in stats
3. [ ] **Expected:** Shows correct count (may be 0 if no semi-private registrations yet)

### Test: Active Pairings
1. [ ] Go to Admin Panel → Matching tab → "Active Pairs" tab
2. [ ] **Expected:** Shows paired players with names and schedule (not "Unknown")

### Test: Create Pairing
1. [ ] If 2+ unpaired players exist in same category
2. [ ] Go to "Pairing Opportunities" tab
3. [ ] Select day/time and click "Create Pairing"
4. [ ] **Expected:** Success message, players move to Active Pairs

---

## Edge Cases to Test

### Payment Status Variations
- [ ] Test with `payment_status = 'succeeded'` (Stripe payment)
- [ ] Test with `payment_status = 'verified'` (Admin confirmed)
- [ ] Test with `payment_status = 'pending'` → Should NOT allow rescheduling

### Empty States
- [ ] Admin panel with no semi-private registrations → Shows "No unpaired players found"
- [ ] No available Sunday slots → Shows appropriate message

---

## Verification Queries (Run in Supabase)

### Check Payment Statuses
```sql
SELECT payment_status, COUNT(*)
FROM registrations
GROUP BY payment_status;
```
**Expected:** Should see `succeeded`, `verified`, `pending`, etc. (NOT `active`)

### Check Unpaired Players
```sql
SELECT * FROM unpaired_semi_private WHERE status = 'waiting';
```

### Check Active Pairings
```sql
SELECT * FROM semi_private_pairings WHERE status = 'active';
```

### Check Sunday Slots
```sql
SELECT practice_date, min_category, max_category, available_spots
FROM sunday_practice_slots
WHERE practice_date >= CURRENT_DATE
ORDER BY practice_date;
```

---

## Results Summary

| Test | Status | Notes |
|------|--------|-------|
| Private "This Week Only" | | |
| Private "Permanent" | | |
| Semi-Private "This Week Only" | | |
| Semi-Private "Permanent" | | |
| Semi-Private Time Display | | |
| Private Weekend Calendar | | |
| Sunday M7-M10 Eligibility | | |
| Sunday Booking Flow | | |
| Admin Unpaired Players | | |
| Admin Active Pairings | | |
| Admin Create Pairing | | |

---

**Tested By:** _______________
**Date:** _______________
**All Tests Passed:** [ ] Yes / [ ] No
