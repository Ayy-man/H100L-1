import { createClient } from '@supabase/supabase-js';

// --- IMPORTANT SECURITY NOTE ---
// The credentials below are hardcoded for this specific development environment
// because there is no build process (like Vite or Webpack) to handle .env files.
// In a real production application, these values MUST be stored securely
// in environment variables and should never be committed to version control.
// The user has been advised to rotate these keys as they were exposed.

const supabaseUrl = 'https://ozdmultceksjktgufyrs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96ZG11bHRjZWtzamt0Z3VmeXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NjE0NzksImV4cCI6MjA3ODIzNzQ3OX0.bRU2wNgzsEHXyX065k5tG2IkoOrl6-ISzLu3kPqtF-4';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key are required.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
