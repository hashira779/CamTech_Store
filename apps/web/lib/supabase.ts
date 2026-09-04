import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://icouardbzhytnozaordc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imljb3VhcmRiemh5dG5vemFvcmRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NzkwNTEsImV4cCI6MjEwMjQ1NTA1MX0.xsEXyGBe0J_3NtRIRPBF_QgwIdkm5wt0uxJNJmRzDpI';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = (rawUrl && rawUrl.trim()) ? rawUrl.trim() : DEFAULT_SUPABASE_URL;
const supabaseAnonKey = (rawKey && rawKey.trim()) ? rawKey.trim() : DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function signInWithGoogle(redirectTo?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo || `${window.location.origin}/dashboard`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOutSupabase() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}
