// Opening another player's profile from anywhere (avatar or name).
// The player's id is kept in memory only, never in the URL (CLAUDE.md §2.6): the route is just
// "#/user". After a reload there is no player in memory, so that screen falls back to the
// user's own profile. Who may be viewed is decided by RLS, not by this module.

import { getState } from '../state/store.js';
import { h } from './dom.js';

let viewedId = null;

export function viewedUserId() {
  return viewedId;
}

/** Opens a player's profile; the signed-in user's own id opens their own Profile tab. */
export function openProfile(userId) {
  const me = getState().auth ? getState().auth.userId : null;
  if (!userId || userId === me) {
    location.hash = '#/profile';
    return;
  }
  viewedId = userId;
  if (location.hash === '#/user') window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = '#/user';
}

export function clearViewedUser() {
  viewedId = null;
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
