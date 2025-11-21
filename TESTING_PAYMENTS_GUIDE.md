# Testing Payments Guide - $0 Test Setup

This guide shows you how to test the complete payment flow without spending real money.

---

## 🎯 Two Testing Options

### **Option 1: Stripe Test Mode with $0 Products** (Recommended)
- ✅ Tests full Stripe checkout flow
- ✅ Tests webhooks and payment status updates
- ✅ Tests subscription creation
- ⏱️ Slower (requires Stripe checkout page)

### **Option 2: Dev Mode Bypass** (Fastest)
- ✅ Instantly marks payments as succeeded
- ✅ No Stripe checkout page
- ✅ Perfect for testing post-payment features
- ❌ Doesn't test actual Stripe integration

---

## 📋 Option 1: Stripe Test Mode ($0 Products)

### Step 1: Switch to Stripe Test Mode

1. **Get Test API Keys**:
   - Go to: https://dashboard.stripe.com/test/apikeys
   - Make sure toggle shows **"Test Mode"** (top right)
   - Copy:
     - Publishable key (starts with `pk_test_`)
     - Secret key (starts with `sk_test_`)

2. **Create $0 Test Products**:
   - Go to: https://dashboard.stripe.com/test/products
   - Click **"Add Product"** for each training type:

   ```
   Product 1: Group Training 1x/week TEST
   Name: Group Training 1x/week TEST
   Price: $0.00 CAD
   Recurring: Monthly
   → Copy Price ID (price_xxxxxxxxxxxx)

   Product 2: Group Training 2x/week TEST
   Price: $0.00 CAD
   Recurring: Monthly
   → Copy Price ID

   Product 3: Private Training 1x/week TEST
   Price: $0.00 CAD
   Recurring: Monthly
   → Copy Price ID

   Product 4: Private Training 2x/week TEST
   Price: $0.00 CAD
   Recurring: Monthly
   → Copy Price ID

   Product 5: Semi-Private Training TEST
   Price: $0.00 CAD
   Recurring: Monthly
   → Copy Price ID
   ```

### Step 2: Set Up Local Test Environment

1. **Copy test template**:
   ```bash
   cp .env.test .env.local
   ```

2. **Edit `.env.local`** and fill in your test values:
   ```bash
   # Stripe TEST Keys
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_TEST_KEY_HERE
   STRIPE_SECRET_KEY=sk_test_YOUR_ACTUAL_TEST_SECRET_HERE

   # Stripe $0 Test Price IDs (from products you just created)
   VITE_STRIPE_PRICE_GROUP_1X=price_YOUR_ACTUAL_PRICE_ID_HERE
   VITE_STRIPE_PRICE_GROUP_2X=price_YOUR_ACTUAL_PRICE_ID_HERE
   VITE_STRIPE_PRICE_PRIVATE_1X=price_YOUR_ACTUAL_PRICE_ID_HERE
   VITE_STRIPE_PRICE_PRIVATE_2X=price_YOUR_ACTUAL_PRICE_ID_HERE
   VITE_STRIPE_PRICE_SEMI_PRIVATE=price_YOUR_ACTUAL_PRICE_ID_HERE

   # Keep dev mode OFF for this option
   VITE_DEV_MODE=false
   ```

3. **Restart your dev server**:
   ```bash
   npm run dev
   ```

### Step 3: Test Webhook Locally (Optional)

For testing webhook events locally:

1. **Install Stripe CLI**:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Windows
   # Download from: https://github.com/stripe/stripe-cli/releases

   # Linux
   # Download from: https://github.com/stripe/stripe-cli/releases
   ```

2. **Login to Stripe CLI**:
   ```bash
   stripe login
   ```

3. **Forward webhooks to localhost**:
   ```bash
   stripe listen --forward-to localhost:5173/api/stripe-webhook
   ```

   Copy the webhook signing secret (starts with `whsec_`) and add to `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

4. **Restart dev server** to pick up the new webhook secret

### Step 4: Test the Flow

1. **Register a new player**:
   - Go to http://localhost:5173
   - Fill out registration form
   - Choose any program type

2. **Complete checkout**:
   - Click "Pay Now" button
   - Redirects to Stripe Checkout (test mode)
   - Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - Click "Subscribe"

3. **Verify payment**:
   - Redirected to dashboard
   - Should see payment status as "succeeded"
   - Check Supabase to see registration updated

4. **Check webhook events** (if using Stripe CLI):
   - See webhook events in terminal
   - Verify `checkout.session.completed` received

---

## ⚡ Option 2: Dev Mode Bypass (Fastest)

This mode skips Stripe entirely and instantly marks payments as succeeded.

### Step 1: Enable Dev Mode

1. **Edit `.env.local`**:
   ```bash
   # Set this to true
   VITE_DEV_MODE=true

   # You can use fake/test Stripe keys or leave them blank
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_any_value_works
   STRIPE_SECRET_KEY=sk_test_any_value_works

   # Fake price IDs also work (won't be used)
   VITE_STRIPE_PRICE_GROUP_1X=price_fake
   VITE_STRIPE_PRICE_GROUP_2X=price_fake
   VITE_STRIPE_PRICE_PRIVATE_1X=price_fake
   VITE_STRIPE_PRICE_PRIVATE_2X=price_fake
   VITE_STRIPE_PRICE_SEMI_PRIVATE=price_fake
   ```

2. **Restart dev server**:
   ```bash
   npm run dev
   ```

### Step 2: Create Dev Mode API Endpoint

Create a new file `api/dev-complete-payment.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * DEV MODE ONLY: Instantly complete payment
 * This bypasses Stripe entirely for rapid local testing
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // SECURITY: Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Dev mode not available in production' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { registrationId, firebaseUid } = req.body;

    if (!registrationId || !firebaseUid) {
      return res.status(400).json({ error: 'Missing registrationId or firebaseUid' });
    }

    // Initialize Supabase
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Update payment status directly
    const { error } = await supabase
      .from('registrations')
      .update({
        payment_status: 'succeeded',
        stripe_customer_id: 'cus_dev_test_' + Date.now(),
        stripe_subscription_id: 'sub_dev_test_' + Date.now(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .eq('firebase_uid', firebaseUid);

    if (error) {
      console.error('Dev payment update error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment completed in dev mode',
    });
  } catch (error: any) {
    console.error('Dev payment error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

### Step 3: Update PaymentStatus Component

Add dev mode logic to handle instant payment:

**In `components/dashboard/PaymentStatus.tsx`**, add this function:

```typescript
// Add near the top of the component
const isDev = import.meta.env.VITE_DEV_MODE === 'true';

// Add this handler function
const handleDevPayment = async () => {
  if (!isDev) return;

  try {
    const response = await fetch('/api/dev-complete-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registrationId: registration.id,
        firebaseUid: registration.firebase_uid,
      }),
    });

    if (!response.ok) {
      toast.error('Failed to complete dev payment');
      return;
    }

    toast.success('💰 Dev Mode: Payment completed instantly!');
    // Component will auto-update via real-time subscription
  } catch (error) {
    console.error('Dev payment error:', error);
    toast.error('Dev payment failed');
  }
};

// Update the Pay Now button to use dev mode if enabled
<Button
  onClick={isDev ? handleDevPayment : handleCheckout}
  disabled={loading}
>
  {isDev ? '⚡ Instant Pay (Dev Mode)' : 'Pay Now'}
</Button>
```

### Step 4: Test Dev Mode

1. **Register a new player** on registration form
2. **Click "⚡ Instant Pay (Dev Mode)"**
3. **Payment completes instantly** - no Stripe checkout page
4. **Dashboard updates** showing payment succeeded

---

## 🔒 Security Notes

### ⚠️ Dev Mode Security

The dev mode is **ONLY** for local development. It's protected by:

1. **Environment Check**: Only works when `process.env.NODE_ENV !== 'production'`
2. **Manual Enable**: Must explicitly set `VITE_DEV_MODE=true`
3. **Not Deployed**: Vercel sets `NODE_ENV=production` automatically

### ⚠️ Never Deploy Dev Mode

**In Vercel Environment Variables**, make sure:
- ❌ **DO NOT** set `VITE_DEV_MODE=true`
- ✅ **DO** use real Stripe keys
- ✅ **DO** use production price IDs

---

## 📊 Comparison Table

| Feature | Test Mode $0 | Dev Mode Bypass |
|---------|-------------|-----------------|
| Speed | Medium | Instant |
| Tests Stripe | ✅ Yes | ❌ No |
| Tests Webhooks | ✅ Yes | ❌ No |
| Tests UI | ✅ Yes | ✅ Yes |
| Tests Database | ✅ Yes | ✅ Yes |
| Setup Complexity | Medium | Easy |
| Best For | Full integration testing | Rapid feature development |

---

## 🚨 Troubleshooting

### Issue: Still seeing real prices

**Fix**: Check that you're using `.env.local` not `.env`
```bash
# Restart dev server
npm run dev
```

### Issue: Webhook not working

**Fix**: Make sure Stripe CLI is running
```bash
stripe listen --forward-to localhost:5173/api/stripe-webhook
```

### Issue: Dev mode not working

**Fix**: Check environment
```bash
# In your API endpoint
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DEV_MODE:', process.env.VITE_DEV_MODE);
```

---

## ✅ Recommended Workflow

**For Day-to-Day Development**:
1. Use **Dev Mode Bypass** for speed
2. Test features quickly without Stripe overhead

**Before Deploying**:
1. Switch to **Test Mode $0**
2. Test full payment flow end-to-end
3. Verify webhooks work correctly
4. Test with test credit cards

**In Production**:
1. Use real Stripe products
2. Real prices
3. Live mode keys
4. No dev mode

---

## 📝 Next Steps

1. Choose your testing approach (Test Mode or Dev Mode)
2. Set up `.env.local` with appropriate values
3. Create $0 test products in Stripe (if using Test Mode)
4. Test the registration and payment flow
5. Verify database updates correctly

Happy testing! 🚀
