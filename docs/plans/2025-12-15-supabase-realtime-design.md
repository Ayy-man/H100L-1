# Supabase Realtime Implementation Design

> **Created:** December 15, 2025
> **Status:** Complete (Database + Frontend)

---

## Overview

This document outlines the Supabase Realtime implementation for SniperZone Hockey Training. The system enables live updates across the application so users see changes immediately without page refresh.

---

## Architecture

### Channel Structure

| Channel Pattern | Purpose | Subscribers |
|----------------|---------|-------------|
| `user:{firebase_uid}` | User-specific events (credits, bookings, notifications) | Each logged-in parent |
| `admin:all` | All system events for admin monitoring | Admin dashboard |
| `capacity:{session_type}:{date}` | Slot availability updates | Anyone viewing booking forms |

### Event Types

| Event Name | Source Table | Payload |
|------------|--------------|---------|
| `parent_credits_changed` | `parent_credits` | `{ new: {...}, old: {...} }` |
| `session_booking_changed` | `session_bookings` | `{ new: {...}, old: {...} }` |
| `credit_purchases_changed` | `credit_purchases` | `{ new: {...}, old: {...} }` |
| `credit_adjustments_changed` | `credit_adjustments` | `{ new: {...}, old: {...} }` |
| `recurring_schedules_changed` | `recurring_schedules` | `{ new: {...}, old: {...} }` |
| `notifications_changed` | `notifications` | `{ new: {...}, old: {...} }` |
| `registrations_changed` | `registrations` | `{ new: {...}, old: {...} }` |

---

## Database Setup (COMPLETE)

### Trigger Functions Created

All functions are in the `realtime` schema with `SECURITY DEFINER`:

1. `realtime.session_bookings_broadcast_trigger()` - broadcasts to user, capacity, and admin channels
2. `realtime.parent_credits_broadcast_trigger()` - broadcasts to user and admin channels
3. `realtime.credit_purchases_broadcast_trigger()` - broadcasts to user and admin channels
4. `realtime.credit_adjustments_broadcast_trigger()` - broadcasts to user and admin channels
5. `realtime.recurring_schedules_broadcast_trigger()` - broadcasts to user and admin channels
6. `realtime.notifications_broadcast_trigger()` - broadcasts to user and admin channels (uses `user_id` column)
7. `realtime.registrations_broadcast_trigger()` - broadcasts to user and admin channels

### Triggers Attached

| Trigger Name | Table |
|--------------|-------|
| `session_bookings_broadcast_trg` | `public.session_bookings` |
| `parent_credits_broadcast_trg` | `public.parent_credits` |
| `credit_purchases_broadcast_trg` | `public.credit_purchases` |
| `credit_adjustments_broadcast_trg` | `public.credit_adjustments` |
| `recurring_schedules_broadcast_trg` | `public.recurring_schedules` |
| `notifications_broadcast_trg` | `public.notifications` |
| `registrations_broadcast_trg` | `public.registrations` |

### Verification Query

```sql
-- Verify triggers exist
SELECT tgname AS trigger_name, relname AS table_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE tgname LIKE '%broadcast%';

-- Verify functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'realtime' AND routine_name LIKE '%broadcast%';
```

---

## Frontend Implementation (COMPLETE)

### Existing Realtime (postgres_changes)

The app has working realtime using `postgres_changes`:

| Component | Subscriptions |
|-----------|--------------|
| `NewDashboard.tsx` | `parent_credits`, `session_bookings`, `recurring_schedules` |
| `AdminDashboard.tsx` | `registrations` |
| `Dashboard.tsx` | Various tables |

### New Broadcast Subscriptions (Implemented)

#### Capacity Subscriptions

`BookSessionModal.tsx` subscribes to capacity channels for real-time slot updates:

```typescript
const capacityTopic = `capacity:${sessionType}:${selectedDate}`;
const channel = supabase.channel(capacityTopic, { config: { private: true } });

channel.on('broadcast', { event: 'session_booking_changed' }, () => {
  fetchSlots(); // Refresh availability when others book
});
```

### When to Use Broadcast vs postgres_changes

| Use Case | Recommended Approach |
|----------|---------------------|
| User sees their own data change | Either works |
| Admin sees ALL users' changes | **Broadcast** (`admin:all` channel) |
| Capacity updates across users | **Broadcast** (`capacity:*` channels) ✅ |
| Simple single-user updates | `postgres_changes` is simpler |

---

## Admin Channel Access

Admin access is controlled by email in RLS policies:

```sql
-- Admins can access admin:all channel
(auth.jwt() ->> 'email') IN (
  'loic@sniperzone.ca',
  'darick@sniperzone.ca',
  'chris@sniperzone.ca'
)
```

To add/remove admins, update the RLS policy on `realtime.messages`.

---

## Testing

### Manual Test

1. Open app in two browser tabs (same user)
2. In Tab 1: Buy credits or book a session
3. Tab 2 should update automatically without refresh

### Database Test

```sql
-- Test broadcast by updating a parent's credits
UPDATE public.parent_credits
SET total_credits = total_credits + 1
WHERE firebase_uid = 'YOUR_TEST_UID';

-- The trigger will broadcast to user:{firebase_uid} and admin:all
```

---

## Files Changed

### Database (via Supabase SQL Editor)
- Created 7 trigger functions in `realtime` schema
- Created 7 triggers on public tables
- RLS policies on `realtime.messages` (if configured)

### Frontend Components

| File | Changes |
|------|---------|
| `components/ui/toast.tsx` | Enhanced toast with variants (success/error/warning) |
| `components/dashboard/BookSessionModal.tsx` | Added capacity channel subscription |

---

## Future Enhancements

1. **User Channel Subscriptions** - Migrate parent dashboard from `postgres_changes` to `user:{uid}` broadcast channel for unified architecture
2. **Notification Bell** - Real-time notification indicator using `notifications_changed` events
3. **Admin Presence** - Show which admins are currently online

---

*Last updated: December 15, 2025*
