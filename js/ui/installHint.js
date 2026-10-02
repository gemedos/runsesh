// "Add to Home Screen" hint for iPhone/iPad users who opened the app in Safari.

import { STRINGS } from '../strings.js';
import { h, s } from './dom.js';

const DISMISS_KEY = 'runsesh.iosHintDismissed';
const T = STRINGS.installHint;

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
    h('p', {}, T.before, shareIcon(), h('b', { text: T.share }), T.middle, h('b', { text: T.addToHome }), T.after),
  );
  box.append(h('button', {
    class: 'install-hint-close',
    text: '×',
    attrs: { type: 'button', 'aria-label': T.dismiss },
    on: {
      click: () => {
        try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
        box.remove();
      },
    },
  }));
  return box;
}
