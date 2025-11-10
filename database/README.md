# Database Optimization Scripts

This folder contains SQL scripts to optimize the SniperZone database performance.

## Files

### `registrations_view.sql`

Creates an optimized database view and indexes to improve query performance for the admin dashboard.

**What it does:**
- Creates `registrations_view` that extracts commonly used fields from the JSONB `form_data` column
- Adds indexes on frequently queried fields for faster searches and filters
- Improves admin dashboard load time and filtering performance

**How to apply:**

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `registrations_view.sql`
4. Click **Run** to execute

**Benefits:**
- 🚀 Faster queries when filtering by player name, email, category, or program type
- 📊 Improved performance for stats calculations
- 🔍 Optimized search functionality
- 📈 Better scalability as registrations grow

## Database Structure

### Main Tables

#### `registrations`
Stores all hockey training registrations.

**Columns:**
- `id` (uuid) - Unique registration ID
- `created_at` (timestamp) - Registration date
- `updated_at` (timestamp) - Last update date
- `form_data` (jsonb) - All form fields stored as JSON
- `payment_status` (text) - Payment status: 'pending', 'paid', 'failed'
- `payment_method_id` (text) - Stripe payment method ID
- `stripe_customer_id` (text) - Stripe customer ID
- `stripe_subscription_id` (text) - Stripe subscription ID

#### `time_slots`
Manages training session capacity.

**Columns:**
- `id` (uuid) - Unique slot ID
- `time_slot_name` (varchar) - Name of the time slot
- `day_of_week` (varchar) - Day of week
- `applicable_categories` (array) - Age categories allowed
- `capacity` (integer) - Maximum capacity
- `current_registrations` (integer) - Current enrollment
- `is_active` (boolean) - Whether slot is available

### Views

#### `registrations_view`
Optimized view extracting JSONB fields for better performance.

**Key Fields:**
- Player info: `player_name`, `player_category`, `date_of_birth`
- Parent info: `parent_name`, `parent_email`, `parent_phone`
- Program info: `program_type`, `group_frequency`, `private_frequency`
- Full data: `full_form_data` (original JSONB)

## Performance Tips

1. **Use the view for filtering**: Query `registrations_view` instead of `registrations` when filtering
2. **Indexes are automatic**: The indexes created by the script apply to the base table
3. **Monitor query performance**: Check Supabase logs to identify slow queries
4. **Regular maintenance**: Run `VACUUM ANALYZE registrations;` monthly to optimize

## Example Queries

### Get all M13 registrations with payment status
```sql
SELECT
  player_name,
  parent_email,
  program_type,
  payment_status
FROM registrations_view
WHERE player_category = 'M13'
  AND payment_status = 'paid'
ORDER BY created_at DESC;
```

### Count registrations by program type
```sql
SELECT
  program_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE payment_status = 'paid') as paid_count
FROM registrations_view
GROUP BY program_type;
```

### Search by player or parent name
```sql
SELECT *
FROM registrations_view
WHERE player_name ILIKE '%john%'
   OR parent_email ILIKE '%smith%'
ORDER BY created_at DESC;
```

## Maintenance

### Reindex (run quarterly)
```sql
REINDEX TABLE registrations;
```

### Update statistics (run monthly)
```sql
ANALYZE registrations;
```

### Check index usage
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE tablename = 'registrations'
ORDER BY idx_scan DESC;
```
