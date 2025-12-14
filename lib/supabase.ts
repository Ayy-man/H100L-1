import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Dual-environment Supabase client
 *
 * Works in both:
 * - Browser (Vite): Uses import.meta.env.VITE_SUPABASE_*
 * - Serverless (Vercel API): Uses process.env.SUPABASE_* or process.env.VITE_SUPABASE_*
 */

let _supabase: SupabaseClient | null = null;

// Detect environment and get credentials accordingly
const getSupabaseCredentials = () => {
  // Check if we're in a browser environment (Vite) with actual values
  // Use try-catch because import.meta might not be defined in all environments
  try {
    if (typeof import.meta !== 'undefined' &&
        import.meta.env &&
        import.meta.env.VITE_SUPABASE_URL) {
      return {
        url: import.meta.env.VITE_SUPABASE_URL,
        key: import.meta.env.VITE_SUPABASE_ANON_KEY
      };
    }
  } catch (e) {
    // import.meta not available, continue to process.env
  }

  // Otherwise, we're in a Node.js environment (Vercel serverless function)
  // Try non-prefixed first, then fall back to VITE_ prefixed
  if (typeof process !== 'undefined' && process.env) {
    return {
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      key: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
    };
  }

  // Fallback (should never reach here)
  return { url: undefined, key: undefined };
};

/**
 * Get or create the Supabase client
 * Lazily initialized to avoid crashes at import time
 */
export const getSupabase = (): SupabaseClient => {
  if (!_supabase) {
    const { url, key } = getSupabaseCredentials();

    if (!url || !key) {
      console.error('⚠️ SUPABASE ERROR: Missing credentials');
      console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
      throw new Error('Supabase URL and Anon Key are required.');
    }

    _supabase = createClient(url, key);
  }
  return _supabase;
};

// For backward compatibility - lazy initialization
// This will throw if accessed without proper env vars, but won't crash at import time
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = getSupabase();
    const value = client[prop as keyof SupabaseClient];
    // Bind methods to the client instance to preserve 'this' context
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

// Admin client with service role key for bypassing RLS
let _supabaseAdmin: SupabaseClient | null = null;

export const supabaseAdmin = (() => {
  if (!_supabaseAdmin) {
    // Get credentials - prioritize service role key for admin operations
    const url = process.env.SUPABASE_URL ||
                process.env.VITE_SUPABASE_URL ||
                import.meta.env?.VITE_SUPABASE_URL;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      console.error('⚠️ SUPABASE ADMIN ERROR: Missing service role key');
      console.error('Required: SUPABASE_SERVICE_ROLE_KEY in environment variables');
      throw new Error('Supabase URL and Service Role Key are required for admin operations.');
    }

    _supabaseAdmin = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return _supabaseAdmin;
})();
