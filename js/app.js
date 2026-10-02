// App entry: splash, hash router, rendering, service worker + update prompt.

import { createStepsProvider } from './data/stepsProvider.js';
import { getState, subscribe } from './state/store.js';
import { h, runMountHooks } from './ui/dom.js';
import { renderAvatarEditor } from './ui/pages/avatarEditor.js';
import { renderCompetition } from './ui/pages/competition.js';
import { renderAccount, renderCreateParty, renderHealth, renderLogin, renderMembers, renderRules } from './ui/pages/placeholders.js';
import { renderProfile } from './ui/pages/profile.js';
import { renderRace } from './ui/pages/race.js';

const SPLASH_MS = 1500;
const IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

// Route allowlist. Anything else in the URL hash falls back to "race".
const ROUTES = Object.freeze({
  race: { tab: 'race', render: renderRace },
  'party-create': { tab: 'race', render: renderCreateParty },
  profile: { tab: 'profile', render: renderProfile },
  avatar: { tab: 'profile', render: renderAvatarEditor, ownsState: true },
  members: { tab: 'profile', render: renderMembers },
  rules: { tab: 'profile', render: renderRules },
  competition: { tab: 'profile', render: renderCompetition },
  login: { tab: 'profile', render: renderLogin },
  account: { tab: 'profile', render: renderAccount },
  health: { tab: 'profile', render: renderHealth },
});

const view = document.getElementById('view');
const bannerRoot = document.getElementById('banner-root');
const steps = createStepsProvider();
let renderSeq = 0;

function currentRoute() {
  const name = location.hash.replace(/^#\/?/, '');
  return Object.prototype.hasOwnProperty.call(ROUTES, name) ? name : 'race';
}

function navigate(name) {
  if (!Object.prototype.hasOwnProperty.call(ROUTES, name)) return;
  location.hash = `#/${name}`;
}

function toast(message) {
  const el = h('div', { class: 'toast', attrs: { role: 'status' }, text: message });
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

async function render({ scrollTop = false } = {}) {
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
    node = h('div', { class: 'page' }, h('p', { class: 'empty', text: 'Something went wrong. Please try again.' }));
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
    h('span', { text: 'An update is available.' }),
    h('button', {
      class: 'btn btn-small',
      text: 'Reload',
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

render();
setTimeout(hideSplash, SPLASH_MS);
registerServiceWorker();
