// Public Supabase settings. Fill these in from the Supabase dashboard (Project Settings → API).
//
// ONLY the project URL and the PUBLISHABLE (anon) key may ever appear here. They are public
// by design: every visitor's browser receives them, and Row Level Security in the database
// decides what each user may do.
// NEVER put the service_role key, the secret key or the database password in this file
// or anywhere else in this repository.

export const SUPABASE_URL = 'https://qxjeaoxujpyafksxzqak.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_6teP37BVtSNmW6Gg_TN5tw_3f_KOQmy';

/** Where phones send their daily step totals (Edge Function `ingest-steps`; token in the header only). */
export const INGEST_URL = `${SUPABASE_URL}/functions/v1/ingest-steps`;

/** Public web address of the app (used to build email links). */
export const SITE_URL = 'https://gemedos.github.io/runsesh/';

export function isConfigured() {
  return /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(SUPABASE_URL) && SUPABASE_PUBLISHABLE_KEY.length > 20 && !SUPABASE_PUBLISHABLE_KEY.startsWith('PASTE_');
}
