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

### 11. ❌ Sunday Ice Booking Button - Not a Bug
**Severity:** N/A
**Status:** RESOLVED (Working as intended)

**Original Report:** The "Book Now" button for Sunday ice practice was missing for M18/Junior players.

**Resolution:** This is **intentional behavior**, not a bug. Sunday ice practice is only available for M7-M15 age categories. M18 and Junior players do not have access to Sunday ice sessions.

**Eligibility Rules:**
- M9, M11, M13, M15 → Eligible for Sunday ice
- M18, Junior → NOT eligible for Sunday ice

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
| 🟢 Minor | 4 | 3 | 1 |
| **Total** | **10** | **9** | **1** |

*Note: Issue #11 was not a bug - Sunday ice is intentionally restricted to M7-M15 categories.*

---

## 🔍 Codebase Audit (Nov 29, 2024)

### ✅ Fixed in This Session

| Issue | File | Severity | Fix |
|-------|------|----------|-----|
| Payment status 'paid' vs 'succeeded' | create-subscription.ts:125 | HIGH | Changed to 'succeeded' |
| 3x/week price using wrong env var | create-subscription.ts:229 | HIGH | Now uses VITE_STRIPE_PRICE_PRIVATE_3X |
| JSON parse null safety | AdminDashboard.tsx:398-403 | MEDIUM | Added try-catch |
| CSV escape fails on 0/false | sunday-export-roster.ts:125 | LOW | Check null/undefined only |
| Sunday booking status timezone | SchedulePage.tsx:769 | MEDIUM | Use local date format |

### ⚠️ Known Security Issues (Deferred)

| Issue | File | Severity | Notes |
|-------|------|----------|-------|
| Hardcoded admin passwords | AdminDashboard.tsx:172-176 | HIGH | Move to Firebase Auth post-launch |
| Missing admin auth on endpoints | admin-confirm-payment.ts | HIGH | All admin APIs need token verification |
| No user auth on verify-payment | verify-payment.ts:31-35 | MEDIUM | Add Firebase token check |

### 📝 Performance Issues (Nice-to-Have)

| Issue | File | Notes |
|-------|------|-------|
| N+1 queries in availability check | reschedule-semi-private.ts:210-270 | Fetch all bookings once, filter in memory |
| Inefficient exception lookup | reschedule-group.ts:287-345 | Use upsert instead of select+update |

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
| 2024-11-29 | #10 Blue Badge Highlight | ✅ FIXED | Toned down bright blue to outlined badge |
| 2024-11-29 | Sunday booking calendar status | ✅ FIXED | Fixed timezone issue with date format |
| 2024-11-29 | Codebase Audit | ✅ DONE | Fixed payment_status, JSON parse, CSV escape issues |
