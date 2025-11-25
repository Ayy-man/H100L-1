# CURRENT ISSUES CHECKLIST - 2025-11-25

## Critical Issues

### 1. [ ] Semi-Private Reschedule - 500 Internal Server Error
- **Status:** BROKEN
- **Error:** POST /api/reschedule-semi-private returns 500
- **Impact:** Users cannot reschedule semi-private training

### 2. [ ] Private Reschedule - Shows All Slots as Booked (Red)
- **Status:** BROKEN
- **Error:** All time slots appear booked/unavailable
- **Impact:** Users cannot select any slot to reschedule

### 3. [ ] Group One-Time Reschedule - Doesn't Actually Change Anything
- **Status:** BROKEN
- **Error:** Says success but schedule doesn't change
- **Impact:** One-time changes don't work

### 4. [ ] Semi-Private Calendar - Can't See Booked Dates
- **Status:** BROKEN
- **Error:** Training schedule shows no sessions for semi-private users
- **Impact:** Users don't know when their sessions are

---

## UI/UX Issues

### 5. [ ] Homepage Shows "Max 6 players" Instead of Live Capacity
- **Status:** Poor UX
- **Location:** Dashboard "Next 8 Sessions" cards
- **Fix:** Show "X/6 spots filled" or "X spots left" instead

### 6. [ ] Schedule Page Shows Irrelevant Legends
- **Status:** Poor UX
- **Location:** SchedulePage.tsx calendar legends
- **Error:** Shows "Synthetic Ice" and "Real Ice" for private/semi-private users
- **Fix:** Only show relevant legends based on program type

### 7. [ ] Sunday Booking Status Not Showing on Schedule Calendar
- **Status:** Partially broken
- **Error:** Homepage shows "Booked" but schedule calendar shows "Ice"
- **Root Cause:** `get_upcoming_sunday_slots` DB function only checks `booking_status='confirmed'`

---

## Current Fix Order

1. **Semi-Private Reschedule 500** - Check Vercel logs, fix API
2. **Private Reschedule All Red** - Debug availability check
3. **Group One-Time Change** - Fix the actual schedule update logic
4. **Semi-Private Calendar Display** - Fix session generation
5. **UI/UX improvements** - Capacity display, legends

---

## Notes
- Stripe errors (r.stripe.com blocked) are caused by ad blocker - NOT a code issue
- Permissions-Policy header warning is from browser - NOT a code issue
