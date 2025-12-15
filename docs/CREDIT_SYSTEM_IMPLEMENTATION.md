# SniperZone Credit System Implementation Documentation

## Overview
**Date Started**: December 14, 2025
**Date Completed**: December 15, 2025
**Status**: ✅ COMPLETE - All issues resolved

## System Architecture

### Credit-Based Payment Model
Parents purchase credits that are shared across all their children:
- **Single Session**: $45 (1 credit)
- **10-Session Pack**: $350 (10 credits, $35/session)
- **20-Session Pack**: $500 (20 credits, $25/session)

### Direct-Pay Sessions (No Credits)
- **Sunday Ice Practice**: $50/session
- **Semi-Private Training**: $69/session
- **Private Training**: $89.99/session

---

## Database Schema

### Core Tables
| Table | Purpose |
|-------|---------|
| `parent_credits` | Parent-level credit balance (`firebase_uid`, `total_credits`) |
| `credit_purchases` | Log of all credit purchases with expiry tracking |
| `session_bookings` | All session reservations (group, sunday, private, semi_private) |
| `credit_adjustments` | Admin credit adjustments with audit trail |
| `recurring_schedules` | Weekly recurring booking configurations |

### Key Relationships
- Credits are tracked at parent level (`firebase_uid`)
- Each booking links to a specific registration (child)
- FIFO credit usage - oldest credits used first

---

## API Endpoints

### Credit APIs
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/credit-balance` | GET | Get parent's credit balance |
| `/api/purchase-credits` | POST | Buy credit packages via Stripe |
| `/api/credit-history` | GET | Get purchase and usage history |

### Booking APIs
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/book-session` | POST | Book session with credits |
| `/api/purchase-session` | POST | Buy direct-pay sessions |
| `/api/my-bookings` | GET | Get all bookings for parent |
| `/api/cancel-booking` | POST | Cancel with credit refund (24h+ advance) |

### Admin APIs
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/credit-summary` | GET | Credit system statistics |
| `/api/admin/credit-search` | GET | Search users by email/name |
| `/api/admin/credit-history` | GET | User credit history |
| `/api/admin-adjust-credits` | POST | Manual credit adjustments |

---

## Frontend Components

### Dashboard (`/dashboard`)
- **NewDashboard.tsx** - Main parent dashboard
- **CreditBalanceCard.tsx** - Shows credits, buy button
- **ChildrenSection.tsx** - All registered children
- **UpcomingBookingsCard.tsx** - Upcoming sessions
- **BookSessionModal.tsx** - Book new sessions
- **BuyCreditsModal.tsx** - Purchase credits
- **RecurringScheduleCard.tsx** - Recurring bookings

### Signup Flow
- **SignupPage.tsx** - New user registration
- **AddChildModal.tsx** - Add children from dashboard

---

## Issues Resolved

### 1. Admin Credit APIs 500 Errors ✅
**Problem**: Admin dashboard "Credits" tab showed "Error: Failed to fetch credit summary"

**Root Causes**:
- Wrong import types (`NextApiRequest` instead of `VercelRequest`)
- Wrong column names (`amount` vs `price_paid`, `credits` vs `credits_purchased`)
- `parent_email` queried from wrong table

**Fix Applied** (December 15, 2025):
```typescript
// api/admin/credit-summary.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
// Changed: amount → price_paid, credits → credits_purchased

// api/admin/credit-search.ts
// Rewrote to search registrations table for parent_email
// Fixed form_data keys: player_name → playerFullName
```

### 2. Client-side Supabase Admin Error ✅
**Problem**: `SUPABASE ADMIN ERROR: Missing service role key`

**Fix**: Lazy proxy with window check in `/lib/supabase.ts`

### 3. Legacy Trigger Errors ✅
**Problem**: `relation "public.time_slots" does not exist` in trigger

**Fix**: Created migration to drop all triggers referencing deleted tables

### 4. JSX Build Errors ✅
**Problem**: Syntax errors in AdminCreditDashboard.tsx

**Fix**: Corrected parentheses and fragment closures

---

## Environment Variables

All configured in Vercel:

```env
# Stripe Price IDs
VITE_STRIPE_PRICE_CREDIT_SINGLE=price_1QYXXgLVFXNyqcE1VY1OG8mG
VITE_STRIPE_PRICE_CREDIT_10PACK=price_1QYXYQLVFXNyqcE1gQF8DF1t
VITE_STRIPE_PRICE_CREDIT_20PACK=price_1QYXYtLVFXNyqcE1tPQN4nYt
VITE_STRIPE_PRICE_SUNDAY=price_1QYXZOLVFXNyqcE1QZLc7HbV
VITE_STRIPE_PRICE_SEMI_PRIVATE_SESSION=price_1QYXZnLVFXNyqcE1jOt8XKVR
VITE_STRIPE_PRICE_PRIVATE_SESSION=price_1QYXaGLVFXNyqcE1vJ7DHKPX

# Supabase
SUPABASE_SERVICE_ROLE_KEY=*** (configured)
SUPABASE_URL=*** (configured)
SUPABASE_ANON_KEY=*** (configured)
```

---

## Migration Files

| File | Purpose | Status |
|------|---------|--------|
| `20251211_remove_session_type_restrictions.sql` | Allow all session types | ✅ Applied |
| `20251214_credit_system_schema.sql` | Core tables | ✅ Applied |
| `20251214_report_templates.sql` | Reporting tables | ✅ Applied |
| `20251214_credit_system_realtime.sql` | Realtime subscriptions | ✅ Applied |
| `20251214_drop_legacy_tables.sql` | Remove old tables | ✅ Applied |
| `20251215_cleanup_legacy_triggers.sql` | Remove problematic triggers | ✅ Applied |

---

## User Flows

### New User Registration
1. `/signup` → Create account with email/password
2. Redirect to `/dashboard` → Welcome screen (no children)
3. Click "Add Player" → Fill child details
4. Dashboard shows child → Ready to buy credits

### Credit Purchase
1. Dashboard → Click "Buy Credits"
2. Select package (Single/10-pack/20-pack)
3. Stripe Checkout → Complete payment
4. Redirect to dashboard → Balance updated

### Session Booking (Credits)
1. Dashboard → Click "Book" on child
2. Select "Group Training"
3. Choose date/time → Click "Book with Credit"
4. Credit deducted → Booking confirmed

### Session Booking (Direct Pay)
1. Dashboard → Click "Book" on child
2. Select Sunday/Private/Semi-Private
3. Choose date/time → Stripe Checkout
4. Payment complete → Booking confirmed

### Cancellation
1. Dashboard → Find booking in "Upcoming Sessions"
2. Click "Cancel" → Confirm
3. If 24h+ advance: Credit refunded
4. Booking removed

---

## Technical Decisions

1. **Parent-Level Credits**: Shared across all children for flexibility
2. **FIFO Credit Usage**: Oldest credits consumed first (prevents expiry issues)
3. **24h Cancellation Policy**: Credits refunded only if cancelled 24h+ before session
4. **12-Month Expiry**: Credits expire 12 months after purchase
5. **Unified Booking Table**: All session types use `session_bookings`

---

## Admin Features

### Credit Management
- Search users by email or player name
- View complete credit history
- Manual credit adjustments with reason logging
- View system-wide credit statistics

### Audit Trail
All credit adjustments logged with:
- Admin email
- Reason for adjustment
- Balance before/after
- Timestamp

---

*Document last updated: December 15, 2025*
