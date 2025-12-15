# Fix "No Available Slots" Bug - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the bug where BookSessionModal shows "No available slots for this date" even when slots should be available.

**Architecture:** The root cause is a category mismatch - `AddChildModal` and `add-child.ts` allow 'Adult' category which has no matching time slots in `check-availability.ts`. We'll align all components to use the canonical `PlayerCategory` type from `types.ts`.

**Tech Stack:** TypeScript, React, Vercel Serverless Functions

---

## Root Cause Analysis

The category lists are inconsistent:

| Location | Categories |
|----------|-----------|
| `types.ts` (source of truth) | M7, M9, M11, M13, M13 Elite, M15, M15 Elite, M18, Junior |
| `AddChildModal.tsx` | M7, M9, M11, M13, M15, M18, **Adult** (wrong!) |
| `add-child.ts` | M7, M9, M11, M13, M15, M18, **Adult** (wrong!) |
| `check-availability.ts` | Correct - matches types.ts |

When a child is added with 'Adult' category, `check-availability.ts` returns empty slots because 'Adult' doesn't exist in any slot mapping.

---

### Task 1: Update AddChildModal Categories

**Files:**
- Modify: `components/dashboard/AddChildModal.tsx:31-39`

**Step 1: Update PLAYER_CATEGORIES constant**

Replace lines 31-39:

```typescript
// Player categories based on age (must match types.ts PlayerCategory)
const PLAYER_CATEGORIES = [
  { value: 'M7', label: 'M7 (Under 7)', minAge: 0, maxAge: 6 },
  { value: 'M9', label: 'M9 (Under 9)', minAge: 7, maxAge: 8 },
  { value: 'M11', label: 'M11 (Under 11)', minAge: 9, maxAge: 10 },
  { value: 'M13', label: 'M13 (Under 13)', minAge: 11, maxAge: 12 },
  { value: 'M13 Elite', label: 'M13 Elite', minAge: 11, maxAge: 12 },
  { value: 'M15', label: 'M15 (Under 15)', minAge: 13, maxAge: 14 },
  { value: 'M15 Elite', label: 'M15 Elite', minAge: 13, maxAge: 14 },
  { value: 'M18', label: 'M18 (Under 18)', minAge: 15, maxAge: 17 },
  { value: 'Junior', label: 'Junior (18+)', minAge: 18, maxAge: 99 },
];
```

**Step 2: Verify change compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add components/dashboard/AddChildModal.tsx
git commit -m "fix(AddChildModal): align categories with PlayerCategory type

- Add M13 Elite, M15 Elite categories
- Replace Adult with Junior (matches slot mappings)
- Fixes 'No available slots' bug for new registrations"
```

---

### Task 2: Update add-child API Validation

**Files:**
- Modify: `api/add-child.ts:73-78`

**Step 1: Update validCategories array**

Replace lines 73-78:

```typescript
    // Validate category (must match types.ts PlayerCategory, excluding Unknown)
    const validCategories = [
      'M7', 'M9', 'M11',
      'M13', 'M13 Elite',
      'M15', 'M15 Elite',
      'M18', 'Junior'
    ];
    if (!validCategories.includes(player_category)) {
      return res.status(400).json({
        error: `Invalid player_category. Must be one of: ${validCategories.join(', ')}`,
      });
    }
```

**Step 2: Verify change compiles**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add api/add-child.ts
git commit -m "fix(add-child): align valid categories with PlayerCategory type

- Add M13 Elite, M15 Elite, Junior
- Remove Adult (not a valid PlayerCategory)
- Matches check-availability slot mappings"
```

---

### Task 3: Add Debug Logging to check-availability (Temporary)

**Files:**
- Modify: `api/check-availability.ts:125-137`

**Step 1: Add logging to checkDateAvailability function**

After line 137 (after getting playerCategory), add:

```typescript
  // Debug logging - remove after fix verified
  console.log('[check-availability] Debug:', {
    date,
    sessionType,
    registrationId,
    playerCategory,
    allowedSlots: registrationId
      ? getAllowedSlotsForCategory(playerCategory, sessionType)
      : 'N/A (no registration_id)',
  });
```

**Step 2: Commit**

```bash
git add api/check-availability.ts
git commit -m "debug(check-availability): add logging for slot filtering

Temporary logging to verify fix - remove after testing"
```

---

### Task 4: Test the Fix Locally

**Step 1: Start development server**

Run: `npm run dev`
Expected: Server starts on localhost:3000

**Step 2: Manual test flow**

1. Log in as a parent
2. Click "Add Child"
3. Verify the category dropdown now shows Elite and Junior options
4. Add a test child with category M13
5. Open "Book a Session" modal for that child
6. Select "Group Training"
7. Select a weekday (Mon-Sat)
8. Verify "5:45 PM" slot appears (not "No available slots")

**Step 3: Check server logs**

Look for the debug output showing:
- `playerCategory: 'M13'`
- `allowedSlots: ['5:45 PM']`

---

### Task 5: Handle Existing 'Adult' Category Data (Migration)

**Files:**
- Create: `database/migrate-adult-to-junior.sql`

**Step 1: Write migration script**

```sql
-- Migration: Convert 'Adult' category to 'Junior'
-- Run this in Supabase SQL Editor to fix existing data

-- First, check affected rows
SELECT id, form_data->>'playerFullName' as player_name, form_data->>'playerCategory' as category
FROM registrations
WHERE form_data->>'playerCategory' = 'Adult';

-- Update Adult to Junior
UPDATE registrations
SET form_data = jsonb_set(form_data, '{playerCategory}', '"Junior"')
WHERE form_data->>'playerCategory' = 'Adult';

-- Verify update
SELECT id, form_data->>'playerFullName' as player_name, form_data->>'playerCategory' as category
FROM registrations
WHERE form_data->>'playerCategory' = 'Junior';
```

**Step 2: Run migration**

Run in Supabase SQL Editor (production)

**Step 3: Commit migration script**

```bash
git add database/migrate-adult-to-junior.sql
git commit -m "chore(db): add migration script for Adult->Junior category

Fixes existing data that was created with invalid 'Adult' category"
```

---

### Task 6: Remove Debug Logging

**Files:**
- Modify: `api/check-availability.ts`

**Step 1: Remove the debug console.log added in Task 3**

Delete the debug logging block added earlier.

**Step 2: Commit**

```bash
git add api/check-availability.ts
git commit -m "chore: remove debug logging from check-availability"
```

---

### Task 7: Deploy and Verify Production

**Step 1: Deploy to Vercel**

Run: `git push origin main`
Expected: Vercel auto-deploys

**Step 2: Run SQL migration on production**

Run the migration script from Task 5 in Supabase SQL Editor.

**Step 3: Production smoke test**

1. Log in to production site
2. Try booking a session for an existing child
3. Verify time slots appear correctly

---

## Summary of Changes

| File | Change |
|------|--------|
| `components/dashboard/AddChildModal.tsx` | Update categories to include Elite and Junior, remove Adult |
| `api/add-child.ts` | Update validation to match PlayerCategory type |
| `database/migrate-adult-to-junior.sql` | New migration script for existing data |

## Verification Checklist

- [ ] AddChildModal shows M13 Elite, M15 Elite, Junior options
- [ ] AddChildModal does NOT show 'Adult' option
- [ ] add-child API accepts Elite and Junior categories
- [ ] add-child API rejects 'Adult' category
- [ ] BookSessionModal shows correct slots for all valid categories
- [ ] Existing 'Adult' records migrated to 'Junior'
