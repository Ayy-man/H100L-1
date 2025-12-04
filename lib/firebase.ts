import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase configuration using Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate Firebase configuration
const validateFirebaseConfig = () => {
  const missingKeys = [];

  if (!firebaseConfig.apiKey) missingKeys.push('VITE_FIREBASE_API_KEY');
  if (!firebaseConfig.authDomain) missingKeys.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!firebaseConfig.projectId) missingKeys.push('VITE_FIREBASE_PROJECT_ID');
  if (!firebaseConfig.storageBucket) missingKeys.push('VITE_FIREBASE_STORAGE_BUCKET');
  if (!firebaseConfig.messagingSenderId) missingKeys.push('VITE_FIREBASE_MESSAGING_SENDER_ID');
  if (!firebaseConfig.appId) missingKeys.push('VITE_FIREBASE_APP_ID');

  if (missingKeys.length > 0) {
    console.error('⚠️ FIREBASE ERROR: Missing environment variables:', missingKeys.join(', '));
    console.error('Add these to your .env file. See .env.example for template.');
    console.error('📋 DEBUG - Current config values:');
    console.error('  apiKey:', firebaseConfig.apiKey ? '✓ Set' : '✗ Missing');
    console.error('  authDomain:', firebaseConfig.authDomain ? '✓ Set' : '✗ Missing');
    console.error('  projectId:', firebaseConfig.projectId ? '✓ Set' : '✗ Missing');
    console.error('  storageBucket:', firebaseConfig.storageBucket ? '✓ Set' : '✗ Missing');
    console.error('  messagingSenderId:', firebaseConfig.messagingSenderId ? '✓ Set' : '✗ Missing');
    console.error('  appId:', firebaseConfig.appId ? '✓ Set' : '✗ Missing');
    console.error('💡 TIP: Restart the dev server (npm run dev) to load environment variables!');
    return false;
  }

  return true;
};

// Initialize Firebase only if config is valid
let app;
let auth;

if (validateFirebaseConfig()) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} else {
  console.warn('⚠️ Firebase not initialized - check environment variables');
}

export { auth };
export default app;
