// Friends tab on the user's own profile (docs/design.md §11): search by @usertag (suggestions
// show ONLY usertags), pending invites (accept / decline / cancel), friends (remove).
// All changes go through the friend functions in the database (rate limited there).

import {
  cancelFriendInvite, fetchFriendRequests, fetchFriends, removeFriend, respondFriendInvite, searchUsertags, sendFriendInvite,
} from '../data/friendsRepo.js';
import { STRINGS } from '../strings.js';
import { avatarBadge } from './components.js';
import { h } from './dom.js';
import { openProfileByHandle, personButton } from './profileLink.js';

const T = STRINGS.friends;

/** Toast text for a friend-function status. */
export function inviteMessage(status) {
  return T.status[status] || T.status.failed;
}

const btn = (text, cls, onClick) => h('button', { class: `btn btn-small ${cls}`, text, attrs: { type: 'button' }, on: { click: onClick } });

async function busy(button, fn) {
  button.disabled = true;
  try { await fn(); } finally { if (button.isConnected) button.disabled = false; }
}

export function friendsPanel({ toast }) {
  const results = h('ul', { class: 'fr-list', attrs: { 'aria-live': 'polite' } });
  const requests = h('div', { class: 'fr-section' });
  const friends = h('div', { class: 'fr-section' });

  // --- search ------------------------------------------------------------------------
  const input = h('input', {
    attrs: { id: 'fr-search', type: 'search', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', maxlength: 21, placeholder: T.searchPlaceholder, enterkeyhint: 'search' },
  });
  let timer = 0;
  let seq = 0;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(runSearch, 350);
  });

  async function runSearch() {
    const q = input.value.trim().replace(/^@/, '').toLowerCase();
    const mine = ++seq;
    if (q.length < 2) { results.replaceChildren(); return; }
    if (!/^[a-z0-9._]+$/.test(q)) { results.replaceChildren(h('li', { class: 'hint', text: T.searchChars })); return; }
    const res = await searchUsertags(q);
    if (mine !== seq || !results.isConnected) return;
    if (res.status === 'rate_limited') { results.replaceChildren(h('li', { class: 'hint', text: T.searchLimited })); return; }
    if (res.status !== 'ok') { results.replaceChildren(h('li', { class: 'hint', text: T.failed })); return; }
    if (!res.handles.length) { results.replaceChildren(h('li', { class: 'hint', text: T.noMatches })); return; }
    results.replaceChildren(...res.handles.map((handle) => {
      const invite = btn(T.invite, 'btn-primary', () => busy(invite, async () => {
        const status = await sendFriendInvite(handle);
        toast(inviteMessage(status));
        if (['sent', 'accepted', 'already_sent', 'already_friends'].includes(status)) { invite.remove(); loadLists(); }
      }));
      return h('li', { class: 'fr-row' },
        h('button', { class: 'fr-handle person-link', text: `@${handle}`, attrs: { type: 'button', 'aria-label': T.openUsertag(handle) }, on: { click: () => openProfileByHandle(handle) } }),
        invite,
      );
    }));
  }

  // --- invites and friends -------------------------------------------------------------
  async function loadLists() {
    const [reqs, list] = await Promise.all([fetchFriendRequests(), fetchFriends({ refresh: true })]);

    if (!reqs) requests.replaceChildren(h('p', { class: 'hint', text: T.failed }));
    else {
      const incoming = reqs.filter((r) => r.direction === 'in');
      const outgoing = reqs.filter((r) => r.direction === 'out');
      requests.replaceChildren(
        h('h3', { class: 'cal-sub-title', text: T.invitesTitle }),
        incoming.length || outgoing.length ? h('ul', { class: 'fr-list' },
          incoming.map((r) => {
            const accept = btn(T.accept, 'btn-primary', () => busy(accept, async () => { toast(inviteMessage(await respondFriendInvite(r.handle, true))); loadLists(); }));
            const decline = btn(T.decline, 'btn-secondary', () => busy(decline, async () => { toast(inviteMessage(await respondFriendInvite(r.handle, false))); loadLists(); }));
            return h('li', { class: 'fr-row' },
              h('span', { class: 'fr-main' }, h('span', { class: 'fr-handle', text: `@${r.handle}` }), h('span', { class: 'rank-sub', text: T.wantsToBeFriends })),
              accept, decline);
          }),
          outgoing.map((r) => {
            const cancel = btn(T.cancel, 'btn-secondary', () => busy(cancel, async () => { toast(inviteMessage(await cancelFriendInvite(r.handle))); loadLists(); }));
            return h('li', { class: 'fr-row' },
              h('span', { class: 'fr-main' }, h('span', { class: 'fr-handle', text: `@${r.handle}` }), h('span', { class: 'rank-sub', text: T.inviteSent })),
              cancel);
          }),
        ) : h('p', { class: 'hint', text: T.noInvites }),
      );
    }

    if (!list) friends.replaceChildren(h('p', { class: 'hint', text: T.failed }));
    else {
      friends.replaceChildren(
        h('h3', { class: 'cal-sub-title', text: T.friendsTitle(list.length) }),
        list.length ? h('ul', { class: 'fr-list' }, list.map((f) => {
          const name = f.name || `@${f.handle}`;
          const remove = btn(T.remove, 'btn-danger', () => busy(remove, async () => {
            if (!window.confirm(T.removeConfirm(name))) return;
            toast(inviteMessage(await removeFriend(f.handle)));
            loadLists();
          }));
          return h('li', { class: 'fr-row' },
            personButton(f.id, STRINGS.profile.openProfile(name), [
              avatarBadge(f.avatar, { size: 'md' }),
              h('span', { class: 'fr-main' }, h('span', { class: 'rank-name', text: name }), h('span', { class: 'rank-sub', text: `@${f.handle}` })),
            ], 'fr-person'),
            remove);
        })) : h('p', { class: 'hint', text: T.noFriends }),
      );
    }
  }

  loadLists();
  return h('div', { class: 'fr' },
    h('div', { class: 'field' },
      h('label', { attrs: { for: 'fr-search' }, text: T.searchLabel }),
      h('div', { class: 'handle-input' }, h('span', { class: 'handle-at', attrs: { 'aria-hidden': 'true' }, text: '@' }), input),
      h('p', { class: 'hint', text: T.searchHint }),
    ),
    results,
    requests,
    friends,
  );
}
