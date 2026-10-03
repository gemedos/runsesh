// The single Supabase client for the app.
// The SDK is vendored (vendor/supabase.js, see vendor/README.md) and loaded with a classic
// <script> tag before the app modules, which exposes window.supabase.
// Sessions use the SDK's default storage; the app never copies tokens anywhere else.

import { isConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config.js';

let client = null;

export function getSupabase() {
  if (client) return client;
  if (!isConfigured()) throw new Error('Supabase is not configured');
  const sdk = globalThis.supabase;
  if (!sdk || typeof sdk.createClient !== 'function') throw new Error('Supabase SDK missing');
  client = sdk.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      // Email links are handled by auth-callback.html (verifyOtp with a one-time token_hash),
      // so the main app never reads auth parameters from its own URL.
      detectSessionInUrl: false,
    },
  });
  return client;
}
