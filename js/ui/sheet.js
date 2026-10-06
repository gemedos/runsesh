// Bottom sheet (inspo "on two runners collision choose profile pop up"): dimmed backdrop,
// rounded sheet with a grab handle. Closes on the backdrop, Escape, or a route change.

import { h } from './dom.js';

/**
 * @param {string} label accessible name of the dialog
 * @param {Node} content
 * @returns {() => void} close
 */
export function openSheet(label, content) {
  const previous = document.activeElement;
  const sheet = h('div', { class: 'sheet', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': label, tabindex: '-1' } },
    h('span', { class: 'sheet-grip', attrs: { 'aria-hidden': 'true' } }),
    content,
  );
  const backdrop = h('div', { class: 'sheet-backdrop' }, sheet);

  function close() {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', close);
    if (previous && previous.isConnected) previous.focus({ preventScroll: true });
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', close);
  document.body.append(backdrop);
  sheet.focus({ preventScroll: true });
  return close;
}
