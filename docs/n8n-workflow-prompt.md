# n8n Workflow Builder Prompt for SniperZone Hockey

Use this prompt with Claude to build the n8n workflow that receives webhooks from the SniperZone app and sends SMS/Email via GoHighLevel (GHL).

---

## PROMPT FOR CLAUDE

```
I need you to help me build an n8n workflow for a hockey training registration system. The workflow receives webhooks from a Vercel app and sends SMS/Email notifications to parents via GoHighLevel (GHL) API.

## Webhook Endpoint

Create a single Webhook node that receives POST requests. All events come to the same endpoint with different `event_type` values.

## Event Types & Payloads

### 1. contact_created
Triggered when a parent registers. Create a new contact in GHL.

```json
{
  "event_type": "contact_created",
  "timestamp": "2025-12-15T14:00:00Z",
  "contact": {
    "firebase_uid": "abc123",
    "email": "parent@example.com",
    "phone": "+15145551234",
    "name": "John Doe",
    "first_name": "John",
    "last_name": "Doe",
    "city": "Montreal",
    "postal_code": "H2X 1Y4",
    "language": "English"
  },
  "emergency_contact": {
    "name": "Jane Doe",
    "phone": "+15145555678",
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
        "allergies_details": "",
        "has_conditions": false,
        "conditions_details": "",
        "carries_medication": false,
        "medication_details": ""
      }
    }
  ]
}
```

**GHL Action**: Create Contact
- Map firebase_uid to a custom field for future lookups
- Store children as custom field (JSON or structured)
- Set tags: "Hockey Parent", "SniperZone"

---

### 2. contact_updated
Triggered after credit purchase. Update existing GHL contact with payment info.

```json
{
  "event_type": "contact_updated",
  "timestamp": "2025-12-15T14:00:00Z",
  "contact": {
    "firebase_uid": "abc123",
    "email": "parent@example.com",
    "phone": "+15145551234",
    "name": "John Doe",
    "language": "English"
  },
  "payment_info": {
    "total_spent": 500.00,
    "credits_purchased": 20,
    "last_purchase_date": "2025-12-15"
  }
}
```

**GHL Action**: Update Contact
- Lookup by firebase_uid or email
- Update custom fields: total_spent, credits_purchased, last_purchase_date
- Add tag: "Paying Customer"

---

### 3. booking_confirmed
Triggered when a session is booked. Send confirmation SMS/Email.

```json
{
  "event_type": "booking_confirmed",
  "timestamp": "2025-12-15T14:00:00Z",
  "contact": {
    "firebase_uid": "abc123",
    "email": "parent@example.com",
    "phone": "+15145551234",
    "name": "John Doe",
    "language": "English"
  },
  "booking": {
    "id": "booking-uuid",
    "player_name": "Billy Doe",
    "session_type": "group",
    "session_date": "2025-12-20",
    "time_slot": "5:45 PM",
    "credits_used": 1
  }
}
```

**GHL Action**: Send SMS + Email
- SMS: "Hi {{contact.name}}! {{booking.player_name}}'s {{booking.session_type}} training on {{booking.session_date}} at {{booking.time_slot}} is confirmed. -SniperZone Hockey"
- Email: Use a template with booking details

---

### 4. booking_cancelled
Triggered when booking is cancelled. Send cancellation notice.

```json
{
  "event_type": "booking_cancelled",
  "timestamp": "2025-12-15T14:00:00Z",
  "contact": {
    "firebase_uid": "abc123",
    "email": "parent@example.com",
    "phone": "+15145551234",
    "name": "John Doe",
    "language": "English"
  },
  "booking": {
    "id": "booking-uuid",
    "player_name": "Billy Doe",
    "session_type": "group",
    "session_date": "2025-12-20",
    "time_slot": "5:45 PM",
    "credits_used": 1
  },
  "credits_refunded": 1
}
```

**GHL Action**: Send SMS
- If credits_refunded > 0: "{{booking.player_name}}'s session on {{booking.session_date}} has been cancelled. {{credits_refunded}} credit(s) refunded. -SniperZone"
- If credits_refunded = 0: "{{booking.player_name}}'s session on {{booking.session_date}} has been cancelled (late cancellation - no refund). -SniperZone"

---

### 5. credits_purchased
Triggered after successful credit purchase. Send thank you message.

```json
{
  "event_type": "credits_purchased",
  "timestamp": "2025-12-15T14:00:00Z",
  "contact": {
    "firebase_uid": "abc123",
    "email": "parent@example.com",
    "phone": "+15145551234",
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

**GHL Action**: Send Email (receipt) + optional SMS
- Email: Receipt with purchase details, expiry date
- SMS (optional): "Thanks for your purchase! {{credits.amount}} credits added. Balance: {{credits.new_balance}}. Expires: {{credits.expires_at}}. -SniperZone"

---

### 6. credits_low
Triggered when credit balance drops below 3. Send reminder to buy more.

```json
{
  "event_type": "credits_low",
  "timestamp": "2025-12-15T14:00:00Z",
  "contact": {
    "firebase_uid": "abc123",
    "email": "parent@example.com",
    "phone": "+15145551234",
    "name": "John Doe",
    "language": "English"
  },
  "credits": {
    "action": "low",
    "new_balance": 2
  }
}
```

**GHL Action**: Send Email
- "Hi {{contact.name}}, you have {{credits.new_balance}} credit(s) remaining. Purchase more at [link] to keep booking sessions. -SniperZone"

---

### 7. credits_expiring
Triggered 7 days before credits expire. Send warning.

```json
{
  "event_type": "credits_expiring",
  "timestamp": "2025-12-15T14:00:00Z",
  "contact": {
    "firebase_uid": "abc123",
    "email": "parent@example.com",
    "phone": "+15145551234",
    "name": "John Doe",
    "language": "English"
  },
  "credits": {
    "action": "expiring",
    "expiring_credits": 5,
    "expires_at": "2025-12-22",
    "new_balance": 8
  }
}
```

**GHL Action**: Send Email + SMS
- "Reminder: {{credits.expiring_credits}} of your credits expire on {{credits.expires_at}}. Book sessions now to use them! -SniperZone"

---

### 8. session_reminder
Triggered at 2pm daily for next-day sessions. Send reminder.

```json
{
  "event_type": "session_reminder",
  "timestamp": "2025-12-15T14:00:00Z",
  "contact": {
    "firebase_uid": "abc123",
    "email": "parent@example.com",
    "phone": "+15145551234",
    "name": "John Doe",
    "language": "English"
  },
  "booking": {
    "id": "booking-uuid",
    "player_name": "Billy Doe",
    "session_type": "group",
    "session_date": "2025-12-16",
    "time_slot": "5:45 PM"
  }
}
```

**GHL Action**: Send SMS
- "Reminder: {{booking.player_name}} has {{booking.session_type}} training tomorrow at {{booking.time_slot}}. See you at SniperZone! Address: [rink address]"

---

## Workflow Structure

Build the n8n workflow with this structure:

1. **Webhook Node** (trigger)
   - Receives all events at single endpoint
   - Returns 200 immediately

2. **Switch Node** (route by event_type)
   - Route to different branches based on `{{ $json.event_type }}`

3. **Per-event branches**:
   - contact_created → GHL Create Contact
   - contact_updated → GHL Update Contact (lookup by email/firebase_uid)
   - booking_confirmed → GHL Send SMS + Send Email
   - booking_cancelled → GHL Send SMS
   - credits_purchased → GHL Send Email
   - credits_low → GHL Send Email
   - credits_expiring → GHL Send SMS + Email
   - session_reminder → GHL Send SMS

4. **Error Handling**
   - Add error handling nodes to log failures
   - Don't retry (the source app is fire-and-forget)

## GHL API Details

I'm using GoHighLevel. Help me:
1. Set up the GHL API credentials in n8n
2. Create/update contacts with custom fields
3. Send SMS messages
4. Send emails (using templates or inline)

## Language Support

The `contact.language` field is either "English" or "French". Create message variants for both languages where appropriate.

## Custom Fields Needed in GHL

Create these custom fields in GHL:
- firebase_uid (text) - for lookups
- children (text/JSON) - player info
- total_spent (number)
- credits_purchased (number)
- credits_balance (number)
- last_purchase_date (date)

Please help me build this complete workflow step by step.
```

---

## Quick Reference Card

| Event | Trigger | GHL Action |
|-------|---------|------------|
| contact_created | Registration | Create Contact |
| contact_updated | Credit purchase | Update Contact |
| booking_confirmed | Session booked | SMS + Email |
| booking_cancelled | Booking cancelled | SMS |
| credits_purchased | Payment success | Email (receipt) |
| credits_low | Balance < 3 | Email |
| credits_expiring | 7 days to expiry | SMS + Email |
| session_reminder | 2pm daily CRON | SMS |

## Environment Setup

In your n8n instance, you'll need:
1. **GHL API credentials** (API key or OAuth)
2. **Webhook URL** - copy this to your Vercel env as `N8N_WEBHOOK_URL`

---

## Session Types

The `booking.session_type` field can be one of:

| Session Type | Description | Booking Method |
|--------------|-------------|----------------|
| `group` | Group training sessions (Mon-Sat) | Credit-based (1 credit/session) |
| `sunday` | Sunday real ice practice | Subscription-based (Group Training only) |
| `private` | Private 1-on-1 training | Stripe checkout |
| `semi_private` | Semi-private (2-3 players) | Stripe checkout |

### Sunday Ice Practice Details

Sunday practice is a special session type:
- **Eligibility**: Only Group Training subscription holders
- **Time Slots**:
  - 7:30-8:30 AM: M7, M9, M11 categories (capacity: 12 players)
  - 8:30-9:30 AM: M13, M15 categories (capacity: 10 players)
- **Location**: SniperZone Training Center, 7515 Boulevard Henri-Bourassa E, Montreal
- **Database**: Uses separate `sunday_practice_slots` and `sunday_bookings` tables
- **Cancellation**: No deadline - can cancel anytime before the session

---

## Technical Notes

### Known Issues & Fixes (December 2025)

1. **Calendar Timezone Bug**: The calendar date picker uses local date formatting instead of `toISOString()` to avoid UTC timezone shifts that could send the wrong date to the API.

2. **Sunday Slots Query**: The check-availability API fetches all active Sunday slots and filters by date in JavaScript, bypassing PostgREST date comparison issues with PostgreSQL DATE columns.

3. **Safari/iOS Scroll**: BuyCreditsModal uses `max-h-[90dvh]`, `overflow-y-auto`, and `-webkit-overflow-scrolling: touch` for proper mobile Safari scrolling.
