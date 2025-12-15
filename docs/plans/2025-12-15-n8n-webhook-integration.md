# n8n Webhook Integration Design

## Overview

Integrate with n8n webhooks to send parent notifications via GHL (GoHighLevel) for SMS/Email.

**Primary channel** for appointment reminders and transactional messages.

## Architecture

```
Vercel APIs → HTTP POST → n8n webhook → GHL API → Parent receives SMS/Email
```

**Single Endpoint:** One `N8N_WEBHOOK_URL` env variable, route by `event_type` in payload.

## Event Types

| Event | Trigger | Purpose |
|-------|---------|---------|
| `contact_created` | Registration complete | Create GHL contact with all form data |
| `contact_updated` | Credit purchase | Update GHL with payment info |
| `booking_confirmed` | Session booked | Confirmation message |
| `booking_cancelled` | Booking cancelled | Cancellation notice |
| `credits_purchased` | Stripe webhook confirms | Purchase confirmation |
| `credits_low` | Balance drops < 3 | Low balance alert |
| `credits_expiring` | Credits within 30 days of expiry | Expiry warning |
| `session_reminder` | 2pm CRON daily | Next-day session reminder |

## Payload Structures

### Contact Created/Updated
```json
{
  "event_type": "contact_created",
  "timestamp": "2025-12-15T14:00:00Z",
  "contact": {
    "firebase_uid": "...",
    "email": "parent@example.com",
    "phone": "514-555-1234",
    "first_name": "John",
    "last_name": "Doe",
    "city": "Montreal",
    "postal_code": "H2X 1Y4",
    "language": "English"
  },
  "emergency_contact": {
    "name": "Jane Doe",
    "phone": "514-555-5678",
    "relationship": "Spouse"
  },
  "children": [
    {
      "name": "Billy Doe",
      "date_of_birth": "2015-03-15",
      "category": "U11",
      "program_type": "group",
      "position": "Forward",
      "dominant_hand": "Right",
      "level": "Intermediate",
      "jersey_size": "Youth M",
      "objective": "Improve skating",
      "medical": {
        "has_allergies": false,
        "has_conditions": false,
        "carries_medication": false
      }
    }
  ],
  "payment_info": {
    "total_spent": 150.00,
    "credits_purchased": 20,
    "last_purchase_date": "2025-12-15"
  }
}
```

### Booking Confirmed/Cancelled
```json
{
  "event_type": "booking_confirmed",
  "timestamp": "2025-12-15T14:00:00Z",
  "contact": {
    "firebase_uid": "...",
    "email": "parent@example.com",
    "phone": "514-555-1234",
    "name": "John Doe",
    "language": "English"
  },
  "booking": {
    "id": "uuid",
    "player_name": "Billy Doe",
    "session_type": "group",
    "session_date": "2025-12-20",
    "time_slot": "5:45 PM",
    "credits_used": 1
  }
}
```

### Credits Purchased/Low/Expiring
```json
{
  "event_type": "credits_purchased",
  "timestamp": "2025-12-15T14:00:00Z",
  "contact": {
    "firebase_uid": "...",
    "email": "parent@example.com",
    "phone": "514-555-1234",
    "name": "John Doe",
    "language": "English"
  },
  "credits": {
    "action": "purchased",
    "amount": 20,
    "new_balance": 25,
    "package_type": "20_pack",
    "price_paid": 500.00,
    "expires_at": "2026-12-15"
  }
}
```

### Session Reminder
```json
{
  "event_type": "session_reminder",
  "timestamp": "2025-12-15T14:00:00Z",
  "contact": {
    "firebase_uid": "...",
    "email": "parent@example.com",
    "phone": "514-555-1234",
    "name": "John Doe",
    "language": "English"
  },
  "booking": {
    "id": "uuid",
    "player_name": "Billy Doe",
    "session_type": "group",
    "session_date": "2025-12-16",
    "time_slot": "5:45 PM"
  }
}
```

## Implementation Tasks

### Task 1: Create webhook helper
Create `api/_lib/n8nWebhook.ts` with:
- `sendWebhook(eventType, payload)` function
- Fire and forget with console.error logging
- Check for `N8N_WEBHOOK_URL` env var

### Task 2: Add contact sync to registration
Modify registration flow to call webhook on completion.

### Task 3: Add contact update to credit purchase
Modify Stripe webhook to send contact_updated after purchase.

### Task 4: Add booking webhooks
Modify book-session and cancel-booking APIs to send webhooks.

### Task 5: Add credit alert webhooks
Add to Stripe webhook (purchased) and credit balance checks (low/expiring).

### Task 6: Create session reminder CRON
New `api/cron-session-reminders.ts` that runs at 2pm daily.

## Error Handling

- Fire and forget
- Log failures to console (visible in Vercel logs)
- No retry queue (can add later if needed)

## Environment Variables

```
N8N_WEBHOOK_URL=https://your-n8n.app/webhook/sniperzone
```
