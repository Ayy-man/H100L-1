# SniperZone Hockey Training Registration System

A comprehensive hockey training registration system with Stripe payments, Supabase backend, and shadcn/ui components.

## Features

- 🏒 Multi-step registration form with validation
- 💳 Stripe payment integration with subscriptions
- 📅 7-day group training scheduling
- 👥 Capacity management for group and private sessions
- 📊 Admin dashboard with analytics
- 🌐 Bilingual support (English/French)
- 📱 Mobile-responsive design
- 🎨 Modern UI with shadcn/ui components

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Vercel Serverless Functions, Supabase
- **Payments**: Stripe
- **Animations**: Framer Motion

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Stripe account (test mode for development)

### Installation

1. **Clone the repository and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Create a `.env` file in the root directory:

```bash
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Stripe Price IDs (create these in Stripe Dashboard)
VITE_STRIPE_PRICE_GROUP_1X=price_xxx
VITE_STRIPE_PRICE_GROUP_2X=price_xxx
VITE_STRIPE_PRICE_PRIVATE_1X=price_xxx
VITE_STRIPE_PRICE_PRIVATE_2X=price_xxx
VITE_STRIPE_PRICE_SEMI_PRIVATE=price_xxx
```

See `.env.example` for a complete template.

3. **Set up Supabase database:**

Run the SQL scripts in the `database/` directory:

```bash
# In Supabase SQL Editor, run these in order:
database/capacity_setup.sql
database/registrations_view.sql
database/analytics_views.sql
database/semi_private_groups.sql
database/report_templates.sql
```

4. **Set up Supabase Storage:**

Follow instructions in `SUPABASE_STORAGE_SETUP.md` to create the medical files bucket.

### Running the Development Server

**Important**: This project uses Vercel serverless functions for API routes. To run the API routes locally, you must use:

```bash
npm run dev
```

This runs `vercel dev`, which:
- Automatically detects and runs your Vite dev server
- Enables API routes at `/api/*`
- Simulates the Vercel production environment

**Alternative** (frontend only, no API routes):

```bash
npm run dev:vite
```

This runs the Vite dev server directly, but **API features like "Check Availability" won't work**.

### Building for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
├── api/                      # Vercel serverless API functions
│   ├── check-availability.ts # Capacity checking endpoint
│   ├── create-subscription.ts# Stripe subscription creation
│   └── stripe-webhook.ts     # Stripe webhook handler
├── components/               # React components
│   ├── form/                 # Form step components
│   ├── ui/                   # shadcn/ui components
│   └── ...                   # Other components
├── lib/                      # Utilities and services
│   ├── capacityManager.ts    # Capacity management logic
│   ├── stripe.ts             # Stripe configuration
│   ├── supabase.ts           # Supabase client
│   └── ...                   # Other utilities
├── database/                 # SQL setup scripts
├── types.ts                  # TypeScript type definitions
└── constants.tsx             # App constants and translations
```

## Key Features

### Custom Dropdowns

The app includes custom dropdown components to fix Windows white background issues with native select elements. See `components/form/CustomSelect.tsx`.

### Capacity Management

Real-time capacity checking for group and private training sessions with cross-program time slot blocking. See `lib/unifiedCapacityManager.ts`.

### Payment Flow

1. User completes registration form (Steps 1-4)
2. Payment step (Step 5) with Stripe Elements
3. Subscription created via `/api/create-subscription`
4. Webhook updates payment status

### Admin Dashboard

Access at `/admin` with features:
- Registration overview with filtering
- Analytics and revenue charts
- Semi-private player matching
- Export capabilities (CSV, PDF, Excel)

## Troubleshooting

### "Could not connect to availability service"

This error occurs when API routes aren't available. Make sure you're running:

```bash
npm run dev  # NOT npm run dev:vite
```

### Stripe not loading

1. Check that `VITE_STRIPE_PUBLISHABLE_KEY` is set in `.env`
2. Verify the key starts with `pk_test_` (test mode) or `pk_live_` (production)
3. Restart the dev server after adding environment variables

### Database errors

1. Verify Supabase connection with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
2. Ensure all SQL scripts in `database/` have been run
3. Check RLS policies in Supabase dashboard

## Documentation

- `STRIPE_INTEGRATION_GAMEPLAN.md` - Complete Stripe setup guide
- `SUPABASE_STORAGE_SETUP.md` - File storage configuration
- `PLAYER_DOCUMENTS_FEATURES.md` - Document management features
- `CODEBASE_REVIEW_COMPLETE.md` - Detailed codebase analysis

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly (including build)
4. Submit a pull request

## License

Private - All rights reserved
