// "Add to Home Screen" hint for iPhone/iPad users who opened the app in Safari.

import { h, s } from './dom.js';

const DISMISS_KEY = 'runsesh.iosHintDismissed';

export function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function isDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function shareIcon() {
  return s('svg', { class: 'share-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    s('path', { d: 'M8 10 H6 V21 H18 V10 H16' }),
    s('path', { d: 'M12 3 V14' }),
    s('path', { d: 'M8.5 6.5 L12 3 L15.5 6.5' }),
  );
}

/** Returns the hint element, or null when it should not be shown. */
export function iosInstallHint() {
  if (!isIos() || isStandalone() || isDismissed()) return null;
  const box = h('div', { class: 'install-hint', attrs: { role: 'note' } },
    h('p', {},
      'Install runsesh: tap ', shareIcon(), h('b', { text: 'Share' }), ', then ', h('b', { text: 'Add to Home Screen' }), '.',
    ),
  );
  box.append(h('button', {
    class: 'install-hint-close',
    text: '×',
    attrs: { type: 'button', 'aria-label': 'Dismiss' },
    on: {
      click: () => {
        try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
        box.remove();
      },
    },
  }));
  return box;
}
