// auth-callback.html: handles links from Supabase emails (sign-up confirmation, password reset).
// The email templates link here with a one-time `token_hash` and a `type`
// (see docs/security-tests.md → dashboard setup). Works even when the email is opened on a
// different device or browser than the one that started the request.
//
// Fallback: with Supabase's DEFAULT email templates the link arrives as `?code=…` (PKCE).
// That code can only be exchanged in the browser that started the request, because the SDK
// keeps the one-time code verifier there (see docs/security-notes.md).
// Error links (`?error=…` or `#error=…`, e.g. expired) are treated as invalid.
// Nothing from the URL or the session is ever logged.

import { isConfigured } from './config.js';
import { STRINGS } from './strings.js';
import { getSupabase } from './supabaseClient.js';

const T = STRINGS.callback;
const ALLOWED_TYPES = ['signup', 'email', 'recovery'];
const TOKEN_RE = /^[A-Za-z0-9_-]{8,256}$/;
const CODE_RE = /^[A-Za-z0-9-]{8,128}$/; // PKCE auth codes are UUIDs
const FLOW_ID_RE = /^[A-Za-z0-9_-]{8,64}$/; // same rule the SDK applies to `sb_flow_id`
const ERROR_KEYS = ['error', 'error_code', 'error_description'];

const message = document.getElementById('callback-message');
const action = document.getElementById('callback-action');

function show(text, href) {
  message.textContent = text;
  if (href) {
    action.textContent = T.openApp;
    action.setAttribute('href', href);
    action.hidden = false;
  }
}

/**
 * Default-template fallback (`?code=…`). Verified against vendor/supabase.js 2.117.2:
 * on success `data.redirectType` is 'recovery' for a password reset (null otherwise).
 * The flow id, if the link carried one, is passed explicitly because the URL has already
 * been cleared; without it the SDK uses its standard verifier slot.
 */
async function exchangeCode(code, flowId) {
  if (!isConfigured() || !CODE_RE.test(code)) {
    show(T.invalid, 'index.html#/login');
    return;
  }
  message.textContent = T.working;
  try {
    const options = FLOW_ID_RE.test(flowId || '') ? { flowId } : undefined;
    const { data, error } = await getSupabase().auth.exchangeCodeForSession(code, options);
    if (!error && data && data.redirectType === 'recovery') {
      location.replace('index.html#/reset');
      return;
    }
    // A sign-up email is confirmed by Supabase before it redirects here, so a failed exchange
    // (for example, link opened in another browser) still means "confirmed, now log in".
    show(error ? T.confirmedElsewhere : T.confirmed, 'index.html#/login');
  } catch {
    show(T.confirmedElsewhere, 'index.html#/login');
  }
}

async function run() {
  const params = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  const code = params.get('code');
  const flowId = params.get('sb_flow_id');
  const linkError = ERROR_KEYS.some((key) => params.has(key) || hashParams.has(key));
  // Remove the one-time token from the address bar and history right away
  // (CLAUDE.md: no tokens left in URLs). Relative URL, so it works under any base path.
  history.replaceState(null, '', 'auth-callback.html');

  if (!tokenHash) {
    if (linkError) {
      show(T.invalid, 'index.html#/login');
      return;
    }
    if (code) {
      await exchangeCode(code, flowId);
      return;
    }
  }

  if (!isConfigured() || !TOKEN_RE.test(tokenHash || '') || !ALLOWED_TYPES.includes(type)) {
    show(T.invalid, 'index.html#/login');
    return;
  }
  message.textContent = T.working;
  try {
    const { error } = await getSupabase().auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      show(T.invalid, 'index.html#/login');
      return;
    }
  } catch {
    show(T.invalid, 'index.html#/login');
    return;
  }
  if (type === 'recovery') {
    // Signed in by the reset link: go straight to "Set a new password".
    location.replace('index.html#/reset');
    return;
  }
  show(T.confirmed, 'index.html#/login');
}

run();
