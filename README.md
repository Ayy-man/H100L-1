# SniperZone Hockey Training Registration System

A comprehensive hockey training registration system with credit-based booking, Stripe payments, Supabase backend, and shadcn/ui components.

## Features

- **Credit-Based Booking System**
  - Buy credit packages ($45 single, $350 for 10, $500 for 20)
  - 1 credit = 1 group training session
  - Credits valid for 12 months
  - Shared across all children in family

- **Session Types**
  - Group Training (credit-based, Mon-Sat)
  - Sunday Ice Practice ($50 direct pay)
  - Semi-Private Training ($69 direct pay, 2-3 players)
  - Private Training ($89.99 direct pay, 1-on-1)

- **Time Slots by Age Category**
  - M7/M9/M11: 4:30 PM (weekday), 7:30 AM (Sunday)
  - M13/M13 Elite: 5:45 PM (weekday), 8:30 AM (Sunday)
  - M15/M15 Elite: 7:00 PM (weekday), 8:30 AM (Sunday)
  - M18/Junior: 8:15 PM (weekday only)

- **Parent Dashboard**
  - Multi-step Add Child form with full profile (emergency contact, medical info, consents)
  - Credit balance display with purchase history
  - Book sessions with calendar view
  - Set up recurring weekly bookings
  - View upcoming and past sessions

- **Admin Dashboard**
  - **Overview**: Registration list, stats, filters
  - **Analytics**: Charts, program distribution, capacity utilization
  - **Credits**: Manage balances, view purchases, adjust credits
  - **Bookings**: Daily operations, booking management, capacity planning, revenue reports
  - **Settings**: System configuration

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Vercel Serverless Functions, Supabase
- **Payments**: Stripe
- **Auth**: Firebase Authentication
- **Animations**: Framer Motion

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Stripe account (test mode for development)
- Firebase project

### Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Create a `.env` file:

```bash
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Firebase
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Credit Package Prices
VITE_STRIPE_PRICE_CREDIT_SINGLE=price_xxx    # $45
VITE_STRIPE_PRICE_CREDIT_10PACK=price_xxx    # $350
VITE_STRIPE_PRICE_CREDIT_20PACK=price_xxx    # $500

# Session Prices
VITE_STRIPE_PRICE_SUNDAY=price_xxx                    # $50
VITE_STRIPE_PRICE_SEMI_PRIVATE_SESSION=price_xxx      # $69
VITE_STRIPE_PRICE_PRIVATE_SESSION=price_xxx           # $89.99
```

3. **Set up Supabase database:**

Run these SQL scripts in Supabase SQL Editor:

```bash
database/credit_system_schema.sql      # Core tables
database/credit_system_realtime.sql    # Realtime + RLS
```

### Running the Development Server

**Important**: Use Vercel CLI for API routes:

```bash
npm run dev
```

This runs `vercel dev` which enables API routes at `/api/*`.

**Alternative** (frontend only):

```bash
npm run dev:vite
```

### Building for Production

```bash
npm run build
```

## Project Structure

```
├── api/                      # Vercel serverless API functions
│   ├── add-child.ts          # Add child with full profile
│   ├── purchase-credits.ts   # Buy credit packages
│   ├── book-session.ts       # Book with credits
│   ├── credit-balance.ts     # Get credit balance
│   ├── purchase-session.ts   # Buy paid sessions
│   ├── recurring-schedule.ts # Manage recurring bookings
│   ├── check-availability.ts # Check slot availability
│   ├── admin-adjust-credits.ts # Admin credit management
│   └── stripe-webhook.ts     # Handle Stripe webhooks
├── components/               # React components
│   ├── admin/                # Admin panel components
│   │   ├── AdminBookingsPanel.tsx  # Bookings management
│   │   ├── AdminCreditDashboard.tsx
│   │   └── CreditManagementPanel.tsx
│   ├── dashboard/            # Parent dashboard components
│   │   ├── AddChildModal.tsx      # Multi-step child registration
│   │   ├── BookSessionModal.tsx
│   │   ├── BuyCreditsModal.tsx
│   │   ├── SetupRecurringModal.tsx
│   │   └── ...
│   ├── form/                 # Legacy registration form steps
│   └── ui/                   # shadcn/ui components
├── lib/                      # Utilities
│   ├── stripe.ts             # Stripe configuration
│   ├── supabase.ts           # Supabase client
│   └── timeSlots.ts          # Time slot definitions
├── database/                 # SQL setup scripts
├── types/                    # TypeScript types
│   └── credits.ts            # Credit system types
└── types.ts                  # Core type definitions
```

## User Flows

### New Parent Registration
1. Sign up with email/password
2. Add child(ren) from dashboard (2-step form with emergency contact, medical info)
3. Buy credits
4. Book sessions

### Adding a Child
1. Click "Add Child" on dashboard
2. **Step 1**: Enter name, DOB (auto-calculates category), emergency contact
3. **Step 2**: Hockey info (position, hand, level, jersey), medical info, consents
4. Child appears in dashboard ready for booking

### Booking a Session
1. Click "Book" on child
2. Select session type (Group/Sunday/Private/Semi-Private)
3. Pick date - only eligible time slot shown
4. Confirm (deducts credit or redirects to Stripe)

### Recurring Bookings
1. Click "Set Up Recurring"
2. Select child and day
3. Time slot auto-assigned by age category
4. 1 credit deducted weekly

## Admin Panel

### Bookings Tab Features

| Feature | Description |
|---------|-------------|
| **Daily Operations** | Calendar view, today's sessions, attendance marking (attended/no-show) |
| **Booking Management** | Search, filter by type/status/date, cancel/update bookings |
| **Capacity Planning** | Visual slot utilization bars, week-by-week navigation |
| **Revenue & Reports** | Total bookings, credits used, direct revenue, breakdown by type |

## Documentation

- `CREDIT_SYSTEM_TODO.md` - Credit system details
- `PIVOT_GAMEPLAN.md` - Implementation history
- `TODO.md` - Current issues and improvements

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly (including build)
4. Submit a pull request

## License

Private - All rights reserved
