/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  // Credit system price IDs
  readonly VITE_STRIPE_PRICE_CREDIT_SINGLE: string;
  readonly VITE_STRIPE_PRICE_CREDIT_10PACK: string;
  readonly VITE_STRIPE_PRICE_CREDIT_20PACK: string;
  readonly VITE_STRIPE_PRICE_SUNDAY: string;
  readonly VITE_STRIPE_PRICE_SEMI_PRIVATE_SESSION: string;
  readonly VITE_STRIPE_PRICE_PRIVATE_SESSION: string;
  readonly VITE_STRIPE_PRICE_TEAM_SESSION?: string;
  // Supabase
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // Firebase
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
