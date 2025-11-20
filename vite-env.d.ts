/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_STRIPE_PRICE_GROUP_1X: string;
  readonly VITE_STRIPE_PRICE_GROUP_2X: string;
  readonly VITE_STRIPE_PRICE_PRIVATE_1X: string;
  readonly VITE_STRIPE_PRICE_PRIVATE_2X: string;
  readonly VITE_STRIPE_PRICE_SEMI_PRIVATE: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
