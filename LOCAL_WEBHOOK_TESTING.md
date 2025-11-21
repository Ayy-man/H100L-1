# Local Webhook Testing Guide

This guide shows you how to test Stripe webhooks on your local development machine.

---

## 🎯 **Quick Start**

### Terminal 1: Start Your Dev Server
```bash
npm run dev
# Server runs on http://localhost:5173
```

### Terminal 2: Start Stripe CLI Webhook Forwarding
```bash
stripe listen --forward-to localhost:5173/api/stripe-webhook
```

**You'll see:**
```
> Ready! Your webhook signing secret is whsec_abc123xyz456...
> 2025-11-21 12:00:00   --> charge.succeeded [evt_abc123]
> 2025-11-21 12:00:01   --> customer.subscription.created [evt_xyz789]
```

**Copy that secret (whsec_...)** and paste it into `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_YOUR_ACTUAL_SECRET_HERE
```

### Terminal 1: Restart Dev Server (to load new secret)
```bash
# Press Ctrl+C to stop
npm run dev
```

---

## 📋 **Full Setup Instructions**

### Step 1: Install Stripe CLI

**macOS:**
```bash
brew install stripe/stripe-cli/stripe
```

**Windows:**
1. Go to: https://github.com/stripe/stripe-cli/releases/latest
2. Download `stripe_X.X.X_windows_x86_64.zip`
3. Extract to a folder (e.g., `C:\stripe`)
4. Add folder to PATH

**Linux:**
```bash
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.4/stripe_1.19.4_linux_x86_64.tar.gz
tar -xvf stripe_1.19.4_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

**Verify installation:**
```bash
stripe --version
```

---

### Step 2: Login to Stripe

```bash
stripe login
```

This will:
1. Open your browser
2. Show "Authorize Stripe CLI" page
3. Click **"Allow access"**
4. Return to terminal - should see "Done!"

**Verify you're in test mode:**
```bash
stripe config --list
# Should show test_mode_api_key = sk_test_...
```

---

### Step 3: Start Webhook Listener

```bash
stripe listen --forward-to localhost:5173/api/stripe-webhook
```

**What this does:**
- Connects to Stripe's webhook system
- Forwards all test webhook events to your local server
- Generates a temporary webhook signing secret

**Expected output:**
```
> Ready! Your webhook signing secret is whsec_abc123xyz456def789ghi012...
>
> [2025-11-21 12:00:00]  --> payment_intent.created [evt_1234567890]
```

**⚠️ Keep this terminal open!** If you close it, webhooks stop working.

---

### Step 4: Update .env.local with Webhook Secret

1. **Copy the webhook secret** from Step 3 (starts with `whsec_`)

2. **Open `.env.local`** and update this line:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_PASTE_YOUR_ACTUAL_SECRET_HERE
   ```

3. **Save the file**

4. **Restart your dev server:**
   ```bash
   # Press Ctrl+C in the dev server terminal
   npm run dev
   ```

---

### Step 5: Test the Webhook Flow

**Terminal Setup:**
- Terminal 1: Dev server (`npm run dev`)
- Terminal 2: Stripe CLI (`stripe listen --forward-to localhost:5173/api/stripe-webhook`)

**Now test a payment:**

1. **Register a player** at http://localhost:5173
2. **Complete payment** with test card `4242 4242 4242 4242`
3. **Watch Terminal 2** for webhook events:

```
✓ Received event checkout.session.completed [evt_1ABC...]
--> POST http://localhost:5173/api/stripe-webhook [200]

✓ Received event customer.subscription.created [evt_2XYZ...]
--> POST http://localhost:5173/api/stripe-webhook [200]

✓ Received event invoice.payment_succeeded [evt_3DEF...]
--> POST http://localhost:5173/api/stripe-webhook [200]
```

4. **Check your app:**
   - Dashboard should show payment succeeded
   - Supabase should have updated `payment_status`

---

## 🔍 **What Webhook Events You'll See**

When completing a $0 test subscription, Stripe sends these events:

### **checkout.session.completed** (Main event)
- Triggered when user completes checkout
- Contains customer and subscription IDs
- Your webhook updates `payment_status` to `'succeeded'`

### **customer.subscription.created**
- Subscription object created
- Status: `active` (for $0 subscriptions)

### **invoice.created**
- Invoice generated for subscription
- Amount: $0.00

### **invoice.finalized**
- Invoice is ready for payment

### **invoice.paid**
- Invoice marked as paid (automatic for $0)

### **invoice.payment_succeeded**
- Payment succeeded for the invoice

---

## 🎯 **Testing Specific Events**

You can trigger specific webhook events manually:

### Test a successful payment:
```bash
stripe trigger payment_intent.succeeded
```

### Test a failed payment:
```bash
stripe trigger payment_intent.payment_failed
```

### Test subscription events:
```bash
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

---

## 🐛 **Troubleshooting**

### Issue: "Ready!" but no events received

**Check:**
1. Is dev server running? (`npm run dev`)
2. Is Stripe CLI still connected? (check Terminal 2)
3. Is webhook secret in `.env.local`?
4. Did you restart dev server after adding secret?

**Fix:**
```bash
# Restart both
# Terminal 1
npm run dev

# Terminal 2
stripe listen --forward-to localhost:5173/api/stripe-webhook
```

---

### Issue: Webhook signature verification failed

**Error in logs:**
```
Webhook signature verification failed
```

**Fix:**
1. Make sure you copied the FULL webhook secret (starts with `whsec_`)
2. Make sure you restarted dev server after updating `.env.local`
3. Make sure Stripe CLI is still running

```bash
# Get fresh webhook secret
stripe listen --forward-to localhost:5173/api/stripe-webhook
# Copy new whsec_... secret
# Update .env.local
# Restart dev server
```

---

### Issue: Port 5173 already in use

**Change the dev server port:**
```bash
npm run dev -- --port 5174
```

**Then update Stripe CLI:**
```bash
stripe listen --forward-to localhost:5174/api/stripe-webhook
```

---

### Issue: Events received but database not updating

**Check webhook endpoint logs:**

Your webhook handler logs to console. Check Terminal 1 for:
```
[WEBHOOK] Received event: checkout.session.completed
[WEBHOOK] Processing registration: abc-123-def
[WEBHOOK] ✅ Payment status updated to succeeded
```

**If no logs:**
- Webhook secret might be wrong
- API endpoint might have error
- Check browser console and network tab

---

## 📊 **Monitoring Webhook Events**

### View all webhook events in Stripe:
```bash
stripe events list
```

### View specific event details:
```bash
stripe events retrieve evt_abc123xyz
```

### View webhook logs in browser:
Go to: https://dashboard.stripe.com/test/webhooks
- Click on your webhook endpoint
- See delivery history and payloads

---

## 🎓 **Understanding Webhook Flow**

Here's what happens when a user completes checkout:

```
1. User clicks "Subscribe" on Stripe Checkout
   ↓
2. Stripe processes payment (instant for $0)
   ↓
3. Stripe sends webhook: checkout.session.completed
   ↓
4. Stripe CLI forwards to: http://localhost:5173/api/stripe-webhook
   ↓
5. Your API verifies signature using STRIPE_WEBHOOK_SECRET
   ↓
6. Your API extracts registrationId from metadata
   ↓
7. Your API updates Supabase:
   - payment_status → 'succeeded'
   - stripe_customer_id → 'cus_...'
   - stripe_subscription_id → 'sub_...'
   ↓
8. User redirected to dashboard
   ↓
9. Dashboard shows "Payment successful!"
```

---

## ✅ **Verification Checklist**

Test your webhook setup is working:

- [ ] Stripe CLI installed (`stripe --version` works)
- [ ] Logged into Stripe (`stripe login` completed)
- [ ] Webhook listener running (`stripe listen` shows "Ready!")
- [ ] Webhook secret copied to `.env.local`
- [ ] Dev server restarted after adding secret
- [ ] Test payment completes successfully
- [ ] Webhook events visible in Terminal 2
- [ ] Payment status updates to "succeeded" in app
- [ ] Database shows updated payment_status in Supabase

---

## 🚀 **Quick Test Command**

Test your webhook without doing a full checkout:

```bash
# Trigger a test checkout.session.completed event
stripe trigger checkout.session.completed
```

Watch Terminal 2 to see if webhook is received and processed.

---

## 📝 **Next Steps**

Once local webhooks are working:

1. **Test different scenarios:**
   - Successful payments
   - Failed payments
   - Subscription updates
   - Subscription cancellations

2. **Check webhook logs:**
   - View events in Stripe CLI terminal
   - Check your API console logs
   - Verify database updates

3. **Deploy to production:**
   - Set up webhook endpoint in Stripe dashboard
   - Use production webhook secret in Vercel env vars

---

## 🔗 **Useful Links**

- Stripe CLI Docs: https://stripe.com/docs/stripe-cli
- Webhook Testing: https://stripe.com/docs/webhooks/test
- Webhook Events: https://stripe.com/docs/api/events/types

---

## 💡 **Pro Tips**

1. **Keep Stripe CLI running in background:**
   ```bash
   stripe listen --forward-to localhost:5173/api/stripe-webhook &
   ```

2. **Alias for quick start:**
   Add to `.bashrc` or `.zshrc`:
   ```bash
   alias stripe-local="stripe listen --forward-to localhost:5173/api/stripe-webhook"
   ```
   Then just run: `stripe-local`

3. **View detailed webhook payload:**
   ```bash
   stripe listen --forward-to localhost:5173/api/stripe-webhook --print-json
   ```

4. **Test specific events only:**
   ```bash
   stripe listen --events checkout.session.completed,customer.subscription.created --forward-to localhost:5173/api/stripe-webhook
   ```

---

Happy webhook testing! 🎉
