// App entry: splash, hash router, rendering, service worker + update prompt.

import { createStepsProvider } from './data/stepsProvider.js';
import { getState, subscribe } from './state/store.js';
import { STRINGS } from './strings.js';
import { h, runMountHooks } from './ui/dom.js';
import { renderAvatarEditor } from './ui/pages/avatarEditor.js';
import { renderCompetition } from './ui/pages/competition.js';
import { renderAccount, renderCreateParty, renderHealth, renderLogin, renderMembers, renderRules } from './ui/pages/placeholders.js';
import { renderProfile } from './ui/pages/profile.js';
import { renderRace } from './ui/pages/race.js';
import { applyTheme } from './ui/theme.js';

const SPLASH_MS = 1500;
const IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

// Hash routes only (GitHub Pages has no server-side routing; no History API is used).
// This is the allowlist: any other hash is replaced with #/race.
const ROUTES = Object.freeze({
  race: { tab: 'race', render: renderRace },
  'race/create-party': { tab: 'race', render: renderCreateParty },
  profile: { tab: 'profile', render: renderProfile },
  'profile/avatar': { tab: 'profile', render: renderAvatarEditor, ownsState: true },
  'profile/members': { tab: 'profile', render: renderMembers },
  'profile/rules': { tab: 'profile', render: renderRules },
  'profile/competition': { tab: 'profile', render: renderCompetition },
  'profile/login': { tab: 'profile', render: renderLogin },
  'profile/account': { tab: 'profile', render: renderAccount },
  'profile/health': { tab: 'profile', render: renderHealth },
});
const DEFAULT_ROUTE = 'race';

const view = document.getElementById('view');
const bannerRoot = document.getElementById('banner-root');
const steps = createStepsProvider();
let renderSeq = 0;

function isRoute(name) {
  return Object.prototype.hasOwnProperty.call(ROUTES, name);
}

/** Route name from the hash, e.g. '#/profile/avatar' -> 'profile/avatar'; null if not allowed. */
function routeFromHash() {
  const name = location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
  return isRoute(name) ? name : null;
}

function currentRoute() {
  return routeFromHash() || DEFAULT_ROUTE;
}

function navigate(name) {
  if (isRoute(name)) location.hash = `#/${name}`;
}

function toast(message) {
  const el = h('div', { class: 'toast', attrs: { role: 'status' }, text: message });
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

async function render({ scrollTop = false } = {}) {
  if (!routeFromHash()) {
    // Unknown or empty hash: normalise without adding a history entry (triggers hashchange).
    location.replace(`#/${DEFAULT_ROUTE}`);
    return;
  }
  const seq = ++renderSeq;
  const name = currentRoute();
  const route = ROUTES[name];

  for (const tab of document.querySelectorAll('.tab')) {
    const active = tab.dataset.tab === route.tab;
    tab.classList.toggle('tab--active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }

  let node;
  try {
    node = await route.render({ state: getState(), steps, navigate, toast });
  } catch (err) {
    if (IS_DEV) console.error(err);
    node = h('div', { class: 'page' }, h('p', { class: 'empty', text: STRINGS.app.genericError }));
  }
  if (seq !== renderSeq) return; // a newer render started meanwhile

  view.replaceChildren(node);
  runMountHooks();
  if (scrollTop) window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => render({ scrollTop: true }));
subscribe(() => {
  // The avatar editor keeps its own draft; don't wipe it on unrelated updates.
  if (!ROUTES[currentRoute()].ownsState) render();
});

// --- Static shell text (from the strings module) ----------------------------

function applyShellStrings() {
  document.querySelector('.topbar-logo').alt = STRINGS.app.logoAlt;
  document.querySelector('.tabbar').setAttribute('aria-label', STRINGS.app.navLabel);
  document.querySelector('.tab[data-tab="race"]').setAttribute('aria-label', STRINGS.app.tabRace);
  document.querySelector('.tab[data-tab="profile"]').setAttribute('aria-label', STRINGS.app.tabProfile);
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
  }).catch((err) => {
    if (IS_DEV) console.error('Service worker registration failed', err);
  });
}

// --- Boot -------------------------------------------------------------------

applyTheme();
applyShellStrings();
render();
setTimeout(hideSplash, SPLASH_MS);
registerServiceWorker();
