# Rescheduling System Implementation Status

## 📋 Overview

This document tracks the implementation of the complete configuration fixes and rescheduling system for the SniperZone Hockey Training platform.

---

## ✅ PART 1: CONFIGURATION FIXES (COMPLETED)

### 1.1 Private/Semi-Private Time Slot Fixes ✅

**Problem:** Backend showed 3-8 PM, Frontend showed 8 AM-3 PM with inconsistent gaps

**Solution Implemented:**
- **File:** `lib/unifiedCapacityManager.ts`
  - Changed `PRIVATE_TRAINING_TIMES` from 5 PM slots to 7 hourly AM slots
  - Updated from: `['3:00 PM', '4:15 PM', '5:30 PM', '6:45 PM', '8:00 PM']`
  - Updated to: `['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM']`

- **File:** `components/form/FormStep2.tsx`
  - Updated time slot dropdown to show hourly ranges
  - Added 7 hourly slots: 8-9 AM, 9-10 AM, 10-11 AM, 11-12 PM, 12-1 PM, 1-2 PM, 2-3 PM
  - Updated schedule info messages

**Verification:**
```bash
# Check unifiedCapacityManager.ts
grep -A 7 "PRIVATE_TRAINING_TIMES" lib/unifiedCapacityManager.ts

# Check FormStep2.tsx
grep -A 8 "Preferred Time Slot" components/form/FormStep2.tsx
```

---

### 1.2 Private/Semi-Private Day Availability ✅

**Problem:** Limited to Mon/Wed/Thu only

**Solution Implemented:**
- **File:** `lib/unifiedCapacityManager.ts`
  - Changed `PRIVATE_TRAINING_DAYS` to include all 7 days
  - Updated from: `['monday', 'wednesday', 'thursday']`
  - Updated to: `['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']`

- **File:** `components/form/FormStep2.tsx`
  - Updated `PRIVATE_TRAINING_DAYS` constant to all 7 days
  - Updated UI messages: "Available 7 days a week"
  - Removed day restriction checks

**Verification:**
```bash
# Check both files for PRIVATE_TRAINING_DAYS
grep "PRIVATE_TRAINING_DAYS" lib/unifiedCapacityManager.ts components/form/FormStep2.tsx
```

---

### 1.3 Sunday Practice Configuration ✅

#### 1.3.1 Database Schema Constraints

**Problem:** CHECK constraint limited to M11+, blocking M7 and M9

**Solution Implemented:**
- **File:** `database/fix_sunday_schema_constraints_m7_m9.sql`
  - Drops old constraints that blocked M7 and M9
  - Adds new constraints allowing M7, M9, M11, M13, M15
  - Updates valid category ranges:
    - Slot 1: M7 to M11 (includes M7, M9, M11)
    - Slot 2: M13 to M15 (includes M13, M15)

**To Apply:**
```sql
-- Run in Supabase SQL Editor
\i database/fix_sunday_schema_constraints_m7_m9.sql
```

#### 1.3.2 Capacity Configuration

**Problem:** Both slots had same capacity, should be 12 for early and 10 for late

**Solution Implemented:**
- **File:** `database/update_sunday_slot_capacities_final.sql`
  - Updates early slot (7:30-8:30 AM) to 12 kids max for M7-M11
  - Updates late slot (8:30-9:30 AM) to 10 kids max for M13-M15
  - Updates `generate_sunday_slots()` function to use correct capacities

- **File:** `lib/sunday-practice-config.ts`
  - Updated documentation comments
  - Clarified capacity settings

**To Apply:**
```sql
-- Run in Supabase SQL Editor
\i database/update_sunday_slot_capacities_final.sql
```

**Verification:**
```sql
-- Check current capacities
SELECT
  practice_date,
  TO_CHAR(start_time, 'HH12:MI AM') || ' - ' || TO_CHAR(end_time, 'HH12:MI AM') as time_range,
  min_category || ' - ' || max_category as age_group,
  max_capacity,
  current_bookings,
  available_spots
FROM sunday_practice_slots
ORDER BY practice_date, start_time;
```

---

### 1.4 Group Training Time Slots ✅

**Problem:** Categories didn't match schedule image requirements

**Solution Implemented:**
- **File:** `lib/timeSlots.ts`
  - Slot 1 (4:30-5:30 PM): M9, M11 ✅ (correct)
  - Slot 2 (5:45-6:45 PM): Changed from `['M11', 'M13']` to `['M11 Elite', 'M13']` ✅
  - Slot 3 (7:00-8:00 PM): M13 Elite, M15 ✅ (correct)
  - Slot 4 (8:15-9:15 PM): Changed from `['M15 Elite', 'M18', 'Junior']` to `['M15 Elite', 'M18']` ✅

- **File:** `lib/timeSlotAssignment.ts`
  - Added all category mappings including Elite levels
  - Ensures every category has correct time slot assignment

**Verification:**
```bash
# Check timeSlots.ts
cat lib/timeSlots.ts | grep -A 5 "TIME_SLOTS"

# Check timeSlotAssignment.ts
cat lib/timeSlotAssignment.ts | grep -A 12 "timeSlotMap"
```

---

## 🚧 PART 2: RESCHEDULING SYSTEM (IN PROGRESS)

### 2.1 Database Schema ✅ COMPLETED

**File:** `database/rescheduling_system_schema.sql`

**Tables Created:**

1. **schedule_changes**
   - Tracks all schedule modifications (one-time and permanent)
   - Fields: registration_id, change_type, program_type, original_days, new_days, status, dates, audit fields
   - Indexes on registration_id, status, type, program, effective_date

2. **schedule_exceptions**
   - Tracks one-time skip/swap for specific dates
   - Fields: registration_id, exception_date, exception_type, replacement details, status
   - Indexes on registration_id, date, status

3. **semi_private_pairings**
   - Tracks current and historical pairings
   - Fields: player_1_registration_id, player_2_registration_id, scheduled_day, scheduled_time, status, dates
   - Indexes on both players, status, schedule

4. **unpaired_semi_private**
   - Tracks players waiting for partners
   - Fields: registration_id, player details, preferred_days, preferred_time_slots, status
   - GIN indexes on preferred_days and preferred_time_slots for fast matching

**Functions Created:**
- `check_group_day_capacity()` - Validates if day has available capacity
- `get_suggested_semi_private_times()` - Finds times where unpaired players exist
- `auto_pair_semi_private()` - Automatically pairs players when they choose same slot

**To Apply:**
```sql
-- Run in Supabase SQL Editor
\i database/rescheduling_system_schema.sql
```

**Verification:**
```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('schedule_changes', 'schedule_exceptions', 'semi_private_pairings', 'unpaired_semi_private')
ORDER BY table_name;

-- Check functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('check_group_day_capacity', 'get_suggested_semi_private_times', 'auto_pair_semi_private')
ORDER BY routine_name;
```

---

### 2.2 API Endpoints

#### 2.2.1 Group Training Rescheduling API ✅ COMPLETED

**File:** `api/reschedule-group.ts`

**Endpoints:**
- `POST /api/reschedule-group`

**Actions:**
1. **check_availability**
   - Input: `{ action: 'check_availability', newDays: ['monday', 'wednesday'] }`
   - Returns: Availability status and spots remaining for each day

2. **reschedule**
   - Input: `{ action: 'reschedule', changeType: 'permanent'|'one_time', newDays, ... }`
   - Validates: Capacity, frequency constraints, ownership
   - Creates: schedule_changes record
   - Updates: registration form_data (for permanent) or creates exception (for one-time)

**Business Rules Implemented:**
- Can only change DAYS, not time slots (time fixed by age category)
- 1x/week: Must select exactly 1 day
- 2x/week: Must select exactly 2 days
- Checks capacity before allowing change
- Auto-approves changes (configurable)

**Testing:**
```bash
curl -X POST http://localhost:3000/api/reschedule-group \
  -H "Content-Type: application/json" \
  -d '{
    "action": "check_availability",
    "registrationId": "UUID",
    "firebaseUid": "UID",
    "newDays": ["tuesday", "thursday"]
  }'
```

#### 2.2.2 Private Training Rescheduling API ⏳ TODO

**File:** `api/reschedule-private.ts` (needs to be created)

**Requirements:**
- Accept any day (7 days available)
- Accept any hourly time slot (8 AM - 3 PM)
- Check for conflicts with existing bookings
- Support one-time and permanent changes

**Implementation Plan:**
```typescript
interface ReschedulePrivateRequest {
  action: 'check_availability' | 'reschedule';
  registrationId: string;
  firebaseUid: string;
  changeType?: 'one_time' | 'permanent';
  newDay?: string;
  newTime?: string; // e.g., '9:00 AM'
  specificDate?: string;
  effectiveDate?: string;
  reason?: string;
}
```

#### 2.2.3 Semi-Private Training Rescheduling API ⏳ TODO

**File:** `api/reschedule-semi-private.ts` (needs to be created)

**Requirements:**
- Get suggested times (where unpaired players exist in same age group)
- Check availability
- Handle pairing/unpairing logic
- Notify partners when pairing dissolves

**Implementation Plan:**
```typescript
interface RescheduleSemiPrivateRequest {
  action: 'get_suggested_times' | 'check_availability' | 'reschedule';
  registrationId: string;
  firebaseUid: string;
  playerCategory?: string;
  newDay?: string;
  newTime?: string;
  changeType?: 'one_time' | 'permanent';
}
```

---

### 2.3 Parent UI Components ⏳ TODO

#### 2.3.1 Group Training Rescheduling UI

**File:** `components/dashboard/RescheduleGroupModal.tsx` (needs to be created)

**Features Needed:**
- Modal/dialog component
- Choice: "This week only" vs "Change my regular schedule"
- Current schedule display
- Day selector with capacity indicators
- Confirmation step
- Success/error messages

**Design:**
```
┌─────────────────────────────────────┐
│ Reschedule Group Training           │
├─────────────────────────────────────┤
│ Current Schedule:                   │
│ • Tuesday - 4:30 PM (M11)          │
│ • Thursday - 4:30 PM (M11)         │
│                                     │
│ Change Type:                        │
│ ○ This week only (one-time)        │
│ ● Change my regular schedule        │
│                                     │
│ Select New Days:                    │
│ ┌─────┬─────┬─────┬─────┐         │
│ │ Mon │ Tue │ Wed │ Thu │         │
│ │ 2▼  │ 1▼  │ 3▼  │FULL │         │
│ └─────┴─────┴─────┴─────┘         │
│                                     │
│ [Cancel] [Confirm Change]          │
└─────────────────────────────────────┘
```

#### 2.3.2 Private Training Rescheduling UI

**File:** `components/dashboard/ReschedulePrivateModal.tsx` (needs to be created)

**Features Needed:**
- Weekly calendar grid (7 days × 7 hourly slots)
- Highlight available slots
- Show booked/unavailable slots as disabled
- One-time vs permanent selection
- Confirmation

**Design:**
```
┌───────────────────────────────────────────┐
│ Reschedule Private Training               │
├───────────────────────────────────────────┤
│ Current: Monday 9:00 AM - 10:00 AM       │
│                                           │
│ Change Type: ● Permanent ○ One-time      │
│                                           │
│      Mon  Tue  Wed  Thu  Fri  Sat  Sun   │
│ 8am  [✓]  [✓]  [✓]  [✗]  [✓]  [✓]  [✓]  │
│ 9am  [●]  [✓]  [✓]  [✓]  [✓]  [✗]  [✓]  │
│ 10am [✓]  [✓]  [✗]  [✓]  [✓]  [✓]  [✓]  │
│ 11am [✓]  [✓]  [✓]  [✓]  [✓]  [✓]  [✓]  │
│ 12pm [✓]  [✗]  [✓]  [✓]  [✓]  [✓]  [✓]  │
│ 1pm  [✓]  [✓]  [✓]  [✓]  [✗]  [✓]  [✓]  │
│ 2pm  [✓]  [✓]  [✓]  [✓]  [✓]  [✓]  [✓]  │
│                                           │
│ Legend: [●] Current [✓] Available [✗] Full│
│                                           │
│ [Cancel] [Confirm Change]                │
└───────────────────────────────────────────┘
```

#### 2.3.3 Semi-Private Rescheduling UI

**File:** `components/dashboard/RescheduleSemiPrivateModal.tsx` (needs to be created)

**Features Needed:**
- Show current partner info
- "Suggested Times" section (prioritized)
- All available times section
- Warning when moving away from current partner
- Confirmation

**Design:**
```
┌───────────────────────────────────────────┐
│ Reschedule Semi-Private Training          │
├───────────────────────────────────────────┤
│ Current Schedule:                         │
│ Monday 10:00 AM - 11:00 AM               │
│ Training with: Alex Thompson (M11)        │
│                                           │
│ 🌟 Suggested Times (Partners Available)   │
│ • Wednesday 9:00 AM - Partner: Sarah M11  │
│ • Friday 1:00 PM - Partner: Jake M11      │
│                                           │
│ 📅 All Available Times                    │
│ • Tuesday 8:00 AM - Solo slot             │
│ • Thursday 2:00 PM - Solo slot            │
│                                           │
│ ⚠️ Note: Changing your schedule will      │
│ unpair you from Alex. They will be        │
│ notified and we'll help them find a       │
│ new partner.                              │
│                                           │
│ [Cancel] [Confirm Change]                │
└───────────────────────────────────────────┘
```

---

### 2.4 Admin Panel - Unpaired Players Dashboard ⏳ TODO

**File:** `components/admin/UnpairedPlayersPanel.tsx` (needs to be created)

**Features Needed:**

#### Section 1: Unpaired Players List
Table with columns:
- Player Name
- Age Category
- Currently Scheduled Time (if any)
- Preferred Availability
- Unpaired Since
- Parent Email
- Actions: [View Details] [Contact] [Find Match]

#### Section 2: Pairing Opportunities
Show potential matches:
- Player A + Player B
- Matching score (based on age, availability, preferences)
- Suggested time slot
- [Create Pairing] button

#### Section 3: Recent Activity
- Recently created pairs
- Recently dissolved pairs (with reason)
- Pending pairing requests

**Filters:**
- By age category
- By day of week
- By time slot
- By unpaired duration

---

### 2.5 Capacity Display Enhancements ⏳ TODO

**Files to Update:**
- `components/form/FormStep2.tsx` - Already shows capacity ✅
- `components/dashboard/RescheduleGroupModal.tsx` - Needs capacity indicators
- `components/dashboard/ReschedulePrivateModal.tsx` - Needs availability status
- `components/dashboard/RescheduleSemiPrivateModal.tsx` - Needs capacity info

**Color Coding:**
- 🟢 Green: 3+ spots available
- 🟡 Yellow: 1-2 spots (Almost Full)
- 🔴 Red: 0 spots (Full) - Disabled

**Format Examples:**
- "Monday - 4 spots"
- "Tuesday - Almost Full (1 spot)"
- "Wednesday - Full" (grayed out, not clickable)

---

### 2.6 Notification System ⏳ TODO

**File:** `lib/notifications.ts` (needs to be created)

**Notification Types:**

1. **Rescheduling Confirmed**
   - When: Parent successfully reschedules
   - To: Parent (email + dashboard)
   - Content: Confirmation of new schedule

2. **Partner Rescheduled**
   - When: Semi-private partner reschedules away
   - To: Affected partner (email + dashboard)
   - Content: Partner info, suggested next steps, link to reschedule

3. **New Pairing Created**
   - When: Two players are paired
   - To: Both players' parents (email + dashboard)
   - Content: Partner name, scheduled time, start date

4. **Admin Alerts**
   - When: New unpaired player added
   - To: Admin (dashboard notification)
   - Content: Player info, quick action buttons

**Implementation Options:**
- Email: SendGrid, Resend, or Supabase Edge Functions
- In-app: Real-time subscriptions via Supabase
- Dashboard badges: Unread notification counts

---

### 2.7 Data Migration ⏳ TODO

**File:** `database/migrate_existing_semi_private_pairings.sql` (needs to be created)

**Tasks:**

1. **Populate semi_private_pairings table**
   ```sql
   -- Find existing semi-private players from semi_private_groups
   -- Create pairing records for active groups
   INSERT INTO semi_private_pairings (...)
   SELECT ... FROM semi_private_groups ...
   ```

2. **Populate unpaired_semi_private table**
   ```sql
   -- Find semi-private registrations without a group
   -- Add them to unpaired list with their preferences
   INSERT INTO unpaired_semi_private (...)
   SELECT ... FROM registrations ...
   WHERE program_type = 'semi-private'
   AND NOT EXISTS (SELECT 1 FROM semi_private_groups ...)
   ```

3. **Verification queries**
   ```sql
   -- Count migrated pairings
   SELECT COUNT(*) FROM semi_private_pairings WHERE status = 'active';

   -- Count unpaired players
   SELECT COUNT(*) FROM unpaired_semi_private WHERE status = 'waiting';

   -- Verify no duplicates
   SELECT registration_id, COUNT(*)
   FROM unpaired_semi_private
   GROUP BY registration_id
   HAVING COUNT(*) > 1;
   ```

---

## 📊 SUCCESS CRITERIA CHECKLIST

### Configuration Fixes
- [x] Private/Semi-Private times are 8am-3pm in all files
- [x] All 7 days available for Private/Semi-Private
- [x] Sunday M7-M15 eligibility SQL scripts created
- [x] Sunday capacities: SQL scripts created for 12 (early) and 10 (late)
- [x] Group training time slots match schedule image

### Rescheduling - Group
- [x] Database schema created
- [x] API endpoint created
- [ ] Parent can swap days within their time slot (UI needed)
- [ ] One-time changes work for specific week (UI needed)
- [ ] Permanent changes update ongoing schedule (backend ready, UI needed)
- [x] Capacity validated before allowing change
- [x] 1x and 2x frequency rules enforced

### Rescheduling - Private
- [x] Database schema created
- [ ] API endpoint created
- [ ] Parent can reschedule to any 8am-3pm hourly slot
- [ ] Any day of week available
- [ ] One-time and permanent options work
- [ ] Conflicts prevented

### Rescheduling - Semi-Private
- [x] Database schema created
- [x] Helper functions for suggested times and auto-pairing
- [ ] API endpoint created
- [ ] Suggested times show slots with unpaired players in same age group
- [ ] Rescheduling updates pairing status correctly
- [ ] Partners notified when pairing dissolves
- [ ] New pairings auto-created when players choose same slot

### Admin Panel
- [x] Database tables for tracking unpaired players
- [ ] Unpaired players list UI
- [ ] Pairing opportunities shown with match suggestions
- [ ] Manual pairing action works
- [ ] Filters functional

### Capacity & UI
- [x] Spots remaining visible on registration form
- [ ] Spots remaining on rescheduling interfaces
- [ ] Color-coded capacity indicators (green/yellow/red)
- [ ] Full slots disabled/not selectable
- [ ] Real-time or near-real-time updates

### Notifications
- [ ] Notification system implemented
- [ ] Rescheduling confirmations sent
- [ ] Partner notifications work
- [ ] Admin alerts functional

---

## 🎯 NEXT STEPS (Priority Order)

1. **Apply Database Migrations** (CRITICAL - Run immediately)
   ```sql
   \i database/fix_sunday_schema_constraints_m7_m9.sql
   \i database/update_sunday_slot_capacities_final.sql
   \i database/rescheduling_system_schema.sql
   ```

2. **Complete API Endpoints** (Next session)
   - Create `api/reschedule-private.ts`
   - Create `api/reschedule-semi-private.ts`

3. **Build Parent UI Components** (Next session)
   - Create `components/dashboard/RescheduleGroupModal.tsx`
   - Create `components/dashboard/ReschedulePrivateModal.tsx`
   - Create `components/dashboard/RescheduleSemiPrivateModal.tsx`
   - Integrate into existing dashboard

4. **Build Admin Panel** (Next session)
   - Create `components/admin/UnpairedPlayersPanel.tsx`
   - Add tab to AdminDashboard.tsx

5. **Implement Notifications** (Next session)
   - Create `lib/notifications.ts`
   - Set up email templates
   - Add dashboard notifications

6. **Data Migration** (After testing)
   - Create and run migration script
   - Verify data integrity

7. **Testing** (Final step)
   - Test all rescheduling flows
   - Test capacity validation
   - Test pairing/unpairing
   - Test notifications
   - Verify all success criteria

---

## 📝 NOTES

### Important Considerations

1. **Database Migrations Must Run in Production**
   - The SQL scripts must be executed in the Supabase production database
   - Test in staging/development first if available
   - Back up data before running migrations

2. **Capacity Management**
   - Current capacity checking is synchronous
   - Consider adding optimistic locking for race conditions
   - Monitor for capacity-related errors

3. **Notification Timing**
   - Real-time notifications require WebSocket/subscriptions
   - Email notifications may have delays
   - Dashboard notifications should be instant

4. **Testing Strategy**
   - Unit tests for capacity validation logic
   - Integration tests for API endpoints
   - E2E tests for complete rescheduling flows
   - Load testing for capacity race conditions

### Performance Considerations

1. **Capacity Queries**
   - Add indexes on frequently queried fields
   - Consider caching capacity data (with invalidation)
   - Use database views for complex aggregations

2. **Pairing Algorithm**
   - Current auto-pairing is simple (first available)
   - Consider improving with scoring algorithm
   - Add manual override capability for admins

3. **Notification Delivery**
   - Queue notifications to avoid blocking
   - Batch similar notifications
   - Add retry logic for failed deliveries

---

## 🔗 RELATED FILES

### Configuration Files
- `lib/unifiedCapacityManager.ts`
- `lib/sunday-practice-config.ts`
- `lib/timeSlots.ts`
- `lib/timeSlotAssignment.ts`
- `components/form/FormStep2.tsx`

### Database Files
- `database/rescheduling_system_schema.sql`
- `database/fix_sunday_schema_constraints_m7_m9.sql`
- `database/update_sunday_slot_capacities_final.sql`

### API Files
- `api/reschedule-group.ts` ✅
- `api/reschedule-private.ts` ⏳
- `api/reschedule-semi-private.ts` ⏳

### UI Components (To Be Created)
- `components/dashboard/RescheduleGroupModal.tsx`
- `components/dashboard/ReschedulePrivateModal.tsx`
- `components/dashboard/RescheduleSemiPrivateModal.tsx`
- `components/admin/UnpairedPlayersPanel.tsx`

---

## 📞 SUPPORT

For questions or issues:
1. Review this document
2. Check the database verification queries
3. Test API endpoints with provided curl commands
4. Review the commit history for implementation details

---

**Last Updated:** 2025-11-24
**Status:** Part 1 Complete ✅ | Part 2 In Progress 🚧
**Commit:** `264f9b1` - fix: Complete configuration fixes and rescheduling system foundation
