// Owner-controlled switches (supabase/migrations/20261007120100_manual_entry_switches.sql).
// The app only READS them to decide what to show; the database enforces them on every write,
// so hiding the form is a convenience, not the protection.

import { getSupabase } from '../supabaseClient.js';

/**
 * Whether the signed-in player may type in steps: the global switch AND their own switch
 * (no own row = off).
 * @returns {Promise<boolean|null>} null when it could not be checked
 */
export async function fetchManualEntryAllowed(userId) {
  try {
    const sb = getSupabase();
    const [global, own] = await Promise.all([
      sb.from('app_settings').select('manual_entry').limit(1).maybeSingle(),
      sb.from('user_settings').select('manual_entry').eq('user_id', userId).maybeSingle(),
    ]);
    if (global.error || own.error) return null;
    return global.data?.manual_entry === true && own.data?.manual_entry === true;
  } catch {
    return null;
  }
}
