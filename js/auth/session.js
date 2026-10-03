// Authentication through the Supabase SDK only (CLAUDE.md §2.1, §3).
// No custom password, token or session handling: the SDK stores the session in its
// default storage and refreshes it. This module never copies, logs or displays tokens.

import { fetchOwnProfile, updateOwnProfile } from '../data/profileRepo.js';
import { isNativeApp } from '../platform.js';
import { resetState, setProfile, setSignedIn } from '../state/store.js';
import { getSupabase } from '../supabaseClient.js';
import { SITE_URL } from '../config.js';
import { browserTimezone, cleanDisplayName } from './rules.js';

const IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const devWarn = (what, error) => {
  // Development only, and only the error code: never emails, tokens or step data.
  if (IS_DEV) console.warn(`[auth] ${what} failed`, error && (error.code || error.status || 'error'));
};

let currentUserId = null;
let signingOut = false;

/** URL of the static page that handles email links (allowlisted in the dashboard). */
function callbackUrl() {
  // Inside the Android app the page origin is local, so email links must point at the website.
  return isNativeApp() ? new URL('auth-callback.html', SITE_URL).href : new URL('auth-callback.html', document.baseURI).href;
}

/**
 * Restores an existing session and listens for changes.
 * @param {() => void} onChange called after sign-in / sign-out has been applied
 */
export async function initAuth(onChange) {
  const sb = getSupabase();
  sb.auth.onAuthStateChange((event, session) => {
    // Never await Supabase calls inside this callback (SDK guidance); defer instead.
    setTimeout(() => handleAuthEvent(event, session, onChange), 0);
  });
  const { data } = await sb.auth.getSession();
  if (data && data.session) await applySignedIn(data.session.user);
}

async function handleAuthEvent(event, session, onChange) {
  if (event === 'SIGNED_OUT') {
    await wipeLocalData();
    return; // wipeLocalData reloads the page
  }
  if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session && session.user) {
    await applySignedIn(session.user);
    onChange();
  }
}

async function applySignedIn(user) {
  if (!user) return;
  const sameUser = currentUserId === user.id;
  currentUserId = user.id;
  let profile = null;
  try {
    profile = await fetchOwnProfile(user.id);
  } catch (err) {
    devWarn('load profile', err);
  }
  setSignedIn(user, profile);
  if (!sameUser) await syncTimezone(profile);
}

/** Keeps profiles.timezone in step with the device (validated against a simple pattern). */
async function syncTimezone(profile) {
  const tz = browserTimezone();
  if (!profile || profile.timezone === tz) return;
  try {
    const updated = await updateOwnProfile(profile.id, { timezone: tz });
    if (updated) setProfile(updated);
  } catch (err) {
    devWarn('update timezone', err);
  }
}

// ---------------------------------------------------------------------------
// Actions. All return { ok: boolean } and never reveal whether an email exists.
// ---------------------------------------------------------------------------

export async function signUp({ email, password, displayName }) {
  try {
    const { error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: callbackUrl(),
        data: { display_name: cleanDisplayName(displayName) || '', timezone: browserTimezone() },
      },
    });
    if (error) devWarn('sign up', error);
    // With email confirmation on, Supabase answers an already-registered email exactly like
    // a new one (no error), so this result never reveals whether an account exists.
    return { ok: !error };
  } catch (err) {
    devWarn('sign up', err);
    return { ok: false };
  }
}

export async function signIn({ email, password }) {
  try {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      devWarn('sign in', error);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    devWarn('sign in', err);
    return { ok: false };
  }
}

export async function requestPasswordReset(email) {
  try {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: callbackUrl() });
    if (error) devWarn('reset request', error);
  } catch (err) {
    devWarn('reset request', err);
  }
  // Always the same answer: "If an account exists, we've sent an email".
  return { ok: true };
}

/** Sets a new password for the signed-in user (also used after a reset link). */
export async function changePassword(password) {
  try {
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) {
      devWarn('change password', error);
      return { ok: false };
    }
    // CLAUDE.md §3: after a password change, sign out other sessions.
    await getSupabase().auth.signOut({ scope: 'others' });
    return { ok: true };
  } catch (err) {
    devWarn('change password', err);
    return { ok: false };
  }
}

/** @param {'local'|'global'} scope 'global' = log out of all devices */
export async function signOut(scope = 'local') {
  try {
    await getSupabase().auth.signOut({ scope: scope === 'global' ? 'global' : 'local' });
  } catch (err) {
    devWarn('sign out', err);
  }
  // SIGNED_OUT normally triggers the wipe; do it here too in case the event did not fire.
  await wipeLocalData();
}

/**
 * CLAUDE.md §6 "On logout": clear caches, IndexedDB and local app data, reset the service
 * worker and in-memory state, so the next person on this device sees nothing.
 * The SDK removes its own session entry during signOut.
 */
export async function wipeLocalData() {
  if (signingOut) return;
  signingOut = true;
  currentUserId = null;
  resetState();
  try {
    if ('caches' in window) {
      for (const key of await caches.keys()) await caches.delete(key);
    }
  } catch { /* ignore */ }
  try {
    if (window.indexedDB && typeof indexedDB.databases === 'function') {
      for (const db of await indexedDB.databases()) if (db.name) indexedDB.deleteDatabase(db.name);
    }
  } catch { /* ignore */ }
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('runsesh.')) localStorage.removeItem(key);
    sessionStorage.clear();
  } catch { /* ignore */ }
  try {
    if ('serviceWorker' in navigator) {
      for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
    }
  } catch { /* ignore */ }
  location.replace('#/login');
  location.reload();
}
