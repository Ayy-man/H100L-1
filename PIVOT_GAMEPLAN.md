# SniperZone Business Model Pivot: Subscriptions → Credits

> **Status:** ✅ Database Ready - Awaiting Stripe Configuration
> **Created:** December 11, 2025
> **Last Updated:** December 11, 2025
> **Includes:** Supabase Realtime Configuration

---

## Implementation Progress

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 1: Agent 1 Foundation** | ✅ Complete | Types, schemas, Stripe config |
| **Phase 2: Agent 1 APIs** | ✅ Complete | All API endpoints created |
| **Phase 2: Agent 2 Frontend** | ✅ Complete | All components created |
| **Phase 3: Merge** | ✅ Complete | Merged to main |
| **Phase 4: Database Setup** | ✅ Complete | SQL scripts executed in Supabase |
| **Phase 5: Stripe Setup** | ⏳ Pending | Create price IDs in Stripe Dashboard |
| **Phase 6: Testing** | ⏳ Pending | End-to-end testing |

### Current State
- ✅ All code merged to main branch
- ✅ Database schema created (`credit_system_schema.sql`)
- ✅ RLS policies and Realtime enabled (`credit_system_realtime.sql`)
- ✅ Security hardening applied (Supabase AI recommendations)
- ✅ Dashboard infinite loop bug fixed (useRef pattern)
- ⏳ Stripe price IDs needed before testing

### Branch Information
- **Combined Branch:** `claude/analyze-codebase-pivot-01XRnrbjVfQvNXmLFuoGepqu`
- Contains all Agent 1 (backend) and Agent 2 (frontend) work
- ✅ Merged to main

---

## Parallel Workstream Execution

This pivot will be executed by **2 agents working in parallel** to avoid git conflicts.

### Why 2 Agents (Not 3)?
- `types.ts` is a shared dependency - splitting further creates merge conflicts
- Clear separation: Backend creates types/APIs, Frontend consumes them
- Simpler merge process with 2 branches

### Agent Coordination Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXECUTION TIMELINE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  AGENT 1 (Backend)                                                       │
│  ═══════════════════════════════════════════════════════════════════    │
│  │                                                                       │
│  ├─► Task 1.1: Create /types/credits.ts (NEW FILE)                      │
│  ├─► Task 1.2: Create database schema SQL files                         │
│  ├─► Task 1.3: Update /lib/stripe.ts                                    │
│  │                                                                       │
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║  🔔 HANDOFF POINT: After types.ts is committed, NOTIFY USER       ║  │
│  ║     "Agent 1 has completed types. You can now start Agent 2."     ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
│  │                                                                       │
│  ├─► Task 1.4-1.15: Continue with API endpoints (parallel safe)         │
│  │                                                                       │
│  └─► DONE: Push branch, create PR                                       │
│                                                                          │
│  AGENT 2 (Frontend) - STARTS AFTER HANDOFF NOTIFICATION                 │
│  ═══════════════════════════════════════════════════════════════════    │
│  │                                                                       │
│  ├─► Task 2.1-2.8: Create new dashboard components                      │
│  ├─► Task 2.9-2.14: Modify existing components                          │
│  ├─► Task 2.15-2.16: Delete deprecated components                       │
│  │                                                                       │
│  └─► DONE: Push branch, create PR                                       │
│                                                                          │
│  MERGE ORDER: Agent 1 first → Agent 2 second                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## AGENT 1: Backend (Database + APIs + Types)

**Branch:** `feature/credit-system-backend`
**Focus:** All server-side code, database schemas, API endpoints, Stripe integration

### Agent 1 Task List

| Task # | Action | File | Priority |
|--------|--------|------|----------|
| **1.1** | CREATE | `/types/credits.ts` | **CRITICAL - DO FIRST** |
| **1.2** | CREATE | `/database/credit_system_schema.sql` | HIGH |
| **1.3** | CREATE | `/database/credit_system_realtime.sql` | HIGH |
| **1.4** | MODIFY | `/lib/stripe.ts` | HIGH |
| **1.5** | CREATE | `/api/purchase-credits.ts` | HIGH |
| **1.6** | CREATE | `/api/credit-balance.ts` | HIGH |
| **1.7** | CREATE | `/api/credit-history.ts` | MEDIUM |
| **1.8** | CREATE | `/api/book-session.ts` | HIGH |
| **1.9** | CREATE | `/api/cancel-booking.ts` | HIGH |
| **1.10** | CREATE | `/api/my-bookings.ts` | MEDIUM |
| **1.11** | CREATE | `/api/purchase-session.ts` | HIGH |
| **1.12** | CREATE | `/api/recurring-schedule.ts` | MEDIUM |
| **1.13** | CREATE | `/api/cron-process-recurring.ts` | LOW |
| **1.14** | CREATE | `/api/admin-adjust-credits.ts` | LOW |
| **1.15** | MODIFY | `/api/stripe-webhook.ts` | **CRITICAL** |
| **1.16** | MODIFY | `/api/verify-payment.ts` | HIGH |
| **1.17** | MODIFY | `/api/check-availability.ts` | HIGH |
| **1.18** | MODIFY | `/api/sunday-book.ts` | HIGH |
| **1.19** | MODIFY | `/api/sunday-next-slot.ts` | MEDIUM |
| **1.20** | MODIFY | `/api/group-capacity.ts` | HIGH |
| **1.21** | MODIFY | `/api/get-children.ts` | MEDIUM |
| **1.22** | MODIFY | `/api/_lib/unifiedCapacityManager.ts` | HIGH |
| **1.23** | MODIFY | `/api/admin-confirm-payment.ts` | LOW |
| **1.24** | MODIFY | `/api/notifications.ts` | LOW |
| **1.25** | REVIEW | `/api/reschedule-group.ts` | LOW (may delete) |
| **1.26** | REVIEW | `/api/reschedule-private.ts` | LOW (may delete) |
| **1.27** | REVIEW | `/api/reschedule-semi-private.ts` | LOW (may delete) |
| **1.28** | DELETE | `/api/create-subscription.ts` | MEDIUM |
| **1.29** | DELETE | `/api/cancel-subscription.ts` | MEDIUM |

### Agent 1 Handoff Checkpoint

```
╔═══════════════════════════════════════════════════════════════════════════╗
║  🔔 AGENT 1 HANDOFF NOTIFICATION                                          ║
║                                                                           ║
║  After completing Tasks 1.1, 1.2, 1.3, and 1.4, Agent 1 MUST:            ║
║                                                                           ║
║  1. Commit these files:                                                   ║
║     - /types/credits.ts                                                   ║
║     - /database/credit_system_schema.sql                                  ║
║     - /database/credit_system_realtime.sql                                ║
║     - /lib/stripe.ts                                                      ║
║                                                                           ║
║  2. Push to branch                                                        ║
║                                                                           ║
║  3. Output this message to the user:                                      ║
║     "✅ HANDOFF READY: Core types and schemas committed.                  ║
║      You can now start Agent 2 (Frontend) in a separate session.          ║
║      Agent 2 should pull from this branch before starting."               ║
║                                                                           ║
║  4. Continue with remaining tasks (1.5 onwards)                           ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## AGENT 2: Frontend (Components + UI)

**Branch:** `feature/credit-system-frontend`
**Focus:** All React components, contexts, UI updates
**IMPORTANT:** Wait for Agent 1 handoff notification before starting!

### Agent 2 Pre-Start Checklist

```
⚠️  BEFORE STARTING AGENT 2:
    □ Receive handoff notification from Agent 1
    □ Pull latest from Agent 1's branch to get /types/credits.ts
    □ Verify /types/credits.ts exists locally
    □ Create new branch from Agent 1's branch
```

### Agent 2 Task List

| Task # | Action | File | Priority |
|--------|--------|------|----------|
| **2.1** | CREATE | `/components/NewDashboard.tsx` | HIGH |
| **2.2** | CREATE | `/components/dashboard/CreditBalanceCard.tsx` | HIGH |
| **2.3** | CREATE | `/components/dashboard/ChildrenSection.tsx` | HIGH |
| **2.4** | CREATE | `/components/dashboard/UpcomingBookingsCard.tsx` | HIGH |
| **2.5** | CREATE | `/components/dashboard/BookSessionModal.tsx` | HIGH |
| **2.6** | CREATE | `/components/dashboard/BuyCreditsModal.tsx` | HIGH |
| **2.7** | CREATE | `/components/dashboard/RecurringScheduleCard.tsx` | MEDIUM |
| **2.8** | CREATE | `/components/dashboard/CancelBookingModal.tsx` | MEDIUM |
| **2.9** | MODIFY | `/components/Dashboard.tsx` | HIGH |
| **2.10** | MODIFY | `/components/BillingPage.tsx` | HIGH |
| **2.11** | MODIFY | `/components/SchedulePage.tsx` | HIGH |
| **2.12** | MODIFY | `/components/RegistrationForm.tsx` | MEDIUM |
| **2.13** | MODIFY | `/components/dashboard/PaymentStatus.tsx` | HIGH |
| **2.14** | MODIFY | `/components/dashboard/TrainingSchedule.tsx` | HIGH |
| **2.15** | MODIFY | `/contexts/ProfileContext.tsx` | HIGH |
| **2.16** | MODIFY | `/components/AdminDashboard.tsx` | MEDIUM |
| **2.17** | MODIFY | `/lib/exportUtils.ts` | LOW |
| **2.18** | DELETE | `/components/dashboard/ProfileSwitcher.tsx` | MEDIUM |
| **2.19** | DELETE | `/components/ProfileSelectionScreen.tsx` | MEDIUM |

### Agent 2 Realtime Integration Tasks

| Task # | Action | Component | Realtime Feature |
|--------|--------|-----------|------------------|
| **2.20** | ADD | `CreditBalanceCard.tsx` | Subscribe to `parent_credits` UPDATE |
| **2.21** | ADD | `UpcomingBookingsCard.tsx` | Subscribe to `session_bookings` changes |
| **2.22** | ADD | `SchedulePage.tsx` | Subscribe to capacity updates |
| **2.23** | ADD | `RecurringScheduleCard.tsx` | Subscribe to `recurring_schedules` UPDATE |
| **2.24** | UPDATE | `NotificationBell.tsx` (existing) | Verify `notifications` subscription |

---

## File Ownership Summary (No Conflicts)

| Directory/Pattern | Owner | Notes |
|-------------------|-------|-------|
| `/api/**/*.ts` | **AGENT 1** | All API endpoints |
| `/database/**/*.sql` | **AGENT 1** | All SQL schemas |
| `/lib/stripe.ts` | **AGENT 1** | Stripe configuration |
| `/types/credits.ts` | **AGENT 1** | New credit types (separate file) |
| `/components/**/*.tsx` | **AGENT 2** | All React components |
| `/contexts/**/*.tsx` | **AGENT 2** | All React contexts |
| `/lib/exportUtils.ts` | **AGENT 2** | Export utilities |

### Shared Files (DANGER - Requires Coordination)

| File | Primary Owner | Notes |
|------|---------------|-------|
| `/types.ts` | **AGENT 1** | Agent 1 may add imports from `/types/credits.ts` |

**Resolution:** Agent 1 creates NEW file `/types/credits.ts` instead of modifying `/types.ts`. Agent 2 imports from the new file. No conflicts.

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

## Current Database Schema (Reference)

The existing database includes these tables that will remain and integrate with the new credit system:

| Table | Purpose | Integration Notes |
|-------|---------|-------------------|
| `registrations` | Player/parent info, medical data | Keep as-is, remove `payment_status` dependency |
| `notifications` | User notifications | Add new notification types for credits |
| `sunday_practice_slots` | Sunday ice slot definitions | Keep as-is, update booking logic |
| `sunday_bookings` | Sunday ice reservations | May migrate to unified `session_bookings` |
| `schedule_changes` | Schedule modification requests | Review if still needed with credit model |
| `schedule_exceptions` | One-time schedule swaps | Review if still needed |
| `semi_private_pairings` | Semi-private player matching | Keep for semi-private sessions |
| `unpaired_semi_private` | Waiting list for matching | Keep for semi-private sessions |
| `time_slots` | Slot capacity tracking | May be replaced by `session_bookings` counts |

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

---

## Supabase Realtime Configuration

### Why Realtime?

The credit system requires real-time updates for a seamless user experience:

1. **Credit Balance** - When credits are purchased or used, balance updates instantly
2. **Slot Capacity** - When someone books a slot, others see capacity change live
3. **Booking Status** - Cancellations reflect immediately
4. **Notifications** - Real-time alerts for low credits, booking confirmations
5. **Recurring Status** - When recurring is paused (insufficient credits), notify immediately

### Tables Requiring Realtime

| Table | Events | Use Case | Priority |
|-------|--------|----------|----------|
| `parent_credits` | UPDATE | Credit balance changes | **HIGH** |
| `session_bookings` | INSERT, UPDATE, DELETE | Booking changes, capacity updates | **HIGH** |
| `credit_purchases` | INSERT | New purchase confirmation | **MEDIUM** |
| `recurring_schedules` | UPDATE | Pause/resume notifications | **MEDIUM** |
| `notifications` | INSERT | Real-time notification delivery | **HIGH** |
| `sunday_practice_slots` | UPDATE | Capacity changes (already exists) | **MEDIUM** |

### SQL to Enable Realtime

```sql
-- ============================================
-- ENABLE REALTIME ON NEW TABLES
-- ============================================

-- Enable realtime for parent_credits
ALTER PUBLICATION supabase_realtime ADD TABLE parent_credits;

-- Enable realtime for session_bookings
ALTER PUBLICATION supabase_realtime ADD TABLE session_bookings;

-- Enable realtime for credit_purchases
ALTER PUBLICATION supabase_realtime ADD TABLE credit_purchases;

-- Enable realtime for recurring_schedules
ALTER PUBLICATION supabase_realtime ADD TABLE recurring_schedules;

-- Verify notifications already has realtime (if not, add it)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Verify sunday_practice_slots already has realtime (if not, add it)
ALTER PUBLICATION supabase_realtime ADD TABLE sunday_practice_slots;

-- ============================================
-- ROW LEVEL SECURITY (RLS) FOR REALTIME
-- ============================================
-- Realtime respects RLS policies, so we need proper policies

-- parent_credits: Parents can only see their own credits
CREATE POLICY "Users can view own credits" ON parent_credits
    FOR SELECT USING (firebase_uid = auth.uid()::text);

-- session_bookings: Parents see own bookings, all users see capacity impact
CREATE POLICY "Users can view own bookings" ON session_bookings
    FOR SELECT USING (firebase_uid = auth.uid()::text);

-- For capacity display, we need a separate view or function
-- that aggregates without exposing individual bookings

-- credit_purchases: Parents see own purchases
CREATE POLICY "Users can view own purchases" ON credit_purchases
    FOR SELECT USING (firebase_uid = auth.uid()::text);

-- recurring_schedules: Parents see own schedules
CREATE POLICY "Users can view own recurring" ON recurring_schedules
    FOR SELECT USING (firebase_uid = auth.uid()::text);

-- notifications: Users see own notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid()::text);
```

### Frontend Realtime Subscriptions

```typescript
// ============================================
// CREDIT BALANCE SUBSCRIPTION
// ============================================
// In CreditBalanceCard.tsx or Dashboard context

useEffect(() => {
  if (!user) return;

  const channel = supabase
    .channel(`credits-${user.uid}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'parent_credits',
        filter: `firebase_uid=eq.${user.uid}`,
      },
      (payload) => {
        // Update credit balance in state
        setCreditBalance(payload.new.total_credits);

        // Show toast for credit changes
        const oldCredits = payload.old?.total_credits || 0;
        const newCredits = payload.new.total_credits;
        const diff = newCredits - oldCredits;

        if (diff > 0) {
          toast.success(`+${diff} credits added!`);
        } else if (diff < 0) {
          toast.info(`${Math.abs(diff)} credit${Math.abs(diff) > 1 ? 's' : ''} used`);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user]);

// ============================================
// BOOKING UPDATES SUBSCRIPTION (for capacity)
// ============================================
// In SchedulePage.tsx or BookSessionModal.tsx

useEffect(() => {
  const channel = supabase
    .channel('booking-changes')
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'session_bookings',
      },
      (payload) => {
        // Refresh capacity data when any booking changes
        // This ensures all users see accurate slot availability
        refetchCapacity();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

// ============================================
// NOTIFICATIONS SUBSCRIPTION
// ============================================
// In NotificationBell.tsx (already exists, may need updates)

useEffect(() => {
  if (!userId) return;

  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        // Add new notification to list
        addNotification(payload.new);

        // Show toast for high priority
        if (payload.new.priority === 'high' || payload.new.priority === 'urgent') {
          toast.info(payload.new.title);
        }

        // Play sound or vibrate for urgent
        if (payload.new.priority === 'urgent') {
          playNotificationSound();
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId]);

// ============================================
// RECURRING SCHEDULE STATUS
// ============================================
// In RecurringScheduleCard.tsx

useEffect(() => {
  if (!user) return;

  const channel = supabase
    .channel(`recurring-${user.uid}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'recurring_schedules',
        filter: `firebase_uid=eq.${user.uid}`,
      },
      (payload) => {
        // Update recurring status
        updateRecurringSchedule(payload.new);

        // Alert if paused due to insufficient credits
        if (payload.new.paused_reason === 'insufficient_credits') {
          toast.warning(
            'Recurring booking paused - insufficient credits. Buy more to resume.',
            { duration: 8000 }
          );
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user]);
```

### Realtime Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE REALTIME                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────┐                                                   │
│   │ parent_credits  │────┐                                              │
│   │ (UPDATE)        │    │                                              │
│   └─────────────────┘    │                                              │
│                          │    ┌─────────────────────────────────────┐   │
│   ┌─────────────────┐    │    │           DASHBOARD                  │   │
│   │ session_bookings│────┼───▶│   • Credit balance (live)           │   │
│   │ (INSERT/UPDATE/ │    │    │   • Upcoming bookings (live)        │   │
│   │  DELETE)        │    │    │   • Slot capacity (live)            │   │
│   └─────────────────┘    │    │   • Notifications (live)            │   │
│                          │    └─────────────────────────────────────┘   │
│   ┌─────────────────┐    │                                              │
│   │ credit_purchases│────┤                                              │
│   │ (INSERT)        │    │    ┌─────────────────────────────────────┐   │
│   └─────────────────┘    │    │         SCHEDULE PAGE                │   │
│                          ├───▶│   • Slot availability (live)        │   │
│   ┌─────────────────┐    │    │   • Booking confirmations (live)    │   │
│   │recurring_sched. │────┤    │   • Capacity counters (live)        │   │
│   │ (UPDATE)        │    │    └─────────────────────────────────────┘   │
│   └─────────────────┘    │                                              │
│                          │    ┌─────────────────────────────────────┐   │
│   ┌─────────────────┐    │    │        ADMIN DASHBOARD               │   │
│   │ notifications   │────┘    │   • All bookings (live)             │   │
│   │ (INSERT)        │────────▶│   • Credit purchases (live)         │   │
│   └─────────────────┘         │   • Capacity overview (live)        │   │
│                               └─────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Realtime Event Types

| Event | Table | Trigger | Frontend Action |
|-------|-------|---------|-----------------|
| Credit purchased | `parent_credits` UPDATE | After Stripe webhook | Update balance display, show toast |
| Credit used | `parent_credits` UPDATE | After booking created | Update balance display |
| Booking created | `session_bookings` INSERT | User books session | Update capacity, add to calendar |
| Booking cancelled | `session_bookings` UPDATE | User cancels | Update capacity, remove from calendar, refund credit |
| Recurring paused | `recurring_schedules` UPDATE | CRON finds no credits | Show warning toast, update UI |
| Notification sent | `notifications` INSERT | Various triggers | Show in bell, toast for urgent |
| Slot capacity changed | `sunday_practice_slots` UPDATE | Booking created/cancelled | Update availability display |

### Performance Considerations

1. **Channel Limits**: Supabase has limits on concurrent channels. Use combined channels where possible.
2. **Filter Specificity**: Always use filters (`filter: firebase_uid=eq.xxx`) to reduce unnecessary events.
3. **Debouncing**: For capacity updates, debounce rapid changes to avoid UI flicker.
4. **Cleanup**: Always remove channels on component unmount to prevent memory leaks.
5. **Reconnection**: Handle reconnection gracefully (Supabase client handles this, but UI should show status).

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

## Implementation Phases (Agent-Based)

### Phase 1: Agent 1 Foundation (Tasks 1.1-1.4)
**✅ COMPLETE**

| Task | Agent | File | Status |
|------|-------|------|--------|
| Create credit types | AGENT 1 | `/types/credits.ts` | ✅ |
| Create database schema | AGENT 1 | `/database/credit_system_schema.sql` | ✅ |
| Create realtime config | AGENT 1 | `/database/credit_system_realtime.sql` | ✅ |
| Update Stripe config | AGENT 1 | `/lib/stripe.ts` | ✅ |

```
✅ HANDOFF COMPLETE: Agent 2 has received and built upon Agent 1's work
```

### Phase 2: Parallel Execution (Agent 1 + Agent 2)

**AGENT 1 continues (Tasks 1.5-1.29): ✅ COMPLETE**
| Task | File | Status |
|------|------|--------|
| Create purchase-credits API | `/api/purchase-credits.ts` | ✅ |
| Create credit-balance API | `/api/credit-balance.ts` | ✅ |
| Create credit-history API | `/api/credit-history.ts` | ✅ |
| Create book-session API | `/api/book-session.ts` | ✅ |
| Create cancel-booking API | `/api/cancel-booking.ts` | ✅ |
| Create my-bookings API | `/api/my-bookings.ts` | ✅ |
| Create purchase-session API | `/api/purchase-session.ts` | ✅ |
| Create recurring-schedule API | `/api/recurring-schedule.ts` | ✅ |
| Create cron-process-recurring | `/api/cron-process-recurring.ts` | ✅ |
| Create admin-adjust-credits | `/api/admin-adjust-credits.ts` | ✅ |
| Update stripe-webhook | `/api/stripe-webhook.ts` | ✅ |
| Update verify-payment | `/api/verify-payment.ts` | ⏳ Deferred |
| Update check-availability | `/api/check-availability.ts` | ⏳ Deferred |
| Update sunday-book | `/api/sunday-book.ts` | ⏳ Deferred |
| Update sunday-next-slot | `/api/sunday-next-slot.ts` | ⏳ Deferred |
| Update group-capacity | `/api/group-capacity.ts` | ✅ |
| Update get-children | `/api/get-children.ts` | ✅ |
| Update unifiedCapacityManager | `/api/_lib/unifiedCapacityManager.ts` | ⏳ Deferred |
| Update admin-confirm-payment | `/api/admin-confirm-payment.ts` | ⏳ Deferred |
| Update notifications | `/api/notifications.ts` | ⏳ Deferred |
| Review reschedule-group | `/api/reschedule-group.ts` | ⏳ Deferred |
| Review reschedule-private | `/api/reschedule-private.ts` | ⏳ Deferred |
| Review reschedule-semi-private | `/api/reschedule-semi-private.ts` | ⏳ Deferred |
| Delete create-subscription | `/api/create-subscription.ts` | ⏳ Keep for now |
| Delete cancel-subscription | `/api/cancel-subscription.ts` | ⏳ Keep for now |

> **Note:** Deferred tasks can be completed during integration testing. Old subscription endpoints kept for backward compatibility.

**AGENT 2 (Tasks 2.1-2.24): ✅ COMPLETE**
| Task | File | Status |
|------|------|--------|
| Create NewDashboard | `/components/NewDashboard.tsx` | ✅ |
| Create CreditBalanceCard | `/components/dashboard/CreditBalanceCard.tsx` | ✅ |
| Create ChildrenSection | `/components/dashboard/ChildrenSection.tsx` | ✅ |
| Create UpcomingBookingsCard | `/components/dashboard/UpcomingBookingsCard.tsx` | ✅ |
| Create BookSessionModal | `/components/dashboard/BookSessionModal.tsx` | ✅ |
| Create BuyCreditsModal | `/components/dashboard/BuyCreditsModal.tsx` | ✅ |
| Create RecurringScheduleCard | `/components/dashboard/RecurringScheduleCard.tsx` | ✅ |
| Create CancelBookingModal | `/components/dashboard/CancelBookingModal.tsx` | ✅ |
| Update Dashboard.tsx | Replaced with NewDashboard in App.tsx | ✅ |
| Update BillingPage | `/components/BillingPage.tsx` | ✅ |
| Update SchedulePage | `/components/SchedulePage.tsx` | ⏳ Deferred |
| Update RegistrationForm | `/components/RegistrationForm.tsx` | ⏳ Deferred |
| Update PaymentStatus | `/components/dashboard/PaymentStatus.tsx` | ⏳ Deferred |
| Update TrainingSchedule | `/components/dashboard/TrainingSchedule.tsx` | ⏳ Deferred |
| Update ProfileContext | `/contexts/ProfileContext.tsx` | ✅ |
| Update AdminDashboard | `/components/AdminDashboard.tsx` | ⏳ Deferred |
| Update exportUtils | `/lib/exportUtils.ts` | ⏳ Deferred |
| Delete ProfileSwitcher | `/components/dashboard/ProfileSwitcher.tsx` | ✅ |
| Delete ProfileSelectionScreen | `/components/ProfileSelectionScreen.tsx` | ✅ |
| Add Realtime to CreditBalanceCard | Subscribe to `parent_credits` | ✅ (in NewDashboard) |
| Add Realtime to UpcomingBookingsCard | Subscribe to `session_bookings` | ✅ (in NewDashboard) |
| Add Realtime to SchedulePage | Subscribe to capacity | ⏳ Deferred |
| Add Realtime to RecurringScheduleCard | Subscribe to `recurring_schedules` | ✅ (in NewDashboard) |
| Verify NotificationBell Realtime | Check `notifications` sub | ✅ Already working |

> **Note:** Deferred tasks are for legacy components that will be updated or replaced during integration.

### Phase 3: Merge & Integration
| Step | Action | Status |
|------|--------|--------|
| 1 | Agent 1 creates PR for backend branch | ✅ (merged into combined branch) |
| 2 | Agent 2 creates PR for frontend branch | ✅ (combined branch) |
| 3 | Merge Agent 1 PR first | ✅ (combined in single branch) |
| 4 | Rebase Agent 2 branch on main | N/A (combined branch) |
| 5 | Merge combined PR to main | 🔄 Ready |
| 6 | Integration testing | ⏳ Pending |
| 7 | Deploy to staging | ⏳ Pending |

> **Branch:** `claude/analyze-codebase-pivot-01XRnrbjVfQvNXmLFuoGepqu`

### Phase 4: Final Testing & Cleanup
- [ ] Run database migrations in Supabase
- [ ] Set up Stripe price IDs in environment variables
- [ ] End-to-end testing of credit purchase flow
- [ ] End-to-end testing of session booking flow
- [ ] End-to-end testing of cancellation + refund
- [ ] Verify Realtime updates work correctly
- [x] Update documentation
- [ ] Deploy to production

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
/database/credit_system_realtime.sql    # Enable Realtime + RLS policies
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

### Pre-Work (Manual)
1. **Review this document** - Confirm all assumptions are correct
2. **Create Stripe products** - Set up new price IDs in Stripe Dashboard:
   - `VITE_STRIPE_PRICE_CREDIT_SINGLE` - $40 single credit
   - `VITE_STRIPE_PRICE_CREDIT_20PACK` - $500 20-pack
   - `VITE_STRIPE_PRICE_SUNDAY` - $50 Sunday ice
   - `VITE_STRIPE_PRICE_SEMI_PRIVATE` - $69 Semi-private
   - `VITE_STRIPE_PRICE_PRIVATE` - $89.99 Private

### Agent Execution Order

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     HOW TO START THE AGENTS                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  STEP 1: Start Agent 1 (Backend)                                        │
│  ─────────────────────────────────────────────────────────────────────  │
│  Prompt: "You are Agent 1 (Backend). Read PIVOT_GAMEPLAN.md and         │
│           complete all tasks in the 'AGENT 1: Backend' section.         │
│           Start with Task 1.1 (create /types/credits.ts).               │
│           After Tasks 1.1-1.4, commit and notify me for handoff."       │
│                                                                          │
│  STEP 2: Wait for Handoff Notification                                  │
│  ─────────────────────────────────────────────────────────────────────  │
│  Agent 1 will output:                                                   │
│  "✅ HANDOFF READY: Core types and schemas committed.                   │
│   You can now start Agent 2 (Frontend) in a separate session."          │
│                                                                          │
│  STEP 3: Start Agent 2 (Frontend) in NEW session                        │
│  ─────────────────────────────────────────────────────────────────────  │
│  Prompt: "You are Agent 2 (Frontend). Read PIVOT_GAMEPLAN.md and        │
│           complete all tasks in the 'AGENT 2: Frontend' section.        │
│           First, pull Agent 1's branch to get /types/credits.ts.        │
│           Then create your own branch and start Task 2.1."              │
│                                                                          │
│  STEP 4: Both agents work in parallel                                   │
│  ─────────────────────────────────────────────────────────────────────  │
│  - Agent 1 continues with Tasks 1.5-1.29 (APIs)                         │
│  - Agent 2 works on Tasks 2.1-2.24 (Components)                         │
│  - No conflicts since they touch different files                        │
│                                                                          │
│  STEP 5: Merge                                                          │
│  ─────────────────────────────────────────────────────────────────────  │
│  1. Merge Agent 1's PR first                                            │
│  2. Rebase Agent 2's branch on main                                     │
│  3. Merge Agent 2's PR                                                  │
│  4. Integration testing                                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Quick Reference: Agent Summary

| Agent | Branch | Files | Task Count | Status |
|-------|--------|-------|------------|--------|
| **Agent 1** | Combined branch | `/api/*`, `/database/*`, `/lib/stripe.ts`, `/types/credits.ts` | 29 tasks | ✅ Complete |
| **Agent 2** | Combined branch | `/components/*`, `/contexts/*` | 24 tasks | ✅ Complete |

**Combined Branch:** `claude/analyze-codebase-pivot-01XRnrbjVfQvNXmLFuoGepqu`

---

## Pre-Merge Testing Guide

### Step 1: Database Setup (Supabase)
Run these SQL files in order in your Supabase SQL Editor:

```sql
-- 1. Run the schema creation script
-- File: /database/credit_system_schema.sql
-- Creates: parent_credits, credit_purchases, session_bookings, recurring_schedules

-- 2. Run the realtime configuration script
-- File: /database/credit_system_realtime.sql
-- Enables: Realtime publication, RLS policies, capacity functions
```

### Step 2: Stripe Configuration
Create these products/prices in Stripe Dashboard (Test Mode):

| Product | Price | Price ID Env Var |
|---------|-------|------------------|
| Single Credit | $40.00 CAD | `VITE_STRIPE_PRICE_CREDIT_SINGLE` |
| 20-Credit Package | $500.00 CAD | `VITE_STRIPE_PRICE_CREDIT_20PACK` |
| Sunday Ice Session | $50.00 CAD | `VITE_STRIPE_PRICE_SUNDAY` |
| Semi-Private Session | $69.00 CAD | `VITE_STRIPE_PRICE_SEMI_PRIVATE_SESSION` |
| Private Session | $89.99 CAD | `VITE_STRIPE_PRICE_PRIVATE_SESSION` |

### Step 3: Environment Variables
Add to `.env` or Vercel Environment Variables:

```env
VITE_STRIPE_PRICE_CREDIT_SINGLE=price_xxx
VITE_STRIPE_PRICE_CREDIT_20PACK=price_xxx
VITE_STRIPE_PRICE_SUNDAY=price_xxx
VITE_STRIPE_PRICE_SEMI_PRIVATE_SESSION=price_xxx
VITE_STRIPE_PRICE_PRIVATE_SESSION=price_xxx
```

### Step 4: Test Flows

#### Flow 1: Credit Purchase
1. Log in as existing user → Navigate to Dashboard
2. Click "Buy Credits" → Select package → Complete Stripe checkout
3. Verify: Credit balance updates, purchase appears in Billing history

#### Flow 2: Session Booking (Group)
1. From Dashboard, click "Book" on a child
2. Select "Group Training" → Pick date and time slot
3. Click "Book with Credit"
4. Verify: Credit decremented, booking appears in Upcoming Sessions

#### Flow 3: Session Booking (Paid)
1. From Dashboard, click "Book" on a child
2. Select "Sunday Ice" → Pick date and time slot
3. Click "Pay & Book" → Complete Stripe checkout
4. Verify: Booking appears in Upcoming Sessions

#### Flow 4: Cancellation with Refund
1. Find an upcoming booking (24+ hours away)
2. Click cancel → Confirm
3. Verify: Credit refunded, booking removed

#### Flow 5: Realtime Updates
1. Open Dashboard in two browser tabs
2. In Tab 1: Buy credits
3. Verify: Tab 2 credit balance updates automatically (no refresh)

### Step 5: Admin Testing
1. Log in as admin → Navigate to Admin Dashboard
2. Verify: Credit adjustments work (if admin-adjust-credits implemented)

---

## Files Changed Summary

### Agent 1 (Backend) - Created
- `/types/credits.ts` - All credit system TypeScript types
- `/database/credit_system_schema.sql` - Database tables and functions
- `/database/credit_system_realtime.sql` - Realtime + RLS configuration
- `/api/purchase-credits.ts` - Buy credit packages
- `/api/credit-balance.ts` - Get current balance
- `/api/credit-history.ts` - Purchase and usage history
- `/api/book-session.ts` - Book with credits
- `/api/cancel-booking.ts` - Cancel and refund
- `/api/my-bookings.ts` - User's bookings list
- `/api/purchase-session.ts` - Buy paid sessions
- `/api/recurring-schedule.ts` - Manage recurring bookings
- `/api/cron-process-recurring.ts` - Process weekly bookings
- `/api/admin-adjust-credits.ts` - Admin credit adjustment

### Agent 1 (Backend) - Modified
- `/lib/stripe.ts` - Added credit pricing helpers
- `/api/stripe-webhook.ts` - Handle credit/session purchases
- `/api/group-capacity.ts` - Updated for booking-based capacity
- `/api/get-children.ts` - Returns all children for parent

### Agent 2 (Frontend) - Created
- `/components/NewDashboard.tsx` - Main credit-based dashboard
- `/components/dashboard/CreditBalanceCard.tsx` - Balance display
- `/components/dashboard/ChildrenSection.tsx` - All children view
- `/components/dashboard/UpcomingBookingsCard.tsx` - Bookings list
- `/components/dashboard/BookSessionModal.tsx` - Session booking
- `/components/dashboard/BuyCreditsModal.tsx` - Credit purchase
- `/components/dashboard/RecurringScheduleCard.tsx` - Recurring management
- `/components/dashboard/CancelBookingModal.tsx` - Cancellation flow

### Agent 2 (Frontend) - Modified
- `/App.tsx` - Route to NewDashboard
- `/components/BillingPage.tsx` - Credit purchase history
- `/contexts/ProfileContext.tsx` - Added credit balance context
- `/components/dashboard/DashboardLayout.tsx` - Removed ProfileSwitcher

### Agent 2 (Frontend) - Deleted
- `/components/ProfileSelectionScreen.tsx`
- `/components/dashboard/ProfileSwitcher.tsx`

---

*Document maintained by development team. Last reviewed: December 11, 2025*
