# Credit System - Remaining Work

> **Created:** December 11, 2025
> **Status:** Frontend/Backend Complete - Integration & Testing Pending

---

## Summary

The credit-based payment system has been fully implemented at the code level. This document tracks the remaining work needed to complete the deployment.

### Completed Work
- Database schema (`credit_system_schema.sql`)
- RLS policies and Realtime (`credit_system_realtime.sql`)
- All credit system APIs (purchase, balance, history, booking, cancellation)
- All frontend components (NewDashboard, CreditBalanceCard, ChildrenSection, etc.)
- Recurring schedule management API (`recurring-schedule.ts`)
- CRON job for processing recurring bookings (`cron-process-recurring.ts`)

---

## Remaining Tasks

### Phase 1: Bug Fixes (Critical)

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 1.1 | ~~Fix SchedulePage redirect loop~~ | `SchedulePage.tsx` | **DONE** | Added `requireProfile={false}` |
| 1.2 | ~~Fix BillingPage redirect loop~~ | `BillingPage.tsx` | **DONE** | Added `requireProfile={false}` |
| 1.3 | Deploy code to Vercel | - | **PENDING** | Current deployment has stale code |

### Phase 2: UI/UX Improvements (Medium Priority)

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 2.1 | Create SetupRecurringModal | `components/dashboard/SetupRecurringModal.tsx` | **TODO** | Modal to create new recurring schedules |
| 2.2 | Wire up "Add Recurring" button | `RecurringScheduleCard.tsx` | **TODO** | Currently shows "Coming Soon" |
| 2.3 | Update SchedulePage for credit model | `SchedulePage.tsx` | **OPTIONAL** | Still uses old profile selection |

### Phase 3: Stripe Configuration (Critical)

| # | Task | Location | Status | Notes |
|---|------|----------|--------|-------|
| 3.1 | Create credit products in Stripe | Stripe Dashboard | **TODO** | Single ($40) and 20-pack ($500) |
| 3.2 | Create session products in Stripe | Stripe Dashboard | **TODO** | Sunday ($50), Semi-Private ($69), Private ($89.99) |
| 3.3 | Add Price IDs to environment | Vercel Env Vars | **TODO** | `STRIPE_PRICE_SINGLE_CREDIT`, `STRIPE_PRICE_20_PACK`, etc. |
| 3.4 | Update `lib/stripe.ts` with price IDs | `lib/stripe.ts` | **TODO** | Map price IDs to session types |

### Phase 4: Cleanup (Low Priority)

| # | Task | File | Status | Notes |
|---|------|------|--------|-------|
| 4.1 | Delete old subscription API | `api/create-subscription.ts` | **TODO** | No longer needed |
| 4.2 | Delete old cancellation API | `api/cancel-subscription.ts` | **TODO** | No longer needed |
| 4.3 | Review/delete reschedule APIs | `api/reschedule-*.ts` | **REVIEW** | May still be needed |

### Phase 5: Testing (Critical)

| # | Test Case | Status | Notes |
|---|-----------|--------|-------|
| 5.1 | Dashboard loads without errors | **TODO** | Test after deployment |
| 5.2 | Credit balance displays correctly | **TODO** | - |
| 5.3 | Buy single credit flow | **TODO** | Requires Stripe setup |
| 5.4 | Buy 20-pack flow | **TODO** | Requires Stripe setup |
| 5.5 | Book group session (credit deduction) | **TODO** | - |
| 5.6 | Book Sunday session (direct pay) | **TODO** | - |
| 5.7 | Cancel booking (credit refund) | **TODO** | - |
| 5.8 | Schedule page loads | **TODO** | - |
| 5.9 | Billing page loads | **TODO** | - |
| 5.10 | Realtime balance updates | **TODO** | - |

---

## SetupRecurringModal Specification

### Purpose
Allow parents to set up automatic weekly bookings for group training sessions.

### Flow
1. User clicks "Set up recurring" in RecurringScheduleCard
2. Modal opens with form:
   - Select child (dropdown of registered children)
   - Select day of week (Mon-Sat based on child's registered days)
   - Select time slot (based on child's age category)
   - Confirm recurring setup
3. On submit: POST to `/api/recurring-schedule`
4. Modal closes, list refreshes

### Required Props
```typescript
interface SetupRecurringModalProps {
  open: boolean;
  onClose: () => void;
  children: ChildProfile[];
  onSuccess: () => void;
}
```

### Integration
```tsx
// In RecurringScheduleCard.tsx
<SetupRecurringModal
  open={showSetupModal}
  onClose={() => setShowSetupModal(false)}
  children={children}
  onSuccess={onRefresh}
/>

// Replace "Coming Soon" button with:
<Button variant="outline" onClick={() => setShowSetupModal(true)}>
  <Plus className="mr-2 h-4 w-4" />
  Set Up Recurring
</Button>
```

---

## Stripe Products to Create

### Credit Packages
| Product | Price (CAD) | Price ID Env Var |
|---------|-------------|------------------|
| Single Credit | $40.00 | `STRIPE_PRICE_SINGLE_CREDIT` |
| 20-Credit Pack | $500.00 | `STRIPE_PRICE_20_PACK` |

### Direct Purchase Sessions
| Product | Price (CAD) | Price ID Env Var |
|---------|-------------|------------------|
| Sunday Ice Practice | $50.00 | `STRIPE_PRICE_SUNDAY_ICE` |
| Semi-Private Training | $69.00 | `STRIPE_PRICE_SEMI_PRIVATE` |
| Private Training | $89.99 | `STRIPE_PRICE_PRIVATE` |

### Stripe Dashboard Steps
1. Go to Products → Add Product
2. Name: "SniperZone Single Credit" (or appropriate name)
3. Price: Set amount in CAD
4. Pricing model: One-time
5. Copy the `price_xxx` ID after creation
6. Add to Vercel environment variables

---

## Environment Variables Required

```env
# Credit System Price IDs
STRIPE_PRICE_SINGLE_CREDIT=price_xxx
STRIPE_PRICE_20_PACK=price_xxx
STRIPE_PRICE_SUNDAY_ICE=price_xxx
STRIPE_PRICE_SEMI_PRIVATE=price_xxx
STRIPE_PRICE_PRIVATE=price_xxx
```

---

## Quick Start Commands

```bash
# Commit current fixes
git add -A
git commit -m "fix: Add requireProfile={false} to Schedule and Billing pages"
git push -u origin claude/analyze-codebase-pivot-01XRnrbjVfQvNXmLFuoGepqu

# After Vercel deployment, test these URLs:
# - /dashboard (main dashboard)
# - /schedule (schedule page)
# - /billing (billing page)
```

---

## Notes

### Why "Recurring" Shows "Coming Soon"
The backend API for recurring schedules exists and works (`/api/recurring-schedule.ts`). The CRON job for processing recurring bookings exists (`/api/cron-process-recurring.ts`). The RecurringScheduleCard can display and manage existing schedules.

What's missing is the **UI to create new recurring schedules** - a `SetupRecurringModal` component that:
1. Shows a form to select child, day, and time
2. Calls POST `/api/recurring-schedule`
3. Refreshes the list

This is a medium-priority enhancement. Users can still book sessions one-at-a-time via BookSessionModal.

### Private/Semi-Private "Coming Soon"
In `FormStep2.tsx` and `ProgramCards.tsx`, private and semi-private programs are marked as "Coming Soon" with disabled selection. This was intentional for the initial launch to focus on group training. These can be enabled later by:
1. Removing the disabled state from the UI
2. Ensuring the booking flow handles these session types
3. Setting up Stripe prices for these sessions
