// App entry: splash, auth bootstrap, hash router with route guard, rendering,
// service worker + update prompt.

import { initAuth } from './auth/session.js';
import { safeNext } from './auth/rules.js';
import { isConfigured } from './config.js';
import { SupabaseStepsProvider } from './data/supabaseStepsProvider.js';
import { createStepsProvider } from './data/stepsProvider.js';
import { isNativeApp } from './platform.js';
import { getState, subscribe } from './state/store.js';
import { STRINGS } from './strings.js';
import { h, runMountHooks } from './ui/dom.js';
import { renderAccount, renderLogin } from './ui/pages/account.js';
import { renderForgotScreen, renderLoginScreen, renderNotConfigured, renderResetScreen, renderSignupScreen } from './ui/pages/auth.js';
import { renderAvatarEditor } from './ui/pages/avatarEditor.js';
import { renderCompetition } from './ui/pages/competition.js';
import { renderCompetitionHub } from './ui/pages/competitionHub.js';
import { renderHealth } from './ui/pages/health.js';
import { renderIphone } from './ui/pages/iphone.js';
import { renderCreateParty, renderMembers, renderRules } from './ui/pages/placeholders.js';
import { renderProfile } from './ui/pages/profile.js';
import { renderRace } from './ui/pages/race.js';
import { applyTheme } from './ui/theme.js';

const SPLASH_MS = 1500;
const IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

// Hash routes only (GitHub Pages has no server-side routing; no History API is used).
// This is the allowlist: any other hash is replaced with the default route.
// `public: true` routes are the only ones shown to logged-out users.
const ROUTES = Object.freeze({
  login: { render: renderLoginScreen, public: true, guestOnly: true },
  signup: { render: renderSignupScreen, public: true, guestOnly: true },
  forgot: { render: renderForgotScreen, public: true, guestOnly: true },
  reset: { render: renderResetScreen, public: true },
  race: { tab: 'race', render: renderRace },
  'race/create-party': { tab: 'race', render: renderCreateParty },
  competition: { tab: 'competition', render: renderCompetitionHub },
  profile: { tab: 'profile', render: renderProfile },
  'profile/avatar': { tab: 'profile', render: renderAvatarEditor, ownsState: true },
  'profile/members': { tab: 'profile', render: renderMembers },
  'profile/rules': { tab: 'profile', render: renderRules },
  'profile/competition': { tab: 'profile', render: renderCompetition },
  'profile/login': { tab: 'profile', render: renderLogin },
  'profile/account': { tab: 'profile', render: renderAccount },
  'profile/health': { tab: 'profile', render: renderHealth },
  'profile/iphone': { tab: 'profile', render: renderIphone },
});
const DEFAULT_ROUTE = 'race';

const view = document.getElementById('view');
const bannerRoot = document.getElementById('banner-root');
// The signed-in user's own steps come from Supabase; other party members stay MOCK (Phase 3).
const steps = new SupabaseStepsProvider(() => (getState().auth ? getState().auth.userId : null), createStepsProvider());
let renderSeq = 0;
let lastRendered = null;
let pendingNext = null; // where to go after logging in (validated against an allowlist)

function isRoute(name) {
  return Object.prototype.hasOwnProperty.call(ROUTES, name);
}

/** Route name from the hash, e.g. '#/profile/avatar' -> 'profile/avatar'; null if not allowed. */
function routeFromHash() {
  const name = location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
  return isRoute(name) ? name : null;
}

function navigate(name) {
  if (isRoute(name)) location.hash = `#/${name}`;
}

function toast(message) {
  const el = h('div', { class: 'toast', attrs: { role: 'status' }, text: message });
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

/**
 * Route guard. This is for usability only: it decides which screens to show.
 * The real protection is Row Level Security in the database, which refuses every
 * request that is not from the signed-in owner of the data.
 * @returns {string|null} a route to redirect to, or null to render `name`
 */
function guard(name) {
  const signedIn = Boolean(getState().auth);
  const route = ROUTES[name];
  if (!signedIn && !route.public) {
    pendingNext = safeNext(name);
    return 'login';
  }
  if (signedIn && route.guestOnly) return DEFAULT_ROUTE;
  return null;
}

async function render({ scrollTop = false } = {}) {
  if (!isConfigured()) {
    document.body.classList.add('is-guest');
    view.replaceChildren(renderNotConfigured());
    return;
  }
  const name = routeFromHash();
  if (!name) {
    // Unknown or empty hash: normalise without adding a history entry (triggers hashchange).
    location.replace(`#/${getState().auth ? DEFAULT_ROUTE : 'login'}`);
    return;
  }
  const redirect = guard(name);
  if (redirect) {
    location.replace(`#/${redirect}`);
    return;
  }

  const seq = ++renderSeq;
  const route = ROUTES[name];
  document.body.classList.toggle('is-guest', Boolean(route.public));
  for (const tab of document.querySelectorAll('.tab')) {
    const active = tab.dataset.tab === route.tab;
    tab.classList.toggle('tab--active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }

  let node;
  try {
    const next = name === 'login' ? pendingNext : null;
    node = await route.render({ state: getState(), steps, navigate, toast, next });
  } catch (err) {
    if (IS_DEV) console.error('render failed', err && err.name);
    node = h('div', { class: 'page' }, h('p', { class: 'empty', text: STRINGS.app.genericError }));
  }
  if (seq !== renderSeq) return; // a newer render started meanwhile
  if (name !== 'login') pendingNext = null;

  // Animate in only on screen changes, not on in-place updates of the same screen.
  if (name !== lastRendered) node.classList.add('is-entering');
  lastRendered = name;
  view.replaceChildren(node);
  runMountHooks();
  if (scrollTop) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => render({ scrollTop: true }));
subscribe(() => {
  const name = routeFromHash();
  // The avatar editor keeps its own draft; don't wipe it on unrelated updates.
  if (!name || !ROUTES[name].ownsState) render();
});

// --- Static shell text (from the strings module) ----------------------------

function applyShellStrings() {
  document.querySelector('.topbar-logo').alt = STRINGS.app.logoAlt;
  document.querySelector('.tabbar').setAttribute('aria-label', STRINGS.app.navLabel);
  for (const [tab, label] of [['race', STRINGS.app.tabRace], ['competition', STRINGS.app.tabCompetition], ['profile', STRINGS.app.tabProfile]]) {
    const el = document.querySelector(`.tab[data-tab="${tab}"]`);
    el.setAttribute('aria-label', label);
    el.querySelector('.tab-label').textContent = label;
  }
}

// --- Splash -----------------------------------------------------------------

function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('splash--hide');
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  setTimeout(() => splash.remove(), 800); // in case transitions are disabled
}

// --- Service worker ---------------------------------------------------------

function showUpdateBanner(worker) {
  if (bannerRoot.querySelector('.update-banner')) return;
  const banner = h('div', { class: 'update-banner', attrs: { role: 'status' } },
    h('span', { text: STRINGS.app.updateAvailable }),
    h('button', {
      class: 'btn btn-small',
      text: STRINGS.app.updateReload,
      attrs: { type: 'button' },
      on: { click: () => worker.postMessage({ type: 'SKIP_WAITING' }) },
    }),
  );
  bannerRoot.append(banner);
}

function registerServiceWorker() {
  if (isNativeApp()) return; // the Android app bundles its files; no service worker there
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && !IS_DEV) return; // HTTPS only (localhost allowed for development)

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        // Only prompt when replacing an existing version, not on first install.
        if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(worker);
      });
    });
  }).catch(() => {
    if (IS_DEV) console.error('Service worker registration failed');
  });
}

// --- Boot -------------------------------------------------------------------

async function boot() {
  // Email links that landed on the main page (e.g. the redirect fell back to the Site URL)
  // belong to the callback page, which validates them: token_hash, a PKCE code, or an
  // error (in the query or in a non-route hash such as #error=…).
  const query = new URLSearchParams(location.search);
  const hash = location.hash.startsWith('#/') ? new URLSearchParams() : new URLSearchParams(location.hash.replace(/^#/, ''));
  const linkKeys = ['token_hash', 'code', 'error', 'error_code'];
  if (linkKeys.some((key) => query.has(key) || hash.has(key))) {
    location.replace(`auth-callback.html${location.search}${location.hash}`);
    return;
  }
  applyTheme();
  applyShellStrings();
  setTimeout(hideSplash, SPLASH_MS);
  if (isConfigured()) {
    try {
      await initAuth(() => render());
    } catch {
      if (IS_DEV) console.error('auth init failed');
    }
  }
  render();
  registerServiceWorker();
}

boot();
