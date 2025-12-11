# SniperZone Business Model Pivot: Subscriptions → Credits

> **Status:** Planning Phase
> **Created:** December 11, 2025
> **Last Updated:** December 11, 2025

---

## Executive Summary

This document outlines the complete roadmap for pivoting SniperZone from a **subscription-based model** to a **credit/token-based model** with pay-per-session options.

### Current Model (Subscriptions)
- Parents pay monthly subscription ($249.99 or $399.99/month)
- Subscription grants access to all sessions for that month
- Sunday ice practice included free for group subscribers
- Each child requires separate subscription
- Payment status (`succeeded`/`verified`) gates all access

### New Model (Credits + Pay-Per-Session)
- Parents buy credit packages (single $40 or 20-pack $500)
- Credits are at **PARENT level** - shared across all children
- Each group training session consumes 1 credit
- Sunday ($50), Semi-Private ($69), Private ($89.99) are separate purchases
- Credits expire after 12 months, no refunds
- Single dashboard view showing all children

---

## Pricing Structure

### Credit-Based (Group Training)
| Package | Price | Credits | Per Session | Validity |
|---------|-------|---------|-------------|----------|
| Single Session | $40 + taxes | 1 | $40 | 12 months |
| 20-Session Pack | $500 + taxes | 20 | $25 | 12 months |

### Direct Purchase (Pay-Per-Session)
| Session Type | Price | Notes |
|--------------|-------|-------|
| Sunday Ice Practice | $50 + taxes | Real ice, any eligible player |
| Semi-Private Training | $69 + taxes | 2-3 players matched |
| Private Training | $89.99 + taxes | 1-on-1 coaching |

### Key Rules
- No refunds on credit packages
- Credits expire 12 months after purchase
- 24-hour cancellation policy (credit returned if cancelled 24h+ before)
- Recurring bookings available (auto-deduct weekly)

---

## Architecture Changes

### New Database Schema

```sql
-- ============================================
-- PARENT CREDITS (at firebase_uid level)
-- ============================================
CREATE TABLE parent_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL UNIQUE,
    total_credits INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CREDIT PURCHASES (log of all purchases)
-- ============================================
CREATE TABLE credit_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL,
    package_type TEXT NOT NULL,           -- 'single' | '20_pack'
    credits_purchased INTEGER NOT NULL,   -- 1 or 20
    price_paid NUMERIC(10,2) NOT NULL,    -- 40.00 or 500.00
    currency TEXT DEFAULT 'cad',
    stripe_payment_intent_id TEXT,
    stripe_checkout_session_id TEXT,
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,      -- purchased_at + 12 months
    credits_remaining INTEGER NOT NULL,   -- Tracks how many from THIS purchase remain
    status TEXT DEFAULT 'active',         -- 'active' | 'expired' | 'exhausted'

    CONSTRAINT fk_parent FOREIGN KEY (firebase_uid)
        REFERENCES parent_credits(firebase_uid)
);

-- ============================================
-- SESSION BOOKINGS (individual reservations)
-- ============================================
CREATE TABLE session_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL,
    registration_id UUID NOT NULL REFERENCES registrations(id),

    -- Session details
    session_type TEXT NOT NULL,           -- 'group' | 'sunday' | 'private' | 'semi_private'
    session_date DATE NOT NULL,
    time_slot TEXT NOT NULL,              -- '5:45 PM'

    -- Credit tracking
    credits_used INTEGER NOT NULL DEFAULT 0,  -- 1 for group, 0 for paid sessions
    credit_purchase_id UUID REFERENCES credit_purchases(id),  -- Which purchase was debited

    -- For paid sessions (Sunday, Private, Semi-Private)
    price_paid NUMERIC(10,2),             -- NULL for credit-based, amount for paid
    stripe_payment_intent_id TEXT,

    -- Recurring booking support
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_schedule_id UUID,

    -- Status
    status TEXT NOT NULL DEFAULT 'booked', -- 'booked' | 'attended' | 'cancelled' | 'no_show'
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent double-booking same child same slot
    CONSTRAINT unique_booking UNIQUE (registration_id, session_date, time_slot, session_type)
);

-- ============================================
-- RECURRING SCHEDULES (optional weekly auto-book)
-- ============================================
CREATE TABLE recurring_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL,
    registration_id UUID NOT NULL REFERENCES registrations(id),

    session_type TEXT NOT NULL,           -- 'group' only for now
    day_of_week TEXT NOT NULL,            -- 'monday', 'tuesday', etc.
    time_slot TEXT NOT NULL,              -- '5:45 PM'

    is_active BOOLEAN DEFAULT TRUE,
    paused_reason TEXT,                   -- 'insufficient_credits' | 'user_paused'

    last_booked_date DATE,                -- Track where we are in booking
    next_booking_date DATE,               -- Next date to book

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_credits_firebase ON parent_credits(firebase_uid);
CREATE INDEX idx_purchases_firebase ON credit_purchases(firebase_uid);
CREATE INDEX idx_purchases_status ON credit_purchases(status, expires_at);
CREATE INDEX idx_bookings_firebase ON session_bookings(firebase_uid);
CREATE INDEX idx_bookings_date ON session_bookings(session_date);
CREATE INDEX idx_bookings_registration ON session_bookings(registration_id);
CREATE INDEX idx_bookings_status ON session_bookings(status);
CREATE INDEX idx_recurring_active ON recurring_schedules(is_active, next_booking_date);
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PARENT ACCOUNT                                 │
│                         (firebase_uid: abc123)                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                      CREDIT BALANCE                              │   │
│   │   Total: 15 credits                                              │   │
│   │   ┌──────────────────┐  ┌──────────────────┐                    │   │
│   │   │ Purchase #1      │  │ Purchase #2      │                    │   │
│   │   │ 20-pack          │  │ Single           │                    │   │
│   │   │ Remaining: 14    │  │ Remaining: 1     │                    │   │
│   │   │ Expires: Dec '26 │  │ Expires: Nov '26 │                    │   │
│   │   └──────────────────┘  └──────────────────┘                    │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                       CHILDREN                                   │   │
│   │   ┌───────────┐  ┌───────────┐  ┌───────────┐                   │   │
│   │   │   Alex    │  │   Sam     │  │   Jamie   │                   │   │
│   │   │   M11     │  │   M13     │  │   M9      │                   │   │
│   │   │ reg: r001 │  │ reg: r002 │  │ reg: r003 │                   │   │
│   │   └───────────┘  └───────────┘  └───────────┘                   │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    UPCOMING BOOKINGS                             │   │
│   │                                                                  │   │
│   │   Jan 15 │ Alex  │ Group 5:45 PM    │ 1 credit  │ ✓ Booked     │   │
│   │   Jan 15 │ Sam   │ Group 7:00 PM    │ 1 credit  │ ✓ Booked     │   │
│   │   Jan 19 │ Alex  │ Sunday 8:30 AM   │ $50 paid  │ ✓ Booked     │   │
│   │   Jan 22 │ Alex  │ Group 5:45 PM    │ 1 credit  │ 🔄 Recurring │   │
│   │   Jan 22 │ Sam   │ Group 7:00 PM    │ 1 credit  │ 🔄 Recurring │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   [Buy Credits]  [Book Session]  [Manage Recurring]  [View Calendar]    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Files Impact Analysis

### HIGH IMPACT (Major Rewrite)

| File | Lines | Current Function | Change Required |
|------|-------|------------------|-----------------|
| `/api/create-subscription.ts` | 300+ | Create Stripe subscription | **DELETE** - Replace with `/api/purchase-credits.ts` |
| `/api/stripe-webhook.ts` | 300+ | Handle subscription webhooks | **REWRITE** - Handle one-time payment webhooks only |
| `/api/verify-payment.ts` | 300+ | Verify subscription payment | **REWRITE** - Verify credit purchase |
| `/api/cancel-subscription.ts` | 180+ | Cancel subscription | **DELETE** - No subscriptions to cancel |
| `/components/dashboard/PaymentStatus.tsx` | 456 | Show subscription status | **REWRITE** - Show credit balance + buy button |
| `/components/Dashboard.tsx` | 288 | Per-child dashboard | **REWRITE** - Single parent view with all children |
| `/contexts/ProfileContext.tsx` | 200+ | Multi-profile switching | **SIMPLIFY** - Remove profile switching, show all kids |
| `/lib/stripe.ts` | 114 | Subscription pricing | **REWRITE** - Credit package pricing |
| `/database/sunday_practice_schema.sql` | 700+ | Sunday RPC functions | **UPDATE** - Remove payment_status checks, add payment flow |

### MEDIUM IMPACT (Significant Updates)

| File | Lines | Current Function | Change Required |
|------|-------|------------------|-----------------|
| `/api/check-availability.ts` | 200+ | Check slot availability | **UPDATE** - Count bookings, not subscriptions |
| `/api/sunday-book.ts` | 150+ | Book Sunday slot | **UPDATE** - Add payment requirement |
| `/api/sunday-next-slot.ts` | 150+ | Get next Sunday slot | **UPDATE** - Remove payment_status gate |
| `/api/reschedule-group.ts` | 500+ | Reschedule group training | **REVIEW** - May not be needed (book any day with credits) |
| `/api/reschedule-private.ts` | 500+ | Reschedule private | **REVIEW** - May not be needed |
| `/api/reschedule-semi-private.ts` | 800+ | Reschedule semi-private | **REVIEW** - May not be needed |
| `/api/group-capacity.ts` | 100+ | Check group capacity | **UPDATE** - Count bookings, not subscriptions |
| `/api/get-children.ts` | 150+ | Get children for parent | **UPDATE** - Add credit balance to response |
| `/api/_lib/unifiedCapacityManager.ts` | 150+ | Capacity calculations | **REWRITE** - Count session_bookings table |
| `/components/BillingPage.tsx` | 400+ | Billing/subscription info | **REWRITE** - Show credit purchases history |
| `/components/RegistrationForm.tsx` | 460+ | Registration flow | **UPDATE** - Remove payment redirect, go to "buy credits" |
| `/components/SchedulePage.tsx` | 1000+ | Calendar view | **UPDATE** - Show bookings, add book buttons |
| `/components/dashboard/TrainingSchedule.tsx` | 900+ | Training schedule | **UPDATE** - Show bookings, add book/cancel buttons |
| `/components/dashboard/ProfileSwitcher.tsx` | 142 | Switch between children | **DELETE** - No more switching needed |
| `/components/ProfileSelectionScreen.tsx` | 200+ | Select profile on login | **DELETE** - No more needed |

### LOW IMPACT (Minor Changes)

| File | Lines | Current Function | Change Required |
|------|-------|------------------|-----------------|
| `/types.ts` | 200+ | TypeScript types | **UPDATE** - Add credit types, remove subscription types |
| `/api/admin-confirm-payment.ts` | 200+ | Admin payment confirm | **UPDATE** - Confirm credit purchase instead |
| `/api/notifications.ts` | 100+ | Notifications | **UPDATE** - New notification types for credits |
| `/lib/exportUtils.ts` | 400+ | CSV/PDF exports | **UPDATE** - Add credit columns |
| `/components/AdminDashboard.tsx` | 2000+ | Admin dashboard | **UPDATE** - Show credit balances, purchases |

---

## New API Endpoints

### Credit Management
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/purchase-credits` | POST | Buy single or 20-pack credits |
| `GET /api/credit-balance` | GET | Get parent's credit balance |
| `GET /api/credit-history` | GET | Get purchase and usage history |
| `POST /api/admin-adjust-credits` | POST | Admin manually adjust credits |

### Session Booking
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/book-session` | POST | Book a session (deduct credit or charge card) |
| `POST /api/cancel-booking` | POST | Cancel a booking (refund credit if 24h+) |
| `GET /api/my-bookings` | GET | Get all bookings for parent |
| `POST /api/purchase-session` | POST | Buy Sunday/Private/Semi-Private directly |

### Recurring Management
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/recurring-schedule` | POST | Create recurring weekly booking |
| `PUT /api/recurring-schedule` | PUT | Update or pause recurring |
| `DELETE /api/recurring-schedule` | DELETE | Cancel recurring |
| `POST /api/cron-process-recurring` | POST | CRON: Process weekly recurring bookings |

---

## New Components

### Dashboard Redesign
```
/components/
├── NewDashboard.tsx                    # Single parent view
├── dashboard/
│   ├── CreditBalanceCard.tsx           # Show credits, buy button
│   ├── ChildrenSection.tsx             # All children in one view
│   ├── UpcomingBookingsCard.tsx        # All bookings across children
│   ├── BookSessionModal.tsx            # Book a new session
│   ├── BuyCreditsModal.tsx             # Purchase credit packages
│   ├── RecurringScheduleCard.tsx       # Manage recurring bookings
│   └── CancelBookingModal.tsx          # Cancel with refund logic
```

---

## Implementation Phases

### Phase 1: Database & Core APIs (Week 1)
- [ ] Create new database tables (SQL migration)
- [ ] Create `POST /api/purchase-credits` endpoint
- [ ] Create `GET /api/credit-balance` endpoint
- [ ] Create `POST /api/book-session` endpoint
- [ ] Create `POST /api/cancel-booking` endpoint
- [ ] Update Stripe webhook for one-time payments

### Phase 2: Dashboard Redesign (Week 2)
- [ ] Create new `CreditBalanceCard` component
- [ ] Create new `ChildrenSection` component
- [ ] Create new `UpcomingBookingsCard` component
- [ ] Create `BookSessionModal` component
- [ ] Create `BuyCreditsModal` component
- [ ] Build new unified Dashboard

### Phase 3: Booking Flow (Week 3)
- [ ] Update capacity logic to count bookings
- [ ] Update Sunday booking to require payment
- [ ] Create Private session purchase flow
- [ ] Create Semi-Private session purchase flow
- [ ] Update SchedulePage calendar

### Phase 4: Recurring & Polish (Week 4)
- [ ] Create recurring schedule tables and APIs
- [ ] Create CRON job for weekly recurring processing
- [ ] Add expiry warnings and notifications
- [ ] Update admin dashboard for credits
- [ ] Testing and bug fixes

### Phase 5: Cleanup (Week 5)
- [ ] Remove old subscription code
- [ ] Remove ProfileSwitcher and profile selection
- [ ] Update all documentation
- [ ] Final testing
- [ ] Deploy

---

## Migration Strategy

### Existing Data
1. **Current subscribers**: No migration needed - subscriptions expire naturally
2. **Registrations**: Keep all registration data (player info, medical, etc.)
3. **Sunday bookings**: Keep existing sunday_bookings table, it still works
4. **Payment status**: Keep field for historical reference, stop using for access control

### New Users
1. Register child(ren) → No payment required
2. Buy credits → Creates parent_credits record
3. Book sessions → Creates session_bookings records

### Rollback Plan
- Keep old subscription tables intact
- Feature flag to switch between models if needed
- Can revert by re-enabling subscription endpoints

---

## Environment Variables

### New Variables Needed
```env
# Credit Package Stripe Price IDs
VITE_STRIPE_PRICE_CREDIT_SINGLE=price_xxx    # $40 single credit
VITE_STRIPE_PRICE_CREDIT_20PACK=price_xxx    # $500 20-pack

# Direct Purchase Stripe Price IDs
VITE_STRIPE_PRICE_SUNDAY=price_xxx           # $50 Sunday ice
VITE_STRIPE_PRICE_SEMI_PRIVATE=price_xxx     # $69 Semi-private
VITE_STRIPE_PRICE_PRIVATE=price_xxx          # $89.99 Private

# Feature Flag (optional)
VITE_USE_CREDIT_SYSTEM=true
```

### Remove/Deprecate
```env
# These become unused:
VITE_STRIPE_PRICE_GROUP_1X      # Old subscription price
VITE_STRIPE_PRICE_GROUP_2X      # Old subscription price
VITE_STRIPE_PRICE_SEMI_PRIVATE  # Replace with per-session
```

---

## Risk Assessment

### High Risk
| Risk | Mitigation |
|------|------------|
| Breaking existing user access | Keep old tables, gradual migration |
| Stripe webhook changes | Test extensively in Stripe test mode |
| Capacity calculation errors | Unit tests for new capacity logic |

### Medium Risk
| Risk | Mitigation |
|------|------------|
| UI confusion for existing users | Clear messaging, help documentation |
| Credit expiry edge cases | Comprehensive date handling |
| Recurring booking failures | Robust error handling, notifications |

### Low Risk
| Risk | Mitigation |
|------|------------|
| Admin workflow changes | Training, updated admin docs |
| Report/export changes | Backward compatible columns |

---

## Success Metrics

### Technical
- [ ] All new APIs respond < 200ms
- [ ] Zero booking conflicts (capacity enforced)
- [ ] Credit deduction is atomic (no double-spend)
- [ ] Recurring jobs complete within 5 minutes

### Business
- [ ] Parents can buy credits and book sessions
- [ ] Credit balance displays correctly
- [ ] Cancellations refund credits appropriately
- [ ] Sunday/Private/Semi-Private purchases work

---

## Appendix: Complete File Inventory

### Files to DELETE
```
/api/create-subscription.ts
/api/cancel-subscription.ts
/components/ProfileSelectionScreen.tsx
/components/dashboard/ProfileSwitcher.tsx
```

### Files to CREATE
```
/api/purchase-credits.ts
/api/credit-balance.ts
/api/credit-history.ts
/api/book-session.ts
/api/cancel-booking.ts
/api/purchase-session.ts
/api/recurring-schedule.ts
/api/cron-process-recurring.ts
/api/admin-adjust-credits.ts

/components/NewDashboard.tsx
/components/dashboard/CreditBalanceCard.tsx
/components/dashboard/ChildrenSection.tsx
/components/dashboard/UpcomingBookingsCard.tsx
/components/dashboard/BookSessionModal.tsx
/components/dashboard/BuyCreditsModal.tsx
/components/dashboard/RecurringScheduleCard.tsx
/components/dashboard/CancelBookingModal.tsx

/database/credit_system_schema.sql
/database/migration_to_credits.sql
```

### Files to HEAVILY MODIFY
```
/api/stripe-webhook.ts
/api/verify-payment.ts
/api/check-availability.ts
/api/sunday-book.ts
/api/group-capacity.ts
/api/get-children.ts
/api/_lib/unifiedCapacityManager.ts

/components/Dashboard.tsx
/components/BillingPage.tsx
/components/SchedulePage.tsx
/components/RegistrationForm.tsx
/components/dashboard/PaymentStatus.tsx
/components/dashboard/TrainingSchedule.tsx

/contexts/ProfileContext.tsx
/lib/stripe.ts
/types.ts

/database/sunday_practice_schema.sql (RPC functions)
```

---

## Next Steps

1. **Review this document** - Confirm all assumptions are correct
2. **Create Stripe products** - Set up new price IDs for credits and sessions
3. **Start Phase 1** - Database schema and core APIs
4. **Iterate** - Build, test, refine

---

*Document maintained by development team. Last reviewed: December 11, 2025*
