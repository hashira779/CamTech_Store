import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * Supabase is only the fallback, so it loads on demand. Creating the client on every page
 * made browsers with an old saved session retry a token refresh against it, outage or not.
 */
export function getSupabase(): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(supabaseUrl || '', supabaseAnonKey || '', {
      auth: {
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: true,
      },
    })
  );
  return clientPromise;
}

/** True when the browser just came back from a Supabase Google redirect. */
export function isSupabaseCallback(): boolean {
  return window.location.hash.includes('access_token=') || new URLSearchParams(window.location.search).has('code');
}

export async function isSupabaseReachable(): Promise<boolean> {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  try {
    // An opaque response is enough: this only asks whether the host answers at all.
    await fetch(`${supabaseUrl}/auth/v1/health`, { mode: 'no-cors' });
    return true;
  } catch {
    return false;
  }
}

export async function signInWithGoogle() {
  // A redirect to a dead host would strand the customer on a browser error page.
  if (!(await isSupabaseReachable())) {
    throw new Error('Supabase is unreachable');
  }
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
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

export async function signOut() {
  if (!clientPromise) return;
  const supabase = await clientPromise;
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}
