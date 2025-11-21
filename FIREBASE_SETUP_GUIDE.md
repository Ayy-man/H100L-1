# Firebase Authentication Setup Guide

This guide explains how to use the Firebase Authentication system that has been set up for the H100L Hockey Training project.

## ✅ What's Been Completed

1. **Firebase SDK Installed** - Client-side Firebase package (no Admin SDK)
2. **Firebase Configuration** - Environment-based config with validation
3. **Authentication Utilities** - Reusable functions for signup, login, logout, password reset
4. **Database Migration** - Supabase schema updated to link Firebase users to registrations
5. **TypeScript Types** - Full type safety for Firebase environment variables

## 📦 Files Created

### Firebase Configuration
- `lib/firebase.ts` - Firebase app initialization with environment variables
- `lib/authService.ts` - Authentication utility functions

### Database
- `database/firebase_auth_setup.sql` - Supabase migration for Firebase user tracking

### Environment
- `.env.example` - Updated with Firebase configuration template
- `.env.firebase` - Actual Firebase values (add these to your `.env`)
- `vite-env.d.ts` - TypeScript definitions for Firebase environment variables

## 🔧 Setup Instructions

### Step 1: Add Firebase Config to .env

Copy the contents of `.env.firebase` to your `.env` file (or create `.env` if it doesn't exist):

```bash
VITE_FIREBASE_API_KEY=AIzaSyCDrjBCzBRwAeg0qdJIO_B8LWOFrXH4TCU
VITE_FIREBASE_AUTH_DOMAIN=h100l-96539.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=h100l-96539
VITE_FIREBASE_STORAGE_BUCKET=h100l-96539.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1093303079092
VITE_FIREBASE_APP_ID=1:1093303079092:web:0a4e8101adb937cf2587e1
```

**Note:** These are the actual values for your Firebase project.

### Step 2: Run the Database Migration

Go to your Supabase dashboard:
1. Navigate to the **SQL Editor**
2. Copy the contents of `database/firebase_auth_setup.sql`
3. Paste and run the migration

This will:
- Add `firebase_uid`, `parent_email`, and `firebase_user_created_at` columns to the registrations table
- Create indexes for efficient queries
- Add helper functions for linking Firebase users to registrations
- Update the `registrations_view` to include Firebase fields

### Step 3: Restart Your Dev Server

After adding environment variables, restart the dev server:

```bash
npm run dev
```

You should see: `✅ Firebase initialized successfully` in the console.

## 🔑 Available Authentication Functions

All authentication functions are in `lib/authService.ts`:

### 1. Create a New User (Sign Up)

```typescript
import { createFirebaseUser } from '@/lib/authService';

// After successful payment, create Firebase user
try {
  const userCredential = await createFirebaseUser(
    formData.parentEmail,
    'temporaryPassword123', // Generate this or let user set it
    formData.parentFullName  // Display name
  );

  const firebaseUid = userCredential.user.uid;
  console.log('Firebase user created:', firebaseUid);

  // Link Firebase user to registration in Supabase
  // See "Linking Firebase to Registration" section below

} catch (error) {
  console.error('Failed to create Firebase user:', error.message);
}
```

### 2. Login

```typescript
import { loginUser } from '@/lib/authService';

try {
  const userCredential = await loginUser(email, password);
  console.log('User logged in:', userCredential.user.uid);
} catch (error) {
  console.error('Login failed:', error.message);
}
```

### 3. Logout

```typescript
import { logoutUser } from '@/lib/authService';

try {
  await logoutUser();
  console.log('User logged out');
} catch (error) {
  console.error('Logout failed:', error.message);
}
```

### 4. Password Reset

```typescript
import { resetPassword } from '@/lib/authService';

try {
  await resetPassword(email);
  alert('Password reset email sent! Check your inbox.');
} catch (error) {
  console.error('Password reset failed:', error.message);
}
```

### 5. Check Auth State

```typescript
import { onAuthStateChange, getCurrentUser, isUserSignedIn } from '@/lib/authService';

// Listen for auth state changes
const unsubscribe = onAuthStateChange((user) => {
  if (user) {
    console.log('User is signed in:', user.uid);
  } else {
    console.log('User is signed out');
  }
});

// Get current user
const user = getCurrentUser();
if (user) {
  console.log('Current user:', user.email);
}

// Check if signed in
if (isUserSignedIn()) {
  console.log('User is authenticated');
}

// Clean up listener when component unmounts
unsubscribe();
```

### 6. Email & Password Validation

```typescript
import { isValidEmail, validatePassword } from '@/lib/authService';

// Validate email format
if (!isValidEmail('test@example.com')) {
  console.log('Invalid email format');
}

// Validate password strength
const { isValid, message } = validatePassword('mypassword');
if (!isValid) {
  console.log('Password error:', message);
}
```

## 🔗 Linking Firebase User to Registration

After creating a Firebase user, link it to the Supabase registration:

### Option 1: Using Supabase Function (Recommended)

```typescript
import { supabase } from '@/lib/supabase';

// After creating Firebase user
const { data, error } = await supabase.rpc('link_firebase_user_to_registration', {
  p_registration_id: registrationId,  // UUID from registrations table
  p_firebase_uid: userCredential.user.uid,
  p_parent_email: formData.parentEmail
});

if (error) {
  console.error('Failed to link Firebase user:', error);
} else {
  console.log('Successfully linked Firebase user to registration');
}
```

### Option 2: Direct Update

```typescript
import { supabase } from '@/lib/supabase';

const { error } = await supabase
  .from('registrations')
  .update({
    firebase_uid: userCredential.user.uid,
    parent_email: formData.parentEmail,
    firebase_user_created_at: new Date().toISOString()
  })
  .eq('id', registrationId);
```

## 📝 Implementation Example: Post-Payment Flow

Here's how to integrate Firebase user creation after payment:

```typescript
// In components/RegistrationForm.tsx or PaymentForm.tsx

const handlePaymentSuccess = async (paymentMethod: string) => {
  try {
    // 1. Upload files to Supabase Storage
    let uploadedFiles = {};
    if (formData.actionPlan || formData.medicalReport) {
      uploadedFiles = await uploadMedicalFiles({
        actionPlan: formData.actionPlan,
        medicalReport: formData.medicalReport,
      }, tempRegistrationId);
    }

    // 2. Create registration in Supabase
    const { data: registrationData, error: insertError } = await supabase
      .from('registrations')
      .insert({
        form_data: dataToSubmit,
        parent_email: formData.parentEmail  // Now at top level
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    const registrationId = registrationData.id;

    // 3. Create Stripe subscription
    const subscriptionResponse = await fetch('/api/create-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethodId: paymentMethod,
        registrationId: registrationId,
        customerEmail: formData.parentEmail,
        customerName: formData.parentFullName,
        programType: formData.programType,
        frequency: formData.groupFrequency || formData.privateFrequency
      }),
    });

    if (!subscriptionResponse.ok) {
      throw new Error('Failed to create subscription');
    }

    // 4. Create Firebase user account
    const temporaryPassword = generateSecurePassword(); // You need to implement this

    const userCredential = await createFirebaseUser(
      formData.parentEmail,
      temporaryPassword,
      formData.parentFullName
    );

    // 5. Link Firebase user to registration
    await supabase.rpc('link_firebase_user_to_registration', {
      p_registration_id: registrationId,
      p_firebase_uid: userCredential.user.uid,
      p_parent_email: formData.parentEmail
    });

    // 6. Send welcome email with temporary password
    // TODO: Implement email sending with password

    alert('✅ Registration complete! Check your email for login credentials.');
    localStorage.removeItem('registrationFormData');
    onClose();

  } catch (error) {
    console.error('Error:', error);
    alert(`Registration failed: ${error.message}`);
  }
};
```

## 🔐 Security Best Practices

### 1. Password Generation
Generate a secure temporary password for users:

```typescript
function generateSecurePassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length];
  }

  return password;
}
```

### 2. Email Verification (Optional)
Enable email verification in Firebase Console:
1. Go to Authentication > Settings
2. Enable "Email enumeration protection"
3. Customize email templates

### 3. Password Reset Flow
Create a password reset page that uses the `resetPassword` function.

## 🗄️ Database Schema Changes

After running the migration, your `registrations` table will have:

| Column | Type | Description |
|--------|------|-------------|
| `firebase_uid` | TEXT | Firebase user ID (unique) |
| `parent_email` | TEXT | Parent email (top-level, indexed) |
| `firebase_user_created_at` | TIMESTAMPTZ | When Firebase user was created |

**Indexes created:**
- `idx_registrations_firebase_uid` - Fast lookups by Firebase UID
- `idx_registrations_parent_email_top_level` - Fast email searches
- `idx_registrations_firebase_user_created_at` - Analytics queries

**Helper Functions:**
- `link_firebase_user_to_registration(registration_id, firebase_uid, parent_email)` - Link Firebase user
- `get_registration_by_firebase_uid(firebase_uid)` - Fetch registration by Firebase UID

## 🎯 Next Steps

1. **Implement Post-Payment User Creation**
   - Add Firebase user creation to `RegistrationForm.tsx` after payment success
   - Generate secure temporary password
   - Link Firebase UID to registration in Supabase

2. **Create Login Page**
   - Build a login form component
   - Use `loginUser()` function
   - Redirect to user dashboard after login

3. **Build User Dashboard**
   - Fetch registration data using `get_registration_by_firebase_uid()`
   - Display player info, schedule, payment history
   - Allow profile updates

4. **Add Password Reset**
   - Create password reset page
   - Use `resetPassword()` function
   - Handle Firebase password reset emails

5. **Email Integration**
   - Send welcome email with temporary password after registration
   - Send password reset instructions
   - Consider using a service like SendGrid or Resend

## ❓ Troubleshooting

### Firebase not initializing
Check the console for: `⚠️ FIREBASE ERROR: Missing environment variables`
- Make sure all `VITE_FIREBASE_*` variables are in `.env`
- Restart the dev server after adding environment variables

### "Firebase Auth is not initialized"
- Verify Firebase config is correct in `.env`
- Check browser console for initialization errors
- Make sure you're running `npm run dev` (not `npm run dev:vite`)

### User creation fails with "operation-not-allowed"
- Go to Firebase Console > Authentication > Sign-in method
- Enable "Email/Password" provider

### Database functions not found
- Make sure you ran the `firebase_auth_setup.sql` migration
- Check Supabase logs for any SQL errors

## 📚 Resources

- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Firebase Web SDK Guide](https://firebase.google.com/docs/web/setup)
- [Supabase Functions](https://supabase.com/docs/guides/database/functions)

## 🔒 Important Notes

- **No Firebase Admin SDK** - This is a client-side only setup (no service account keys needed)
- **Parent Email** - Now available at top level in `registrations` table for efficient querying
- **Unique Firebase UIDs** - Each Firebase user can only be linked to one registration
- **Temporary Passwords** - You'll need to implement password generation and email sending

---

**Need Help?** Check the authentication utilities in `lib/authService.ts` for detailed function documentation.
