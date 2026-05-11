import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// If credentials are not provided via environment variables, we will initialize a "dummy" client
// but auth operations will fail gracefully or show a warning.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
