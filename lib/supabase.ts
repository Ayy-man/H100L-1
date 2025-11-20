import { createClient } from '@supabase/supabase-js';

/**
 * Dual-environment Supabase client
 *
 * Works in both:
 * - Browser (Vite): Uses import.meta.env.VITE_SUPABASE_*
 * - Serverless (Vercel API): Uses process.env.SUPABASE_* or process.env.VITE_SUPABASE_*
 */

// Detect environment and get credentials accordingly
const getSupabaseCredentials = () => {
  // Check if we're in a browser environment (Vite)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return {
      url: import.meta.env.VITE_SUPABASE_URL,
      key: import.meta.env.VITE_SUPABASE_ANON_KEY
    };
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

const { url: supabaseUrl, key: supabaseAnonKey } = getSupabaseCredentials();

// Validate credentials
if (!supabaseUrl || !supabaseAnonKey) {
  const env = typeof import.meta !== 'undefined' ? 'browser (Vite)' : 'serverless (Node.js)';
  console.error(`⚠️ SUPABASE ERROR: Missing credentials in ${env} environment`);
  console.error('Required variables:');
  if (env === 'browser (Vite)') {
    console.error('  - VITE_SUPABASE_URL');
    console.error('  - VITE_SUPABASE_ANON_KEY');
  } else {
    console.error('  - SUPABASE_URL or VITE_SUPABASE_URL');
    console.error('  - SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY');
  }
  throw new Error('Supabase URL and Anon Key are required.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
