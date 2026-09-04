import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://ypfztbwdvkfdupsniixw.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwZnp0YndkdmtmZHVwc25paXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MjY1MDgsImV4cCI6MjEwNDEwMjUwOH0.0xU0S2_S45a9xHjHR6fdSJwRuHdc1w6i3Pm7Ahq8pQ0';

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
