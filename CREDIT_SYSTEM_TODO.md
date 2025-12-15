# Credit System - Implementation Complete

> **Created:** December 11, 2025
> **Last Updated:** December 15, 2025
> **Status:** COMPLETE - System Live

---

## Summary

The credit-based payment system has been fully implemented and deployed. Parents can now:
- Sign up and add multiple children
- Buy credit packages ($45 single, $350 for 10, $500 for 20)
- Book any available session using credits
- Set up recurring weekly bookings
- View schedule and upcoming sessions

---

## User Flows

### New Parent Registration
1. Visit `/signup` → Create account (email + password + name)
2. Redirected to `/dashboard` → Welcome screen
3. Click "Add Player" → Enter child's name, DOB (category auto-calculated)
4. Child appears in dashboard → Ready to buy credits and book!

### Buying Credits
1. From Dashboard, click "Buy Credits"
2. Select package: 1 ($45), 10 ($350), or 20 ($500)
3. Complete Stripe checkout
4. Credits added to balance (shared across all children)

### Booking a Session
1. From Dashboard, click "Book" on any child
2. Select session type:
   - **Group Training** (1 credit)
   - **Sunday Ice** ($50 direct pay)
   - **Semi-Private** ($69 direct pay)
   - **Private** ($89.99 direct pay)
3. Pick date and time slot
4. Confirm booking

### Setting Up Recurring Bookings
1. From Dashboard, find "Recurring Schedules" card
2. Click "Set Up Recurring"
3. Select child and day of week
4. Time slot auto-assigned based on age category
5. 1 credit deducted weekly (pauses if credits run out)

---

## Completed Features

### Core Credit System
- [x] Database schema (parent_credits, credit_purchases, session_bookings, recurring_schedules)
- [x] RLS policies for security
- [x] Realtime subscriptions for live balance updates

### APIs
- [x] `/api/credit-balance` - Get parent's credit balance
- [x] `/api/purchase-credits` - Buy credit packages via Stripe
- [x] `/api/book-session` - Book using credits or pay directly
- [x] `/api/cancel-booking` - Cancel and refund credits
- [x] `/api/my-bookings` - List all bookings for a parent
- [x] `/api/recurring-schedule` - CRUD for recurring schedules
- [x] `/api/add-child` - Add a child to parent account

### Frontend Components
- [x] `NewDashboard` - Main parent dashboard with all features
- [x] `CreditBalanceCard` - Shows balance + buy options
- [x] `ChildrenSection` - List all children with book buttons
- [x] `UpcomingBookingsCard` - Shows upcoming sessions
- [x] `RecurringScheduleCard` - Manage recurring bookings
- [x] `BookSessionModal` - Date/time picker for booking
- [x] `SetupRecurringModal` - Configure recurring schedule
- [x] `SchedulePage` - Calendar view of actual bookings
- [x] `AddChildModal` - Quick add child form
- [x] `SignupPage` - Simple signup for new parents

### Admin Features
- [x] Credit summary dashboard
- [x] Search users by email/name
- [x] View credit history
- [x] Adjust credits manually (admin only)

---

## Stripe Products (Production)

| Product | Price (CAD) | Type |
|---------|-------------|------|
| 1 Session | $45.00 | Credit purchase |
| 10-Session Package | $350.00 ($35/session) | Credit purchase |
| 20-Session Package | $500.00 ($25/session) | Credit purchase |
| Sunday Ice Practice | $50.00 | Direct purchase |
| Semi-Private Session | $69.00 | Direct purchase |
| Private Session | $89.99 | Direct purchase |

---

## Time Slots by Age Category

### Group Training (1 Credit - Weekdays Only)
| Category | Time Slot | Max Capacity |
|----------|-----------|--------------|
| M7, M9, M11 | 4:30 PM | 6 players |
| M13, M13 Elite | 5:45 PM | 6 players |
| M15, M15 Elite | 7:00 PM | 6 players |
| M18, Junior | 8:15 PM | 6 players |

**Note:** Group training is NOT available on Sundays. Each age category can only book their assigned time slot.

### Sunday Ice ($50 Direct Pay - Sundays Only)
| Category | Time Slot | Max Capacity |
|----------|-----------|--------------|
| M7, M9, M11 | 7:30 AM | 15 players |
| M13, M13 Elite, M15, M15 Elite | 8:30 AM | 15 players |
| M18, Junior | **Not eligible** | - |

**Note:** Sunday Ice is only available on Sundays. M18/Junior are not eligible.

### Private Training ($89.99 Direct Pay)
- **Available:** 7 days a week
- **Time Slots:** 8:00 AM - 4:00 PM (hourly)
- **Capacity:** 1 player per slot
- **No age category restrictions** - all players see all times

### Semi-Private Training ($69 Direct Pay)
- **Available:** 7 days a week
- **Time Slots:** 8:00 AM - 4:00 PM (hourly)
- **Capacity:** 3 players per slot
- **No age category restrictions** - all players see all times

---

## Technical Notes

### Why Inline Supabase Clients?
Admin API files use inline Supabase client creation instead of importing from `lib/supabase.ts`. This is because Vercel's serverless bundling only includes files matching `api/_lib/**` in the function bundle.

### Database Tables
- `parent_credits` - Credit balance per parent (firebase_uid)
- `credit_purchases` - Purchase history with Stripe payment IDs
- `session_bookings` - Individual session bookings
- `recurring_schedules` - Weekly recurring booking configurations
- `registrations` - Child profiles (form_data contains player info)

### Deprecated Fields
The following fields in `form_data` are deprecated (from old subscription model):
- `groupFrequency` (1x/2x per week)
- `groupSelectedDays` (pre-assigned training days)
- `groupMonthlyDates` (calculated dates)

---

*Last updated: December 15, 2025*
