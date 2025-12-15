# Codebase Issues & Improvements TODO

**Last Updated:** 2025-12-15
**Status:** Credit system LIVE - Admin bookings panel COMPLETE

---

## Current System State

The system has been pivoted from **subscriptions to credits**:
- Parents buy credit packages ($45, $350, $500)
- 1 credit = 1 group training session
- Sunday/Private/Semi-Private are paid directly ($50/$89.99/$69)
- Time slots filtered by player age category

---

## Completed (December 15, 2025)

### Credit System Implementation
- [x] Database schema (parent_credits, credit_purchases, session_bookings, recurring_schedules)
- [x] All credit APIs (purchase-credits, book-session, credit-balance, etc.)
- [x] Dashboard components (CreditBalanceCard, BookSessionModal, etc.)
- [x] Stripe products configured (6 products/prices)
- [x] Time slot filtering by age category
- [x] Recurring schedule with auto-assigned time slots
- [x] Admin credit management APIs

### Recent Fixes (December 15, 2025)
- [x] Fixed Module Not Found error on Vercel (inlined Supabase clients)
- [x] Fixed time slot filtering - each age group only sees their slot
- [x] Added M7 to PlayerCategory type
- [x] Fixed SetupRecurringModal to auto-assign time slots
- [x] Rewrote SchedulePage for credit model
- [x] Fixed "No available slots" bug - aligned categories across AddChildModal, add-child API, and check-availability
- [x] Added category normalization with Adult→Junior fallback
- [x] Fixed book-session API - removed RPC dependencies, handles admin-added credits
- [x] Fixed recurring-schedule API - inlined types for Vercel bundling

### Admin Bookings Panel (December 15, 2025)
- [x] **Daily Operations** - Calendar view, attendance marking, session stats
- [x] **Booking Management** - Search, filter, cancel/update bookings
- [x] **Capacity Planning** - Visual slot utilization with progress bars
- [x] **Revenue & Reports** - Stats by session type, credit usage, direct revenue

### Enhanced AddChildModal (December 15, 2025)
- [x] Multi-step form (2 steps)
- [x] Step 1: Basic info + Emergency contact (name, phone, relationship)
- [x] Step 2: Hockey info (position, hand, level, jersey, objective) + Medical (allergies, conditions, medication) + Consents

---

## Remaining Work

### Security (HIGH PRIORITY)

- [ ] **Rotate Production Credentials**
  - Stripe Secret Key, Supabase Service Role Key, Webhook Secret
  - These were previously exposed and should be rotated

- [ ] **Add Rate Limiting to APIs**
  - All `/api/*` endpoints lack rate limiting
  - Implement with @upstash/ratelimit or Vercel Edge

- [ ] **Add Authentication to check-availability API**
  - Currently allows unauthenticated queries

### Known Bugs

- [ ] **Dashboard initial load delay**
  - Sometimes shows "No registration" briefly on first load
  - Add retry logic or increase auth propagation delay

### API Import Issues (Medium Priority)

These APIs still import from `../types/credits` which may fail on Vercel:
- [ ] `api/admin-adjust-credits.ts`
- [ ] `api/stripe-webhook.ts`
- [ ] `api/purchase-session.ts`
- [ ] `api/purchase-credits.ts`
- [ ] `api/group-capacity.ts`
- [ ] `api/cron-process-recurring.ts`
- [ ] `api/credit-history.ts`
- [ ] `api/credit-balance.ts`
- [ ] `api/cancel-booking.ts`

Fix: Inline types directly in each API file (like book-session.ts and recurring-schedule.ts)

### Deferred Updates (Low Priority)

These legacy files still exist but are not actively used:
- [ ] `/api/create-subscription.ts` - Keep for reference, may delete later
- [ ] `/api/cancel-subscription.ts` - Keep for reference, may delete later
- [ ] `/components/dashboard/PaymentStatus.tsx` - Uses old subscription model
- [ ] `/components/dashboard/TrainingSchedule.tsx` - Uses old subscription model

---

## Documentation Status

| File | Status | Notes |
|------|--------|-------|
| `CREDIT_SYSTEM_TODO.md` | Current | Primary reference for credit system |
| `PIVOT_GAMEPLAN.md` | Current | Complete implementation history |
| `README.md` | Updated | Now includes admin panel info |
| `TODO.md` | Current | This file |

---

## Quick Reference: Time Slots by Category

| Category | Group (Weekday) | Sunday Ice |
|----------|----------------|------------|
| M7, M9, M11 | 4:30 PM | 7:30 AM |
| M13, M13 Elite | 5:45 PM | 8:30 AM |
| M15, M15 Elite | 7:00 PM | 8:30 AM |
| M18, Junior | 8:15 PM | Not eligible |

Private/Semi-Private: All ages, 8 AM - 4 PM, 7 days/week

---

## Admin Panel Features

| Tab | Features |
|-----|----------|
| Overview | Registrations list, stats cards, filters |
| Analytics | Charts, program distribution, capacity utilization |
| Credits | Credit management, adjust balances, view purchases |
| **Bookings** | Daily ops, booking management, capacity planning, revenue reports |
| Settings | System configuration |

---

*Last updated: December 15, 2025*
