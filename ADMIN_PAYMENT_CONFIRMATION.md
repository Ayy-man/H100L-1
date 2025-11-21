# Admin Payment Confirmation Feature

## Overview

This feature allows authorized admin users to manually confirm subscription payments. This is useful for handling edge cases and offline payments that occur outside the normal Stripe checkout flow.

## Use Cases

The manual payment confirmation feature handles:

1. **Offline Payments**: Customer paid via cash or e-transfer
2. **External Payments**: Customer paid through Stripe but outside the dashboard flow
3. **Manual Stripe Verification**: Admin verified payment in Stripe Dashboard
4. **Error Overrides**: Customer reported an issue and admin wants to override status

## How It Works

### 1. Database Schema

Four new columns were added to the `registrations` table:

```sql
- manually_confirmed: BOOLEAN (default false)
- manually_confirmed_by: TEXT (admin email)
- manually_confirmed_at: TIMESTAMPTZ
- manually_confirmed_reason: TEXT
```

### 2. Admin Authorization

Admin emails are configured in the `ADMIN_EMAILS` environment variable:

```bash
# .env
ADMIN_EMAILS=admin@example.com,owner@example.com,manager@example.com
```

Only users with these email addresses can manually confirm payments.

### 3. Admin Dashboard UI

In the Admin Dashboard (`/admin`), there's a green checkmark (✅) button next to each registration:

- **Visible**: For all registrations with `payment_status != 'succeeded'`
- **Hidden**: For already successful payments
- **Action**: Opens a confirmation dialog with reason selection

### 4. Confirmation Dialog

The dialog presents 4 reason options:

1. **Offline Payment** - cash, e-transfer
2. **Payment made outside dashboard** - paid via other means
3. **Verified in Stripe Dashboard** - admin checked Stripe
4. **Error Override / Customer Request** - manual override

### 5. API Endpoint

`POST /api/admin-confirm-payment`

**Request Body:**
```json
{
  "registrationId": "uuid",
  "adminEmail": "admin@example.com",
  "reason": "offline_payment"
}
```

**Response:**
```json
{
  "success": true,
  "registration": {
    "id": "uuid",
    "payment_status": "succeeded",
    "manually_confirmed": true,
    "manually_confirmed_by": "admin@example.com",
    "manually_confirmed_at": "2024-01-01T12:00:00Z"
  }
}
```

## Setup Instructions

### 1. Run Database Migration

Execute the SQL migration to add the required columns:

```bash
# Connect to your Supabase project
psql postgresql://[connection-string]

# Run the migration
\i database/add_manual_confirmation.sql
```

Or run it directly in Supabase SQL Editor:
```
https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
```

### 2. Configure Admin Emails

Add admin email addresses to your Vercel environment variables:

**Via Vercel Dashboard:**
1. Go to Project Settings → Environment Variables
2. Add `ADMIN_EMAILS` with comma-separated emails
3. Example: `admin@example.com,owner@example.com`
4. Redeploy

**Via Vercel CLI:**
```bash
vercel env add ADMIN_EMAILS
# Enter: admin@example.com,owner@example.com
# Select: Production, Preview, Development
```

### 3. Verify Access

1. Log into the admin dashboard with an authorized email
2. You should see the ✅ button next to pending payments
3. Click to test the confirmation flow

## Security Notes

### Authorization Check

The API endpoint validates:
- Admin email is provided
- Email exists in `ADMIN_EMAILS` list
- Registration exists in database

Unauthorized attempts are logged and rejected with 403 error.

### Audit Trail

Every manual confirmation is tracked with:
- Who confirmed it (`manually_confirmed_by`)
- When it was confirmed (`manually_confirmed_at`)
- Why it was confirmed (`manually_confirmed_reason`)

This provides a complete audit trail for compliance and troubleshooting.

## Testing

### Test Manual Confirmation

1. Create a test registration with pending payment
2. Log into `/admin` with an authorized admin email
3. Find the registration in the table
4. Click the ✅ button
5. Select a reason
6. Click "Confirm Payment"
7. Verify the payment_status changes to "succeeded"
8. Check the database for manual confirmation fields

### Test Unauthorized Access

Try confirming with a non-admin email and verify it's rejected:

```bash
curl -X POST https://your-domain.com/api/admin-confirm-payment \
  -H "Content-Type: application/json" \
  -d '{
    "registrationId": "test-uuid",
    "adminEmail": "notadmin@example.com",
    "reason": "offline_payment"
  }'

# Should return: {"error": "Unauthorized - Not an admin user"}
```

## Monitoring

Check manual confirmations in Supabase:

```sql
SELECT
  id,
  form_data->>'parentFullName' as parent_name,
  payment_status,
  manually_confirmed,
  manually_confirmed_by,
  manually_confirmed_at,
  manually_confirmed_reason
FROM registrations
WHERE manually_confirmed = true
ORDER BY manually_confirmed_at DESC;
```

## FAQ

**Q: Can manual confirmation override an already succeeded payment?**
A: No, the UI hides the button for succeeded payments. However, the API doesn't prevent it.

**Q: What happens if someone tries to confirm without being an admin?**
A: The API returns a 403 error and logs the unauthorized attempt.

**Q: Can customers see if their payment was manually confirmed?**
A: No, the manual confirmation fields are only visible to admins. Customers just see "succeeded" status.

**Q: Should we still use webhooks?**
A: Yes! Webhooks handle automatic confirmations. Manual confirmation is for edge cases and offline payments.

**Q: Can I revoke a manual confirmation?**
A: Not through the UI, but you can update the database directly via SQL if needed.

## Troubleshooting

### Button Not Showing
- Check if payment_status is already "succeeded"
- Verify admin is logged in with Firebase auth
- Check browser console for errors

### 403 Unauthorized Error
- Verify email is in `ADMIN_EMAILS` env variable
- Check for typos (case-sensitive)
- Redeploy after changing env variables

### Database Update Failed
- Check Supabase service role key is configured
- Verify registration ID exists
- Check database permissions

## Related Files

- `/api/admin-confirm-payment.ts` - API endpoint
- `/components/ConfirmPaymentButton.tsx` - UI component
- `/components/AdminDashboard.tsx` - Admin dashboard integration
- `/database/add_manual_confirmation.sql` - Database migration
- `/.env.example` - Environment variable template
