// Service worker: caches ONLY the static app shell. No user data, no API responses.
// Bump CACHE_VERSION whenever any file in APP_SHELL changes.

const CACHE_VERSION = 'v17';
const CACHE_NAME = `runsesh-shell-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './fonts/Fredoka-Variable.ttf',
  './icons/logo.svg',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './img/ground.svg',
  './img/hills.svg',
  './img/stars.svg',
  './img/trees.svg',
  './img/circus.svg',
  './img/comp-fall.svg',
  './img/comp-spring.svg',
  './img/comp-summer.svg',
  './img/comp-winter.svg',
  './privacy.html',
  './css/doc.css',
  './vendor/supabase.js',
  './js/app.js',
  './js/auth/rules.js',
  './js/auth/session.js',
  './js/avatar/avatar.js',
  './js/avatar/parts.js',
  './js/config.js',
  './js/data/competitionData.js',
  './js/data/competitionRepo.js',
  './js/data/ingestTokenRepo.js',
  './js/data/partyRepo.js',
  './js/data/profileRepo.js',
  './js/data/settingsRepo.js',
  './js/data/stepsProvider.js',
  './js/data/supabaseStepsProvider.js',
  './js/integrations/androidApp.js',
  './js/platform.js',
  './js/rules/ranking.js',
  './js/state/competition.js',
  './js/state/invite.js',
  './js/state/store.js',
  './js/steps/manualSource.js',
  './js/steps/stepsSource.js',
  './js/steps/sync.js',
  './js/strings.js',
  './js/supabaseClient.js',
  './js/ui/competitionBlock.js',
  './js/ui/competitionCalendar.js',
  './js/ui/components.js',
  './js/ui/dom.js',
  './js/ui/ingestTokens.js',
  './js/ui/installHint.js',
  './js/ui/pages/account.js',
  './js/ui/pages/auth.js',
  './js/ui/pages/avatarEditor.js',
  './js/ui/pages/competition.js',
  './js/ui/pages/competitionHub.js',
  './js/ui/pages/health.js',
  './js/ui/pages/iphone.js',
  './js/ui/pages/party.js',
  './js/ui/pages/profile.js',
  './js/ui/pages/race.js',
  './js/ui/theme.js',
  './js/util/date.js',
  './js/util/image.js',
];

const SHELL_URLS = new Set(APP_SHELL.map((path) => new URL(path, self.registration.scope).href));

self.addEventListener('install', (event) => {
  // No skipWaiting here: the page shows an "update available" prompt instead.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // cross-origin: browser default, never cached

  // Cache-first for shell files, so HTML, JS and CSS always come from the same version.
  url.search = '';
  url.hash = '';
  if (!SHELL_URLS.has(url.href)) return; // not part of the shell: network only

  event.respondWith(caches.match(url.href).then((cached) => cached || fetch(request)));
});
