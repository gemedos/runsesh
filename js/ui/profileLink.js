// Opening another player's profile from anywhere (avatar, name, or a usertag from search).
// Who is being viewed is kept in memory only, never in the URL (CLAUDE.md §2.6): the route is
// just "#/user". After a reload nobody is in memory, so that screen falls back to the user's own
// profile. What may be shown is decided by RLS and the friend functions, not by this module.

import { getState, subscribe } from '../state/store.js';
import { h } from './dom.js';

let viewed = null; // { id } or { handle }
subscribe((s) => { if (!s.auth) viewed = null; }); // forget it on sign-out

/** @returns {{id?: string, handle?: string}|null} */
export function viewedUser() {
  return viewed;
}

function go() {
  if (location.hash === '#/user') window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = '#/user';
}

/** Opens a player's profile; the signed-in user's own id opens their own Profile tab. */
export function openProfile(userId) {
  const me = getState().auth ? getState().auth.userId : null;
  if (!userId || userId === me) {
    location.hash = '#/profile';
    return;
  }
  viewed = { id: userId };
  go();
}

/** Opens a profile from a usertag (search results), where the id is not known. */
export function openProfileByHandle(handle) {
  viewed = { handle };
  go();
}

export function clearViewedUser() {
  viewed = null;
}

/**
 * Wraps an avatar and/or name so tapping it opens that player's profile.
 * @param {string} userId
 * @param {string} label accessible name, e.g. "Open Maria's profile"
 * @param {string} [extraClass] classes that keep the wrapped element's layout (e.g. 'rank-main')
 */
export function personButton(userId, label, children, extraClass = '') {
  return h('button', {
    class: `person-link${extraClass ? ` ${extraClass}` : ''}`,
    attrs: { type: 'button', 'aria-label': label },
    on: { click: (e) => { e.stopPropagation(); openProfile(userId); } },
  }, children);
}
