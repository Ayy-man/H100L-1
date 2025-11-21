import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User,
  UserCredential,
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * Authentication Service
 * Client-side only Firebase authentication utilities
 */

/**
 * Create a new Firebase user with email and password
 * @param email - User's email address
 * @param password - User's password (min 6 characters)
 * @param displayName - Optional display name (e.g., parent full name)
 * @returns UserCredential with user data
 */
export const createFirebaseUser = async (
  email: string,
  password: string,
  displayName?: string
): Promise<UserCredential> => {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Check environment variables.');
  }

  try {
    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Update display name if provided
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, {
        displayName,
      });
    }

    return userCredential;
  } catch (error: any) {
    // Handle Firebase errors
    throw handleAuthError(error);
  }
};

/**
 * Sign in an existing user with email and password
 * @param email - User's email address
 * @param password - User's password
 * @returns UserCredential with user data
 */
export const loginUser = async (email: string, password: string): Promise<UserCredential> => {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Check environment variables.');
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential;
  } catch (error: any) {
    throw handleAuthError(error);
  }
};

/**
 * Sign out the current user
 */
export const logoutUser = async (): Promise<void> => {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Check environment variables.');
  }

  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error('Failed to sign out. Please try again.');
  }
};

/**
 * Send a password reset email to the user
 * @param email - User's email address
 */
export const resetPassword = async (email: string): Promise<void> => {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Check environment variables.');
  }

  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    throw handleAuthError(error);
  }
};

/**
 * Get the currently signed-in user
 * @returns User object or null if not signed in
 */
export const getCurrentUser = (): User | null => {
  if (!auth) {
    console.warn('Firebase Auth is not initialized');
    return null;
  }

  return auth.currentUser;
};

/**
 * Subscribe to authentication state changes
 * @param callback - Function to call when auth state changes
 * @returns Unsubscribe function
 */
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  if (!auth) {
    console.warn('Firebase Auth is not initialized');
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
};

/**
 * Check if a user is currently signed in
 * @returns boolean indicating if user is signed in
 */
export const isUserSignedIn = (): boolean => {
  return getCurrentUser() !== null;
};

/**
 * Handle Firebase Authentication errors and return user-friendly messages
 * @param error - Firebase error object
 * @returns Error with user-friendly message
 */
const handleAuthError = (error: any): Error => {
  const errorCode = error.code;
  let message = 'An error occurred. Please try again.';

  switch (errorCode) {
    case 'auth/email-already-in-use':
      message = 'This email is already registered. Please sign in instead.';
      break;
    case 'auth/invalid-email':
      message = 'Please enter a valid email address.';
      break;
    case 'auth/operation-not-allowed':
      message = 'Email/password accounts are not enabled. Please contact support.';
      break;
    case 'auth/weak-password':
      message = 'Password should be at least 6 characters long.';
      break;
    case 'auth/user-disabled':
      message = 'This account has been disabled. Please contact support.';
      break;
    case 'auth/user-not-found':
      message = 'No account found with this email. Please sign up first.';
      break;
    case 'auth/wrong-password':
      message = 'Incorrect password. Please try again.';
      break;
    case 'auth/invalid-credential':
      message = 'Invalid email or password. Please try again.';
      break;
    case 'auth/too-many-requests':
      message = 'Too many failed attempts. Please try again later or reset your password.';
      break;
    case 'auth/network-request-failed':
      message = 'Network error. Please check your internet connection.';
      break;
    default:
      message = error.message || 'An error occurred. Please try again.';
  }

  return new Error(message);
};

/**
 * Validate email format
 * @param email - Email to validate
 * @returns boolean indicating if email is valid
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Object with validation result and message
 */
export const validatePassword = (
  password: string
): { isValid: boolean; message: string } => {
  if (password.length < 6) {
    return { isValid: false, message: 'Password must be at least 6 characters long' };
  }

  return { isValid: true, message: '' };
};
