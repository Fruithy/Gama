/**
 * Lazily-loaded Supabase Auth client. Only downloaded when a player taps a
 * sign-in button — never part of the game or homepage bundles.
 */
export function authConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export async function supabaseClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: false, autoRefreshToken: false },
  });
}

export async function signInWithEmail(email: string) {
  const sb = await supabaseClient();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
  if (error) throw error;
}

export async function signInWithProvider(provider: "google" | "apple") {
  const sb = await supabaseClient();
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/auth/callback` } });
  if (error) throw error;
}
