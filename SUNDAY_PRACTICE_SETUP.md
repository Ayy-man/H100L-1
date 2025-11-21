# Sunday Practice Booking System - Setup Guide

This guide walks you through deploying the Sunday Real Ice Practice booking system to your production environment.

## 📋 Prerequisites

- Supabase project with access to SQL Editor
- Vercel project deployed
- Admin access to both platforms

---

## 🗄️ Step 1: Deploy Database Schema

### Option A: Run Migration Script (Recommended)

1. Open your Supabase dashboard
2. Navigate to **SQL Editor**
3. Open the file: `database/migration_sunday_practice.sql`
4. Copy the entire contents
5. Paste into Supabase SQL Editor
6. Click **Run** button
7. Wait for confirmation (should see success message and slot count)

### Option B: Run Original Schema

Alternatively, you can run `database/sunday_practice_schema.sql` which has the same content but more detailed comments.

### Verify Installation

After running the migration, you should see:
- ✅ 2 new tables created
- ✅ 1 view created
- ✅ 4 functions created
- ✅ Initial slots generated (8 slots for 4 weeks)

The script includes verification queries at the end that will show you:
```sql
-- Tables check
sunday_bookings
sunday_practice_slots

-- View check
sunday_bookings_detail

-- Functions check
book_sunday_slot
cancel_sunday_booking
generate_sunday_slots
get_next_sunday_slot

-- Generated slots
practice_date | time_range | age_group | capacity
-------------------------------------------------
2025-11-23   | 7:30 - 8:30 AM | M11 - M13 Elite | 6/6
2025-11-23   | 8:30 - 9:30 AM | M13 - Junior | 6/6
...
```

---

## 🔐 Step 2: Set Environment Variables

### Vercel Environment Variables

Add the following to your Vercel project:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add new variable:
   ```
   Name: CRON_SECRET
   Value: <generate-a-random-secret-key>
   ```

To generate a secure secret:
```bash
# Option 1: Using OpenSSL
openssl rand -base64 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Using a password generator
# Any long random string works (32+ characters)
```

3. Click **Save**
4. **Important**: Redeploy your application for the environment variable to take effect

---

## ✅ Step 3: Verify Deployment

### Test Cron Job (Optional)

Manually trigger the cron job to verify it works:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.vercel.app/api/cron-generate-sunday-slots
```

Expected response:
```json
{
  "success": true,
  "slots_created": 0,
  "message": "Generated 0 slots for 4 weeks ahead",
  "timestamp": "2025-11-21T12:00:00.000Z"
}
```

(0 slots created is normal if slots already exist)

### Test Parent Flow

1. **Login as Group Training Parent** (M11+ player)
2. Navigate to Dashboard
3. Scroll down to see **Sunday Real Ice Practice** card
4. Should show:
   - Next Sunday date
   - Available time slots
   - Capacity for each slot
5. Click **Book This Slot**
6. Should see success message
7. Card should update to show booking confirmation

### Test Admin Flow

1. Access Admin Dashboard (password: `sniperzone2025`)
2. Click **🏒 Sunday Practice** tab
3. Should see:
   - Date selector
   - Statistics cards (total, confirmed, attended, no-shows)
   - Roster table with all bookings
4. Mark a test attendance (Present or No-Show)
5. Export roster to CSV

---

## 🔄 Cron Job Configuration

The cron job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron-generate-sunday-slots",
      "schedule": "0 0 * * 1"
    }
  ]
}
```

**Schedule**: Every Monday at midnight UTC

**What it does**:
- Generates Sunday practice slots for 4 weeks ahead
- Creates 2 time slots per Sunday:
  - 7:30-8:30 AM (M11 to M13 Elite)
  - 8:30-9:30 AM (M13 to Junior)
- Skips Sundays that already have slots

**Monitoring**:
- View cron job execution logs in Vercel Dashboard → Deployments → Functions
- Each execution logs success/failure

---

## 📊 Database Schema Overview

### Tables

**sunday_practice_slots**
- Stores weekly Sunday time slots
- Tracks capacity (6 players per slot)
- Age group restrictions per slot

**sunday_bookings**
- Individual player bookings
- Links to registration and slot
- Attendance tracking

### View

**sunday_bookings_detail**
- Enriched view combining bookings, slots, and player data
- Used by admin roster and parent dashboard

### Functions

**book_sunday_slot(slot_id, registration_id, firebase_uid)**
- Books a slot with full validation
- Checks eligibility, capacity, duplicates
- Updates slot capacity automatically

**cancel_sunday_booking(booking_id, firebase_uid)**
- Cancels a booking
- Releases slot capacity
- Prevents cancellation of past bookings

**get_next_sunday_slot(registration_id, firebase_uid)**
- Gets next available Sunday
- Checks eligibility
- Returns available slots or existing booking

**generate_sunday_slots(weeks_ahead)**
- Auto-generates slots (called by cron)
- Default: 4 weeks ahead
- Idempotent (safe to run multiple times)

---

## 🎯 Business Rules Reference

### Eligibility
- ✅ Group Training program only
- ✅ M11+ categories (M11, M13, M13 Elite, M15, M15 Elite, M18, Junior)
- ❌ M9 excluded
- ✅ Active subscription required (payment_status = 'succeeded')

### Booking Rules
- Can only book **next upcoming Sunday** (1 week ahead)
- Maximum **6 players per time slot**
- **No cancellation deadline** (cancel anytime before practice)
- **No duplicate bookings** (one booking per Sunday per player)

### Time Slots
- **7:30-8:30 AM**: M11 to M13 Elite
- **8:30-9:30 AM**: M13 to Junior (M18+)

### Attendance
- Admin can mark: **Attended** or **No-Show**
- Status updates: confirmed → attended/no-show
- Tracks who marked and when

---

## 🚨 Troubleshooting

### Issue: No slots appearing in parent dashboard

**Check:**
1. Migration ran successfully
2. Initial slots were generated (`SELECT * FROM sunday_practice_slots;`)
3. Player is Group Training + M11+
4. Payment status is 'succeeded'

**Fix:**
```sql
-- Manually generate slots if needed
SELECT public.generate_sunday_slots(4);
```

### Issue: Cron job not running

**Check:**
1. CRON_SECRET is set in Vercel
2. Cron configuration exists in vercel.json
3. View Vercel logs for cron execution

**Fix:**
- Manually trigger to test: `curl https://your-domain.vercel.app/api/cron-generate-sunday-slots`

### Issue: Build failing with "Table component not found"

**Fix:**
Already fixed in commit `2f86146`. Make sure you have `components/ui/table.tsx` file.

### Issue: Permission denied errors

**Check:**
1. RLS policies are created
2. Functions use SECURITY DEFINER
3. Permissions granted to authenticated/service_role

**Fix:**
```sql
-- Re-grant permissions
GRANT SELECT ON public.sunday_practice_slots TO authenticated;
GRANT SELECT ON public.sunday_bookings TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_sunday_slot TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sunday_booking TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_sunday_slot TO authenticated;
```

---

## 🔄 Rollback Instructions

If you need to remove the Sunday Practice system:

1. Open Supabase SQL Editor
2. Open file: `database/rollback_sunday_practice.sql`
3. Copy and paste into SQL Editor
4. Click **Run**

**WARNING**: This will delete ALL Sunday practice bookings and slots!

To re-install after rollback, run `migration_sunday_practice.sql` again.

---

## 📈 Monitoring & Maintenance

### Weekly Checks
- [ ] Verify cron job is running (check Vercel logs every Monday)
- [ ] Check slot availability for upcoming Sundays
- [ ] Monitor booking volume

### Monthly Tasks
- [ ] Review attendance data
- [ ] Export historical roster data
- [ ] Check capacity utilization

### SQL Queries for Monitoring

**Check slot generation:**
```sql
SELECT
  practice_date,
  COUNT(*) as slots,
  SUM(current_bookings) as total_bookings,
  SUM(available_spots) as total_available
FROM sunday_practice_slots
WHERE practice_date >= CURRENT_DATE
GROUP BY practice_date
ORDER BY practice_date;
```

**Booking summary:**
```sql
SELECT
  booking_status,
  COUNT(*) as count
FROM sunday_bookings
GROUP BY booking_status;
```

**Attendance rate:**
```sql
SELECT
  COUNT(CASE WHEN attended = true THEN 1 END) * 100.0 / COUNT(*) as attendance_rate
FROM sunday_bookings
WHERE booking_status IN ('attended', 'no-show');
```

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Supabase logs (Supabase Dashboard → Logs)
3. Review Vercel logs (Vercel Dashboard → Deployments → Functions)
4. Check TODO.md for known issues

---

## ✅ Post-Deployment Checklist

- [ ] Database migration completed successfully
- [ ] CRON_SECRET environment variable set in Vercel
- [ ] Application redeployed to Vercel
- [ ] Verified cron job can be triggered manually
- [ ] Tested parent booking flow
- [ ] Tested admin roster view
- [ ] Tested attendance marking
- [ ] Monitored for first week

---

## 🎉 You're Done!

Your Sunday Real Ice Practice booking system is now live!

Parents can book their Sunday practice sessions, and admins can manage rosters and track attendance.

The system will automatically generate new slots every Monday at midnight.
