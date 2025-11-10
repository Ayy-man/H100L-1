# 🎯 Stripe Integration Gameplan for SniperZone

**Complete step-by-step guide for connecting client's Stripe account**

---

## 📋 Pre-Flight Checklist

- [ ] Client has a Stripe account (or create one at https://dashboard.stripe.com)
- [ ] Client has access to Vercel project settings
- [ ] Client has access to Supabase project settings
- [ ] You have the pricing structure confirmed

---

## 🔑 Phase 1: Stripe Account Setup

### Step 1.1: Access Stripe Dashboard
1. Go to https://dashboard.stripe.com
2. Sign in with client's account (or create new account)
3. Note: Start in **Test Mode** (toggle in top-right corner)

### Step 1.2: Get API Keys
1. Navigate to: **Developers → API Keys**
2. You'll see two keys:
   - **Publishable key**: `pk_test_...` (safe for frontend)
   - **Secret key**: `sk_test_...` (NEVER expose publicly!)
3. Click "Reveal test key" on Secret key
4. Copy both keys to a secure note (we'll add them to Vercel next)

---

## 💰 Phase 2: Create Products & Pricing

### Step 2.1: Create Products in Stripe

Navigate to: **Products → Add Product**

#### Product 1: Group Training 1x/week
- **Name**: Group Training 1x/week
- **Description**: Weekly group training session (Tuesday OR Friday)
- **Pricing**:
  - Price: `$249.99 CAD`
  - Billing period: `Monthly`
  - Recurring: ✅ Yes
- Click **Save product**
- **Copy the Price ID** (starts with `price_...`) → Save as `STRIPE_PRICE_GROUP_1X`

#### Product 2: Group Training 2x/week
- **Name**: Group Training 2x/week
- **Description**: Bi-weekly group training sessions (Tuesday AND Friday)
- **Pricing**:
  - Price: `$349.99 CAD`
  - Billing period: `Monthly`
  - Recurring: ✅ Yes
- Click **Save product**
- **Copy the Price ID** → Save as `STRIPE_PRICE_GROUP_2X`

#### Product 3: Private Training 1x/week
- **Name**: Private Training 1x/week
- **Description**: Weekly one-on-one training session
- **Pricing**:
  - Price: `$89.99 CAD`
  - Billing period: `Monthly`
  - Recurring: ✅ Yes
- Click **Save product**
- **Copy the Price ID** → Save as `STRIPE_PRICE_PRIVATE_1X`

#### Product 4: Private Training 2x/week
- **Name**: Private Training 2x/week
- **Description**: Bi-weekly one-on-one training sessions
- **Pricing**:
  - Price: `$179.98 CAD`
  - Billing period: `Monthly`
  - Recurring: ✅ Yes
- Click **Save product**
- **Copy the Price ID** → Save as `STRIPE_PRICE_PRIVATE_2X`

#### Product 5: Semi-Private Training
- **Name**: Semi-Private Training (2-3 players)
- **Description**: Small group training with 2-3 matched players
- **Pricing**:
  - Price: `$69.99 CAD`
  - Billing period: `Monthly` (or per session, client's choice)
  - Recurring: ✅ Yes
- Click **Save product**
- **Copy the Price ID** → Save as `STRIPE_PRICE_SEMI_PRIVATE`

### Step 2.2: Price ID Summary

You should now have 5 Price IDs. Keep them in a secure note:

```
STRIPE_PRICE_GROUP_1X = price_xxxxxxxxxxxxx
STRIPE_PRICE_GROUP_2X = price_xxxxxxxxxxxxx
STRIPE_PRICE_PRIVATE_1X = price_xxxxxxxxxxxxx
STRIPE_PRICE_PRIVATE_2X = price_xxxxxxxxxxxxx
STRIPE_PRICE_SEMI_PRIVATE = price_xxxxxxxxxxxxx
```

---

## 🔐 Phase 3: Configure Environment Variables

### Step 3.1: Add Variables to Vercel

1. Go to Vercel project: https://vercel.com/dashboard
2. Select your project
3. Go to: **Settings → Environment Variables**
4. Add the following **9 variables** (one at a time):

#### Variable 1: Stripe Publishable Key
```
Name: VITE_STRIPE_PUBLISHABLE_KEY
Value: pk_test_YOUR_PUBLISHABLE_KEY_HERE
Environments: ✅ Production, ✅ Preview, ✅ Development
```

#### Variable 2: Stripe Secret Key
```
Name: STRIPE_SECRET_KEY
Value: sk_test_YOUR_SECRET_KEY_HERE
Environments: ✅ Production, ✅ Preview, ✅ Development
```

#### Variable 3-7: Price IDs
```
Name: STRIPE_PRICE_GROUP_1X
Value: price_xxxxxxxxxxxxx
Environments: ✅ Production, ✅ Preview, ✅ Development

Name: STRIPE_PRICE_GROUP_2X
Value: price_xxxxxxxxxxxxx
Environments: ✅ Production, ✅ Preview, ✅ Development

Name: STRIPE_PRICE_PRIVATE_1X
Value: price_xxxxxxxxxxxxx
Environments: ✅ Production, ✅ Preview, ✅ Development

Name: STRIPE_PRICE_PRIVATE_2X
Value: price_xxxxxxxxxxxxx
Environments: ✅ Production, ✅ Preview, ✅ Development

Name: STRIPE_PRICE_SEMI_PRIVATE
Value: price_xxxxxxxxxxxxx
Environments: ✅ Production, ✅ Preview, ✅ Development
```

#### Variable 8-9: Supabase Keys (should already exist)
```
Name: VITE_SUPABASE_URL
Value: https://xxxxx.supabase.co
Environments: ✅ Production, ✅ Preview, ✅ Development

Name: SUPABASE_SERVICE_ROLE_KEY
Value: eyJxxx...your-service-role-key
Environments: ✅ Production, ✅ Preview, ✅ Development
```

### Step 3.2: Update Supabase Database Schema

The `registrations` table needs these columns for Stripe integration:

```sql
-- Add Stripe-related columns (run in Supabase SQL Editor)
ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_method_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_registrations_stripe_customer
ON registrations(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_registrations_stripe_subscription
ON registrations(stripe_subscription_id);
```

---

## 🚀 Phase 4: Deploy & Test

### Step 4.1: Trigger Deployment

1. In Vercel, go to **Deployments** tab
2. Click the **3 dots** (⋯) on the latest deployment
3. Click **Redeploy**
4. Wait for deployment to complete (~2-3 minutes)

### Step 4.2: Test in Test Mode

#### Test Payment Details (Stripe Test Cards)
Use these test card numbers:

**Successful Payment:**
```
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/25)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)
```

**Declined Card:**
```
Card Number: 4000 0000 0000 0002
(Use to test error handling)
```

**3D Secure Authentication Required:**
```
Card Number: 4000 0027 6000 3184
(Tests payment flow with authentication)
```

#### Testing Checklist:
- [ ] Open registration form
- [ ] Fill out all steps
- [ ] Select "Group Training 1x/week"
- [ ] Enter test card `4242 4242 4242 4242`
- [ ] Complete payment
- [ ] Check Supabase `registrations` table for new record
- [ ] Check Stripe Dashboard for new customer and subscription
- [ ] Verify `stripe_customer_id` and `stripe_subscription_id` are populated

### Step 4.3: Verify in Stripe Dashboard

1. Go to Stripe Dashboard → **Payments**
2. You should see a test payment
3. Go to **Customers** → You should see the test customer
4. Go to **Subscriptions** → You should see the active subscription

---

## 🎬 Phase 5: Go Live (Production)

### Step 5.1: Activate Live Mode in Stripe

1. In Stripe Dashboard, toggle from **Test Mode** to **Live Mode** (top-right)
2. Go to **Developers → API Keys**
3. Get your **Live** API keys:
   - Publishable key: `pk_live_...`
   - Secret key: `sk_live_...`

### Step 5.2: Create Live Products

**Important:** You need to recreate all 5 products in Live Mode
- Repeat **Phase 2** steps but in **Live Mode**
- Copy the new **Live Price IDs**

### Step 5.3: Update Vercel Environment Variables

Replace all **Test** keys with **Live** keys in Vercel:

```
VITE_STRIPE_PUBLISHABLE_KEY = pk_live_YOUR_LIVE_KEY
STRIPE_SECRET_KEY = sk_live_YOUR_LIVE_KEY
STRIPE_PRICE_GROUP_1X = price_xxxxxxxxxxxxx (LIVE)
STRIPE_PRICE_GROUP_2X = price_xxxxxxxxxxxxx (LIVE)
STRIPE_PRICE_PRIVATE_1X = price_xxxxxxxxxxxxx (LIVE)
STRIPE_PRICE_PRIVATE_2X = price_xxxxxxxxxxxxx (LIVE)
STRIPE_PRICE_SEMI_PRIVATE = price_xxxxxxxxxxxxx (LIVE)
```

### Step 5.4: Redeploy

1. Go to Vercel → **Deployments**
2. Redeploy with live keys
3. Test with a real card (small amount)
4. ✅ You're live!

---

## 🔔 Phase 6: Set Up Webhooks (Important!)

Webhooks notify your app when payments succeed/fail.

### Step 6.1: Get Webhook Endpoint URL

Your webhook endpoint is:
```
https://your-domain.com/api/stripe-webhook
```

### Step 6.2: Configure in Stripe

1. Go to Stripe Dashboard → **Developers → Webhooks**
2. Click **Add endpoint**
3. Enter your endpoint URL: `https://your-domain.com/api/stripe-webhook`
4. Select events to listen for:
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_...`)

### Step 6.3: Add Webhook Secret to Vercel

Add one more environment variable:

```
Name: STRIPE_WEBHOOK_SECRET
Value: whsec_xxxxxxxxxxxxx
Environments: ✅ Production, ✅ Preview, ✅ Development
```

---

## 🧪 Testing Checklist

### Test Mode Testing:
- [ ] Group Training 1x/week registration → Payment successful
- [ ] Group Training 2x/week registration → Payment successful
- [ ] Private Training registration → Payment successful
- [ ] Semi-Private Training registration → Payment successful
- [ ] Test declined card → Error handled gracefully
- [ ] Check Supabase for correct data storage
- [ ] Check Stripe Dashboard for customers & subscriptions

### Live Mode Testing:
- [ ] One test registration with real card (refund immediately)
- [ ] Webhook delivers events successfully
- [ ] Email confirmations sent (if configured)
- [ ] Subscription shows in Stripe Dashboard

---

## 🚨 Troubleshooting

### Error: "VITE_STRIPE_PUBLISHABLE_KEY is not set"
- Check Vercel environment variables
- Make sure you clicked **Save** after adding each variable
- Redeploy after adding variables

### Error: "Invalid API Key provided"
- Check that keys match (test with test, live with live)
- Keys should not have extra spaces
- Secret key should start with `sk_test_` or `sk_live_`

### Error: "No such price"
- Price ID doesn't exist or is for wrong mode (test/live)
- Verify Price IDs in Stripe Dashboard match environment variables
- Make sure Price IDs start with `price_`

### Payment succeeds but no record in Supabase
- Check Supabase database schema has Stripe columns
- Check webhook is configured correctly
- Look at Vercel logs for API errors

### Webhook not receiving events
- Check webhook URL is correct (should end with `/api/stripe-webhook`)
- Verify webhook secret is added to Vercel
- Check webhook status in Stripe Dashboard

---

## 📊 Monitoring & Maintenance

### Daily Checks:
- Check Stripe Dashboard for failed payments
- Monitor webhook delivery status

### Weekly Checks:
- Review subscription status
- Check for any customer issues
- Verify payment success rate

### Monthly Tasks:
- Review pricing (adjust if needed)
- Check for any Stripe API updates
- Review customer feedback on payment process

---

## 📞 Support Resources

- **Stripe Documentation**: https://stripe.com/docs
- **Stripe Dashboard**: https://dashboard.stripe.com
- **Stripe Support**: https://support.stripe.com
- **Stripe API Reference**: https://stripe.com/docs/api
- **Test Cards**: https://stripe.com/docs/testing

---

## 🔒 Security Best Practices

1. ✅ Never commit API keys to Git
2. ✅ Never expose Secret Key in frontend code
3. ✅ Always use HTTPS for webhook endpoints
4. ✅ Verify webhook signatures (already implemented)
5. ✅ Use environment variables for all keys
6. ✅ Rotate keys if compromised
7. ✅ Monitor Stripe Dashboard for suspicious activity

---

## ✅ Final Checklist

Before going live:
- [ ] All 5 products created in Stripe (Live Mode)
- [ ] All 9 environment variables added to Vercel
- [ ] Database schema updated with Stripe columns
- [ ] Test payment successful in Test Mode
- [ ] Webhooks configured and tested
- [ ] Live payment tested with real card (and refunded)
- [ ] Client has access to Stripe Dashboard
- [ ] Payment confirmation emails working
- [ ] Error handling tested

---

## 📝 Notes for Client

**Important Information:**
- Monthly billing happens automatically on the same date each month
- Customers can cancel anytime (handled through Stripe Dashboard)
- Failed payments trigger automatic retry (configurable in Stripe)
- Refunds must be processed through Stripe Dashboard
- All payment data is PCI compliant (Stripe handles this)

**Stripe Dashboard Access:**
Client should regularly check:
- **Home**: Overview of revenue and activity
- **Payments**: All successful and failed payments
- **Customers**: Customer list and details
- **Subscriptions**: Active, past due, and canceled subscriptions
- **Disputes**: Any chargebacks or disputes

---

**Document Version**: 1.0
**Last Updated**: November 10, 2025
**Branch**: claude/sniperzone-phase1-blockers-011CUxAEhnFfLmSyEKEWpHaF
**Build Status**: ✅ Verified Working

---

**Need Help?** Reference this document step-by-step. Each phase must be completed before moving to the next.
