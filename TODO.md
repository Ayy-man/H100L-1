# Codebase Issues & Improvements TODO

**Last Updated:** 2025-12-05
**Total Issues:** 43 issues identified across security, bugs, data flow, performance, and quality

---

## 🔴 CRITICAL - DO IMMEDIATELY (Before Production)

### Security Issues

- [ ] **1. Remove .env from Git Repository** (CRITICAL)
  - File: `.env` (lines 1-37)
  - Issue: Live production Stripe secret keys, Supabase service role key, and webhook secrets are committed
  - Risk: Complete compromise of payment processing and database access
  - **Action Required:**
    ```bash
    echo ".env" >> .gitignore
    echo ".env.local" >> .gitignore
    echo ".env.*.local" >> .gitignore
    git rm --cached .env
    git commit -m "chore: Remove .env from repository"
    git push
    ```

- [ ] **2. Rotate ALL Production Credentials** (CRITICAL)
  - Exposed: `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_WEBHOOK_SECRET`
  - **Action Required:**
    1. Go to Stripe Dashboard → Generate new Secret Key, Publishable Key, Webhook Secret
    2. Go to Supabase Dashboard → Generate new Service Role Key
    3. Add all new keys to Vercel Environment Variables (NOT .env)
    4. Redeploy application
    5. Check access logs for suspicious activity

- [x] **3. Add Input Validation to API Endpoints** (CRITICAL) ✅ FIXED
  - Files: `api/create-checkout-session.ts`, `api/create-subscription.ts`
  - Issue: User input from request body used without validation
  - Status: FIXED in create-checkout-session.ts
  - Todo: Add same validation to create-subscription.ts

- [x] **4. Fix Payment Status Inconsistency** (CRITICAL) ✅ FIXED
  - File: `api/stripe-webhook.ts` (line 134)
  - Issue: Webhook uses `'paid'` but types define `'succeeded'`
  - Status: FIXED - Changed to 'succeeded'

- [x] **5. Add Error Handling to Webhook Database Updates** (CRITICAL) ✅ FIXED
  - File: `api/stripe-webhook.ts` (lines 112-225)
  - Issue: Supabase updates don't check for errors - silent failures
  - Status: FIXED - Added error checking and logging

---

## 🟠 HIGH PRIORITY - Do This Week

### Security Issues

- [ ] **6. Add Authentication to check-availability API**
  - File: `api/check-availability.ts`
  - Issue: No authentication - anyone can query availability
  - Risk: Data scraping, DoS attacks, competitive intelligence
  - **Fix:**
    ```typescript
    const auth = req.headers.authorization?.split('Bearer ')[1];
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    // Verify token with Firebase Admin SDK
    ```

- [ ] **7. Fix Test Mode Security Bypass**
  - File: `components/dashboard/PaymentStatus.tsx` (lines 42-48)
  - Issue: Test mode allows $0 payments if env variable set in production
  - **Fix:**
    ```typescript
    if (import.meta.env.DEV && import.meta.env.VITE_STRIPE_PRICE_TEST) {
      return { amount: '$0.00 (TEST)', priceId: import.meta.env.VITE_STRIPE_PRICE_TEST };
    }
    ```

- [ ] **8. Add Rate Limiting to All API Endpoints**
  - Files: All files in `api/` directory
  - Issue: No rate limiting on any endpoints
  - Risk: Brute force attacks, DoS
  - **Fix:** Implement with Vercel Edge Config or @upstash/ratelimit

- [ ] **9. Sanitize User Input in Profile Editing**
  - File: `components/ProfilePage.tsx` (lines 72-98)
  - Issue: User input saved directly to database without sanitization
  - Risk: Stored XSS attacks
  - **Fix:** Add input sanitization with DOMPurify or similar

- [ ] **10. Fix Weak Webhook Error Messages**
  - File: `api/stripe-webhook.ts` (lines 43-49)
  - Issue: Error messages expose webhook secret details
  - **Fix:** Return generic error message to client, log details server-side

### Bugs

- [ ] **11. Fix Race Condition in Dashboard Data Fetching**
  - File: `components/Dashboard.tsx` (lines 52-106)
  - Issue: Dashboard fetches immediately when user state changes, auth not fully propagated
  - Impact: "No registration found" error on first load
  - **Fix:** Add retry logic or increase delay to 1000ms

- [ ] **12. Fix Incorrect Capacity Calculation**
  - File: `lib/unifiedCapacityManager.ts` (lines 80-93)
  - Issue: Doesn't account for specific time slot, just counts all on a day
  - Impact: Overbooking or incorrect availability
  - **Fix:** Filter by specific time slot, not just day

- [ ] **13. Fix Missing semiPrivateTimeSlot Field**
  - File: `lib/unifiedCapacityManager.ts` (line 128)
  - Issue: References field that doesn't exist in FormData type
  - Impact: Semi-private bookings always show available
  - **Fix:** Add field to `types.ts` or remove this logic

- [ ] **14. Fix Incorrect Private Pricing Display**
  - File: `components/dashboard/PaymentStatus.tsx` (lines 59-65)
  - Issue: Shows $899.99/$1,499.99 but should be $499.99/$799.99
  - **Fix:** Use values from `lib/stripe.ts` PRICING constant

- [ ] **15. Fix Emergency Phone Validation**
  - File: `components/RegistrationForm.tsx` (line 98)
  - Issue: Validates before both fields are filled
  - **Fix:** Only validate if both parent and emergency phone are filled

### Data Flow Issues

- [ ] **16. Standardize Array Types**
  - Files: `types.ts` (lines 63, 68)
  - Issue: `groupSelectedDays: WeekDay[]` vs `privateSelectedDays: string[]`
  - **Fix:** Standardize both to `WeekDay[]`

- [ ] **17. Handle Payment Status Null Case**
  - Type: `payment_status: 'pending' | 'succeeded' | 'failed' | 'canceled' | null`
  - Files: `components/dashboard/PaymentStatus.tsx`, `components/BillingPage.tsx`
  - Issue: Components don't handle null case
  - **Fix:** Add null handling or remove null from type

- [ ] **18. Add Registration ID Validation**
  - Issue: No validation that registrationId is valid UUID format
  - **Fix:** Add UUID validation in API endpoints

---

## 🟡 MEDIUM PRIORITY - Fix When You Can

### Security Issues

- [ ] **19. Add CORS Configuration**
  - Files: All API endpoints
  - Issue: No explicit CORS headers
  - **Fix:** Add CORS headers to vercel.json or individual endpoints

- [ ] **20. Use Secure Cookies Instead of sessionStorage**
  - File: `components/Dashboard.tsx` (line 257)
  - Issue: sessionStorage used without encryption for session data
  - **Fix:** Use httpOnly cookies for sensitive data

### Bugs

- [ ] **21. Fix Subscription Status Type Mismatch**
  - File: `api/stripe-webhook.ts` (lines 197-199)
  - Issue: Stripe uses "active", "past_due" but app uses "succeeded", "pending"
  - **Fix:** Map Stripe statuses to app statuses

- [ ] **22. Add Null Check in Billing Page**
  - File: `components/BillingPage.tsx` (line 246)
  - Issue: Accesses registration.created_at without null check
  - **Fix:** Add optional chaining

- [ ] **23. Fix Form Data Persistence Issue**
  - File: `components/RegistrationForm.tsx` (lines 54-63)
  - Issue: Files set to null on restore, losing upload progress
  - **Fix:** Store file metadata separately or warn user

### Performance Issues

- [ ] **24. Fix Excessive Re-renders in Dashboard**
  - File: `components/Dashboard.tsx` (lines 108-142)
  - Issue: Real-time subscription triggers re-render on every update
  - **Fix:** Memoize components, only update changed fields

- [ ] **25. Fix N+1 Query Problem**
  - File: `lib/unifiedCapacityManager.ts` (lines 154-173)
  - Issue: Separate query for each time slot
  - Impact: 4-5 queries per day request
  - **Fix:** Fetch all day bookings once, calculate for all slots

- [ ] **26. Add Memoization to Calendar Calculations**
  - File: `components/SchedulePage.tsx` (lines 88-180, 182-225)
  - Issue: Expensive calculations run on every render
  - **Fix:**
    ```typescript
    const monthSessions = useMemo(() => getMonthSessions(), [registration, currentMonth]);
    const calendarDays = useMemo(() => getCalendarDays(), [monthSessions]);
    ```

- [ ] **27. Add Missing useEffect Cleanup**
  - File: `components/Dashboard.tsx` (lines 108-142)
  - Issue: Realtime subscription cleanup may not fire
  - Risk: Memory leaks
  - **Fix:** Ensure unsubscribe is called in cleanup

- [ ] **28. Optimize File Validation**
  - File: `lib/storageService.ts` (lines 12-26)
  - Issue: Reads entire file into memory
  - **Fix:** Stream validation for large files

- [ ] **29. Optimize Profile Updates**
  - File: `components/ProfilePage.tsx` (lines 72-98)
  - Issue: Updates entire form_data object even if only one field changed
  - **Fix:** Only update changed fields

### Code Quality Issues

- [x] **30. Delete Dead Code Files** ✅ FIXED (2025-12-05)
  - Files deleted:
    - `components/PaymentForm.old.tsx`
    - `components/form/FormStep1.old.tsx`
    - `components/form/FormStep3.old.tsx`
    - `components/form/FormStep4.old.tsx`
    - `components/form/FormStep2.backup.tsx`

- [ ] **31. Centralize Price Calculation Logic**
  - Files with duplicate logic:
    - `lib/stripe.ts` (lines 80-102)
    - `components/dashboard/PaymentStatus.tsx` (lines 39-74)
    - `components/BillingPage.tsx` (lines 74-88)
  - **Fix:** Export from stripe.ts, import everywhere else

- [x] **32. Remove Console.log Statements** ✅ FIXED (2025-12-05)
  - Removed all console.log statements from 24+ files
  - Kept console.error for production error tracking
  - Cleaned: API endpoints, components, lib utilities

- [ ] **33. Standardize Error Handling**
  - Issue: Three different patterns used
    - Pattern 1: Try-catch with alert()
    - Pattern 2: Try-catch with toast()
    - Pattern 3: Try-catch with setState
  - **Fix:** Standardize on toast() approach

- [ ] **34. Add Comprehensive Input Validation**
  - File: `components/form/FormStep1.tsx`
  - Missing:
    - Canadian postal code format (A1A 1A1)
    - Phone number format enforcement
    - Date of birth age range check
  - **Fix:** Add validation functions

- [ ] **35. Move Hardcoded Values to Constants**
  - File: `components/SchedulePage.tsx` (lines 527-529)
  - Issue: Training location hardcoded
  - **Fix:** Move to constants.ts or env variables

- [ ] **36. Replace Magic Numbers with Named Constants**
  - File: `components/Login.tsx` (line 43)
  - Issue: `setTimeout(() => {...}, 500)` - why 500ms?
  - **Fix:** `const AUTH_PROPAGATION_DELAY = 500`

- [ ] **37. Fix Weak Type Safety**
  - File: `components/PaymentForm.tsx` (line 71)
  - Issue: `card: cardElement as any` defeats TypeScript
  - **Fix:** Use proper Stripe types

- [ ] **38. Add Environment Variable Validation**
  - Files: All lib files using env variables
  - Issue: Only checks if exists, not if valid
  - **Fix:**
    ```typescript
    if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_')) {
      throw new Error('Invalid STRIPE_SECRET_KEY');
    }
    ```

- [ ] **39. Standardize Naming Convention**
  - Issue: Mixed snake_case and camelCase
  - Examples: `firebase_uid` vs `firebaseUid`, `payment_status` vs `paymentStatus`
  - **Fix:** Use camelCase for JavaScript, snake_case for database columns

- [ ] **40. Add SQL Injection Protection**
  - File: `lib/unifiedCapacityManager.ts` (lines 104-107)
  - Issue: `.or()` with string interpolation could be exploited
  - **Fix:** Use parameterized queries and validate enum values

---

## 📊 Issue Summary

| Priority | Security | Bugs | Data Flow | Performance | Quality | **Total** |
|----------|----------|------|-----------|-------------|---------|-----------|
| 🔴 Critical | 5 (2 fixed) | 3 (2 fixed) | 0 | 0 | 0 | **8 (4 fixed)** |
| 🟠 High | 5 | 5 | 3 | 4 | 0 | **17** |
| 🟡 Medium | 2 | 3 | 0 | 6 | 10 | **21** |
| **TOTAL** | **12** | **11** | **3** | **10** | **10** | **46** |

---

## ✅ Recently Fixed (2025-12-05)

1. ✅ Added input validation to create-checkout-session API
2. ✅ Fixed payment status inconsistency (changed 'paid' to 'succeeded')
3. ✅ Added error handling to all webhook database updates
4. ✅ Added proper error propagation in webhook handlers
5. ✅ Deleted dead code files (.old, .backup files)
6. ✅ Removed all console.log debug statements from production code
7. ✅ Fixed day selection button UX (short names on mobile, full slot blocking)
8. ✅ Added Next button disable during availability check
9. ✅ Updated program card features per client request

---

## 📝 Notes

- **Critical issues** must be fixed before production deployment
- **High priority** issues should be addressed within 1 week
- **Medium priority** issues should be fixed within 1 month
- Review and update this list after each sprint/deployment
- Mark completed items with ✅ and date completed

---

## 🔗 References

- Stripe API Documentation: https://stripe.com/docs/api
- Supabase Security Best Practices: https://supabase.com/docs/guides/auth/auth-helpers
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- React Performance Optimization: https://react.dev/learn/render-and-commit
