# Sunday Practice Slots Setup Guide

## Problem: "No slots available for next Sunday"

This happens when Sunday practice slots haven't been created in the database yet.

---

## ✅ Quick Fix - Two Steps

### **Step 1: Run the Payment Status Migration** (If not done already)

This fixes the eligibility check to accept 'verified' payment status.

**In Supabase SQL Editor:**
```sql
-- Copy and paste from database/fix_sunday_payment_status.sql
-- This updates the get_next_sunday_slot() function
```

### **Step 2: Generate Sunday Slots**

You have **two options**:

---

## Option A: Run the Cron Job Manually (Recommended)

**Visit this URL in your browser:**
```
https://YOUR-DOMAIN.vercel.app/api/cron-generate-sunday-slots?secret=YOUR_CRON_SECRET
```

Replace:
- `YOUR-DOMAIN` with your actual domain (e.g., `h100l-training.vercel.app`)
- `YOUR_CRON_SECRET` with the value from your `.env` file

**Expected Response:**
```json
{
  "success": true,
  "slots_created": 8,
  "message": "Generated 8 Sunday practice slots for the next 4 weeks"
}
```

This will create slots for the next 4 Sundays.

---

## Option B: Create Slots Manually in Supabase

**Run this SQL in Supabase SQL Editor:**

```sql
-- Get next Sunday's date
DO $$
DECLARE
  v_next_sunday DATE;
BEGIN
  -- Calculate next Sunday
  v_next_sunday := CURRENT_DATE + ((7 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7);
  IF v_next_sunday = CURRENT_DATE THEN
    v_next_sunday := v_next_sunday + 7;
  END IF;

  -- Create 2 time slots for next Sunday

  -- Slot 1: 7:30 AM - 8:30 AM (M11-M13)
  INSERT INTO public.sunday_practice_slots (
    practice_date,
    start_time,
    end_time,
    min_category,
    max_category,
    max_capacity,
    current_bookings,
    is_active
  ) VALUES (
    v_next_sunday,
    '07:30:00'::TIME,
    '08:30:00'::TIME,
    'M11',
    'M13',
    6,
    0,
    true
  )
  ON CONFLICT (practice_date, start_time) DO NOTHING;

  -- Slot 2: 8:45 AM - 9:45 AM (M13-M18)
  INSERT INTO public.sunday_practice_slots (
    practice_date,
    start_time,
    end_time,
    min_category,
    max_category,
    max_capacity,
    current_bookings,
    is_active
  ) VALUES (
    v_next_sunday,
    '08:45:00'::TIME,
    '09:45:00'::TIME,
    'M13',
    'M18',
    6,
    0,
    true
  )
  ON CONFLICT (practice_date, start_time) DO NOTHING;

  RAISE NOTICE 'Created slots for %', v_next_sunday;
END $$;
```

---

## Verify Slots Were Created

**Check in Supabase SQL Editor:**

```sql
-- View all upcoming Sunday slots
SELECT
  practice_date,
  TO_CHAR(start_time, 'HH12:MI AM') as start,
  TO_CHAR(end_time, 'HH12:MI AM') as end,
  min_category || '-' || max_category as age_range,
  current_bookings || '/' || max_capacity as capacity,
  is_active
FROM public.sunday_practice_slots
WHERE practice_date >= CURRENT_DATE
ORDER BY practice_date, start_time;
```

**Expected Output:**
```
practice_date | start     | end       | age_range | capacity | is_active
--------------+-----------+-----------+-----------+----------+----------
2025-11-23    | 07:30 AM  | 08:30 AM  | M11-M13   | 0/6      | true
2025-11-23    | 08:45 AM  | 09:45 AM  | M13-M18   | 0/6      | true
2025-11-30    | 07:30 AM  | 08:30 AM  | M11-M13   | 0/6      | true
...
```

---

## Set Up Automatic Slot Generation (Optional)

To generate slots automatically every week, configure a cron job in Vercel:

**In `vercel.json`:**
```json
{
  "crons": [{
    "path": "/api/cron-generate-sunday-slots?secret=YOUR_CRON_SECRET",
    "schedule": "0 0 * * 1"
  }]
}
```

This runs every Monday at midnight to generate slots for upcoming Sundays.

---

## Troubleshooting

### Still seeing "No slots available"?

1. **Check browser console** (F12 → Console):
   - Look for: `Sunday next slot response: {...}`
   - Check if `eligible: true`
   - Check if `available_slots: []` is empty

2. **Verify payment status:**
   ```sql
   SELECT payment_status
   FROM registrations
   WHERE firebase_uid = 'YOUR_FIREBASE_UID';
   ```
   Should be: `'succeeded'`, `'verified'`, or `'paid'`

3. **Check player category:**
   ```sql
   SELECT form_data->>'playerCategory' as category
   FROM registrations
   WHERE firebase_uid = 'YOUR_FIREBASE_UID';
   ```
   Must be M11 or higher for Sunday practice

4. **Verify slots exist:**
   ```sql
   SELECT COUNT(*) FROM sunday_practice_slots
   WHERE practice_date = '2025-11-23' AND is_active = true;
   ```
   Should return at least 1

---

## Quick Checklist

- [ ] Run payment status migration (`fix_sunday_payment_status.sql`)
- [ ] Generate Sunday slots (cron job or manual SQL)
- [ ] Verify slots exist in database
- [ ] Reload dashboard and check for available slots
- [ ] Check browser console for API response

---

## Contact

If slots still don't appear after following these steps, check:
1. Supabase logs for errors
2. Browser console for API errors
3. Vercel function logs for cron job errors
