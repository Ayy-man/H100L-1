# SniperZone Pre-Launch Checklist

**Last Updated:** November 2024
**Status:** In Progress

---

## 🔴 CRITICAL ISSUES - Must Fix Before Launch

### 1. ✅ Schedule Changes NOT Visible to Admin
**Severity:** HIGH
**Status:** FIXED

**Problem:** When parents reschedule (one-time or permanent), the data goes into `schedule_changes` and `schedule_exceptions` tables, but the Admin Dashboard had NO UI to view these.

**Impact:** Admin had no visibility into:
- Which players changed their training days this week
- History of schedule modifications
- Pending or applied one-time swaps

**Files Affected:**
- `components/AdminDashboard.tsx` - Added schedule changes tab
- `components/admin/ScheduleChangesPanel.tsx` - NEW component

**Fix Applied:** Added a "Schedule" tab in AdminDashboard showing:
- Pending one-time changes
- Recently applied changes
- Full history by player
- Both `schedule_changes` and `schedule_exceptions` data

---

### 2. ✅ Parent Can't See Semi-Private "Waiting" Status Clearly
**Severity:** MEDIUM-HIGH
**Status:** FIXED

**Problem:** When a semi-private player reschedules and becomes unpaired, they're added to `unpaired_semi_private` with status `waiting`. However, the parent dashboard didn't clearly communicate:
- "You are currently waiting for a partner"
- How long they've been waiting
- Admin contact for manual pairing

**Files Modified:**
- `api/reschedule-semi-private.ts` - Enhanced `get_current_pairing` to return waiting status
- `components/SchedulePage.tsx` - Added waiting status banner with full details
- `components/dashboard/TrainingSchedule.tsx` - Added compact waiting indicator

**Fix Applied:**
- API now checks `unpaired_semi_private` table and returns waiting info
- SchedulePage shows prominent orange banner with:
  - Waiting since date
  - Age category
  - Preferred days
  - Contact email for questions
- TrainingSchedule shows compact indicator on the dashboard

---

### 3. ✅ Admin Attendance Hardcoded Email
**Severity:** MEDIUM
**Status:** FIXED

**Problem:** In `components/admin/SundayRosterAdmin.tsx:174`:
```typescript
markedBy: 'admin@h100l.com', // TODO: Replace with actual admin email from auth
```

**Impact:** No way to track which admin marked attendance.

**Files Modified:**
- `components/AdminDashboard.tsx` - Added admin login form with dropdown selector
- `components/admin/SundayRosterAdmin.tsx` - Now receives adminUser prop
- `components/ConfirmPaymentButton.tsx` - Now receives adminEmail prop

**Fix Applied:**
- Added proper login screen with admin selector dropdown
- Three admins with individual passwords:
  - Loïc Pierre-Louis (L2025sniper)
  - Darick Louis-Jean (D2025sniper)
  - Christopher Fanfan (C2025sniper)
- Admin's email is now passed to attendance marking and payment confirmation
- Header shows "Logged in as [Admin Name]"

---

## 🟡 MODERATE ISSUES - Should Fix Before Launch

### 4. ✅ Semi-Private Pairing History Not Visible
**Severity:** MEDIUM
**Status:** FIXED

**Problem:** Admin can see active pairings and dissolved pairings via the `semi_private_pairings` table (with `status='dissolved'`), but the UnpairedPlayersPanel doesn't show dissolved pairing history.

**Files Modified:**
- `components/admin/UnpairedPlayersPanel.tsx` - Added "Pairing History" tab

**Fix Applied:**
- Added `DissolvedPairing` interface for type safety
- Added `dissolvedPairings` state to track history
- Updated `loadData()` to fetch dissolved pairings (status='dissolved')
- Renamed "Recent Activity" tab to "Pairing History"
- Added full history table showing:
  - Player names (both partners)
  - Category
  - Original schedule (day & time)
  - Date paired
  - Date dissolved
  - Dissolution reason
  - Who dissolved (admin name)

---

### 5. ✅ SchedulePage Shows Wrong "Training Days" Count for Semi-Private
**Severity:** LOW-MEDIUM
**Status:** FIXED

**Problem:** In `components/SchedulePage.tsx`:
```tsx
{registration.form_data.programType === 'semi-private' &&
  registration.form_data.semiPrivateAvailability?.length}
```

This showed the number of **availability preferences**, not actual scheduled days (semi-private is always 1x/week).

**Files Modified:**
- `components/SchedulePage.tsx` - Fixed Training Days card for semi-private

**Fix Applied:**
- Changed semi-private Training Days count to always show `1` (since semi-private is 1x/week)
- Updated the description below to show:
  - The actual scheduled day (e.g., "Monday") if paired
  - "Pending pairing" if waiting for a partner

---

### 6. ✅ Missing Parent Notification System
**Severity:** MEDIUM
**Status:** FIXED

**Problem:** When admin dissolves a pairing or creates a new pairing, the system generates `dissolvedPartnerInfo` and `newPairingInfo` but doesn't send any email/notification.

**Files Created/Modified:**
- `database/notifications_schema.sql` - NEW: Complete notification table schema with RLS policies
- `api/notifications.ts` - NEW: CRUD API for notifications
- `lib/notificationService.ts` - NEW: Frontend service for notification operations
- `lib/notificationHelper.ts` - NEW: Server-side helper for creating notifications
- `components/notifications/NotificationBell.tsx` - NEW: Bell icon with unread badge
- `components/notifications/NotificationDropdown.tsx` - NEW: Dropdown notification list
- `components/notifications/NotificationItem.tsx` - NEW: Individual notification display
- `components/dashboard/DashboardLayout.tsx` - Added NotificationBell to parent header
- `components/AdminDashboard.tsx` - Added NotificationBell to admin header
- `api/reschedule-semi-private.ts` - Integrated notifications for pairing/schedule changes
- `api/admin-confirm-payment.ts` - Integrated payment confirmation notifications
- `api/sunday-book.ts` - Integrated Sunday booking notifications
- `api/sunday-cancel.ts` - Integrated Sunday cancellation notifications

**Fix Applied:**
- Full in-app notification system for both parent and admin portals
- Notification types: pairing_created, pairing_dissolved, schedule_changed, payment_confirmed, sunday_booking, etc.
- Priority levels: low, normal, high, urgent
- Bell icon in header with unread count badge
- Dropdown shows notification list with mark all read functionality
- Real-time polling (30 second intervals)
- Notifications automatically created when events happen (pairings, payments, bookings)

---

## 🟢 MINOR ISSUES - Nice to Fix

### 7. ✅ Legacy Field References
**Severity:** LOW
**Status:** FIXED

Several files referenced legacy fields. Now cleaned up with backward-compatible helpers.

**Files Modified:**
- `types.ts` - Added `semiPrivateTimeSlot` to FormData, marked legacy fields with @deprecated JSDoc
- `lib/utils.ts` - Added `getSemiPrivateTimeSlot()` and `getGroupSelectedDays()` helper functions
- `components/RegistrationForm.tsx` - Added `semiPrivateTimeSlot` to initial state, syncs when time windows change
- `components/SchedulePage.tsx` - Updated to use `getSemiPrivateTimeSlot()` helper

**Fix Applied:**
- Legacy fields kept for backward compatibility with existing database records
- New helper functions abstract the fallback logic
- Forms now populate both new and legacy fields
- JSDoc @deprecated comments added to guide future development

---

### 8. ⏳ Admin Password Security
**Severity:** LOW
**Status:** PENDING

`AdminDashboard.tsx:301-308` uses a simple prompt with hardcoded password:
```typescript
if (password === 'sniperzone2025') {
```

Consider moving to environment variable or proper auth system.

---

### 10. ✅ Blue Time Slot Highlight Too Bright
**Severity:** MEDIUM
**Status:** FIXED

**Problem:** The ice-blue (#9BD4FF) badge background for assigned time slots was too bright/saturated, making text and UI elements hard to see.

**Files Fixed:**
- `components/dashboard/TrainingSchedule.tsx` - Changed to outlined badge with primary color
- `components/dashboard/RegistrationSummary.tsx` - Changed to outlined badge with primary color
- `components/form/FormStep4.tsx` - Changed to outlined badge with primary color

**Fix Applied:** Changed from solid bright blue background to subtle outlined style using the theme's primary color for better contrast and readability.

---

### 11. ✅ Sunday Ice Booking Button Missing
**Severity:** HIGH
**Status:** FIXED

**Problem:** The "Book Now" button for Sunday ice practice was missing for M18 and Junior players because `isSundayEligible()` incorrectly restricted Sunday ice to only M7-M15 categories.

**Root Cause:** The eligibility check in `TrainingSchedule.tsx` used a regex pattern `/M(\d+)/` and checked if the number was between 7-15. This excluded:
- M18 players (18 > 15)
- Junior players (doesn't match the M pattern at all)

**Files Fixed:**
- `components/dashboard/TrainingSchedule.tsx` - Simplified `isSundayEligible()` to allow ALL group training players

**Fix Applied:**
```typescript
// Before (broken):
const categoryMatch = playerCategory.match(/M(\d+)/);
const categoryNum = parseInt(categoryMatch[1], 10);
return categoryNum >= 7 && categoryNum <= 15;

// After (fixed):
return form_data.programType === 'group';
```

---

### 9. ✅ Missing TypeScript Type for `verified` Status
**Severity:** LOW
**Status:** FIXED

**File Modified:**
- `types.ts` - Updated Registration interface

**Fix Applied:**
```typescript
payment_status: 'pending' | 'succeeded' | 'verified' | 'failed' | 'canceled' | null;

// Also added manual confirmation fields:
manually_confirmed?: boolean;
manually_confirmed_by?: string;
manually_confirmed_at?: string;
manually_confirmed_reason?: string;
```

---

## 📋 Pre-Launch Environment Checklist

### Backend Configuration
- [ ] All environment variables set in Vercel
- [ ] Stripe webhook configured (add domain to Stripe dashboard)
- [ ] Stripe price IDs created and env vars updated
- [ ] Supabase RLS policies enforced
- [ ] Database migrations applied in order
- [ ] Medical file storage bucket created
- [ ] Cron job working (test Sunday slot generation)
- [ ] Firebase project configured

### Frontend Configuration
- [ ] All VITE_ environment variables loaded
- [ ] Stripe Elements loading correctly
- [ ] Firebase initialization successful
- [ ] Form validation working
- [ ] Multi-child profile switching tested

### Testing Checklist
- [ ] Register new parent → Stripe checkout → Webhook
- [ ] Add child to existing parent
- [ ] Profile switching works
- [ ] Reschedule all program types (Group, Private, Semi-Private)
- [ ] Sunday booking/cancellation
- [ ] Payment confirmation flows
- [ ] Admin dashboard filters/exports
- [ ] Schedule changes visible in admin

### Content
- [ ] Bilingual translations complete (FR/EN)
- [ ] Pricing accurate in constants
- [ ] Terms & conditions up to date

---

## 📊 Progress Summary

| Priority | Total | Fixed | Pending |
|----------|-------|-------|---------|
| 🔴 Critical | 3 | 3 | 0 |
| 🟡 Moderate | 3 | 3 | 0 |
| 🟢 Minor | 5 | 4 | 1 |
| **Total** | **11** | **10** | **1** |

---

## Change Log

| Date | Issue | Status | Notes |
|------|-------|--------|-------|
| 2024-11-28 | #1 Schedule Changes Admin View | ✅ FIXED | Added ScheduleChangesPanel component |
| 2024-11-28 | #2 Semi-Private Waiting Status | ✅ FIXED | Added waiting banners to parent portal |
| 2024-11-28 | #3 Admin Login & Tracking | ✅ FIXED | Added admin selector with individual passwords |
| 2024-11-28 | #4 Semi-Private Pairing History | ✅ FIXED | Added Pairing History tab with dissolved pairs |
| 2024-11-28 | #5 Training Days Count | ✅ FIXED | Semi-private now shows 1 day + scheduled day |
| 2024-11-28 | #6 Notification System | ✅ FIXED | Full in-app notification system for parent & admin portals |
| 2024-11-28 | #7 Legacy Field References | ✅ FIXED | Added helper functions, deprecated legacy fields |
| 2024-11-28 | #9 TypeScript verified Status | ✅ FIXED | Added 'verified' to payment_status type + manual confirmation fields |
