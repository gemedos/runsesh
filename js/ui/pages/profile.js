// Page 3: Profile (docs/design.md §11, inspo "profile structure").
// Header: scenic strip, @usertag, gear → Settings tab, big avatar, name, "Joined <month>",
// Edit profile + wardrobe, "Connect your phone" call-out.
// Icon tabs: Calendar (own steps day by day) · Memories · Friends · Settings.
// Another player's profile ("#/user", kept in memory) is read-only: Calendar and Memories, for
// friends and party members (RLS decides). Anyone else sees only the @usertag, a lock and
// "Send friend invite".

import { fetchFriendRequests, fetchFriends, fetchStepsForUsers, sendFriendInvite } from '../../data/friendsRepo.js';
import { listIngestTokens } from '../../data/ingestTokenRepo.js';
import { fetchMemberProfile } from '../../data/profileRepo.js';
import { rankDay } from '../../rules/ranking.js';
import { getPartyMembers } from '../../state/store.js';
import { STRINGS } from '../../strings.js';
import { formatDate, todayISO, toISODate } from '../../util/date.js';
import { avatarBadge, formatSteps, rankedAvatar } from '../components.js';
import { h, s } from '../dom.js';
import { friendsPanel, inviteMessage } from '../friendsPanel.js';
import { memoriesPanel } from '../memories.js';
import { isIos } from '../installHint.js';
import { personButton, viewedUser } from '../profileLink.js';
import { DAILY_GOAL, stepsCalendar } from '../stepsCalendar.js';
import { getTheme, setTheme, THEMES } from '../theme.js';

const T = STRINGS.profile;
const C = STRINGS.profileCalendar;
let ownTab = 'calendar'; // remembered while the app is open

// --- icons ---------------------------------------------------------------------------
const icon = (...children) => s('svg', { class: 'ptab-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ...children);
const ICONS = {
  calendar: () => icon(s('rect', { x: 3.5, y: 5, width: 17, height: 15.5, rx: 2.5, fill: 'currentColor', stroke: 'none' }), s('path', { d: 'M8 3 V7 M16 3 V7', 'stroke-width': 2.4 }), s('path', { d: 'M3.5 10 H20.5', stroke: 'var(--bg)', 'stroke-width': 1.6 })),
  memories: () => icon(s('rect', { x: 3.5, y: 4.5, width: 17, height: 15, rx: 2.5 }), s('circle', { cx: 9, cy: 10, r: 1.8, fill: 'currentColor', stroke: 'none' }), s('path', { d: 'M5 18 L10.5 13 L14 16 L16.5 13.5 L19.5 17' })),
  friends: () => icon(s('circle', { cx: 9, cy: 8.5, r: 3.3 }), s('path', { d: 'M3 19.5 C3.5 15.5 6 13.8 9 13.8 C12 13.8 14.5 15.5 15 19.5' }), s('path', { d: 'M15.5 5.6 A3 3 0 1 1 16.4 11.6 M17.6 14.2 C19.6 15 20.8 16.8 21 19.5' })),
  settings: () => icon(s('path', { d: 'M9 6.5 H20 M9 12 H20 M9 17.5 H20' }), s('circle', { cx: 4.8, cy: 6.5, r: 1.3, fill: 'currentColor', stroke: 'none' }), s('circle', { cx: 4.8, cy: 12, r: 1.3, fill: 'currentColor', stroke: 'none' }), s('circle', { cx: 4.8, cy: 17.5, r: 1.3, fill: 'currentColor', stroke: 'none' })),
};

function gearIcon() {
  return s('svg', { class: 'ph-round-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'currentColor' },
    s('path', { d: 'M10.3 2.5 H13.7 L14.2 5 A7.3 7.3 0 0 1 16.1 6.1 L18.5 5.3 L20.2 8.2 L18.3 9.9 A7.3 7.3 0 0 1 18.3 12.1 L20.2 13.8 L18.5 16.7 L16.1 15.9 A7.3 7.3 0 0 1 14.2 17 L13.7 19.5 H10.3 L9.8 17 A7.3 7.3 0 0 1 7.9 15.9 L5.5 16.7 L3.8 13.8 L5.7 12.1 A7.3 7.3 0 0 1 5.7 9.9 L3.8 8.2 L5.5 5.3 L7.9 6.1 A7.3 7.3 0 0 1 9.8 5 Z M12 8 A3 3 0 1 0 12 14 A3 3 0 1 0 12 8 Z', 'fill-rule': 'evenodd', transform: 'translate(0 1)' }),
  );
}

function hangerIcon() {
  return s('svg', { class: 'btn-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    s('path', { d: 'M12 8 C12 6.5 13 6 13.5 5.5 A2 2 0 1 0 10.2 4.2' }),
    s('path', { d: 'M12 8 L3 15.5 C2.3 16.1 2.7 17 3.6 17 H20.4 C21.3 17 21.7 16.1 21 15.5 Z' }),
  );
}

function phoneIcon() {
  return s('svg', { class: 'callout-svg', viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    s('rect', { x: 7, y: 2.5, width: 10, height: 19, rx: 2.5 }), s('path', { d: 'M11 18.5 H13' }));
}

// --- settings (the previous Profile lists) --------------------------------------------
function navItem(label, route) {
  return h('li', {}, h('a', { class: 'list-link', attrs: { href: `#/${route}` } }, h('span', { text: label }), h('span', { class: 'chevron', text: '›' })));
}

function group(title, items, open = false) {
  return h('details', { class: 'group', attrs: { open } },
    h('summary', { class: 'group-title', text: title }),
    h('ul', { class: 'list' }, items),
  );
}

function themeSwitch() {
  const input = h('input', { class: 'switch-input', attrs: { type: 'checkbox', id: 'theme-dark', checked: getTheme() === THEMES.DARK } });
  input.addEventListener('change', () => setTheme(input.checked ? THEMES.DARK : THEMES.LIGHT));
  return h('li', {}, h('label', { class: 'list-link switch-line', attrs: { for: 'theme-dark' } },
    h('span', { text: T.darkTheme }),
    input,
    h('span', { class: 'switch-track', attrs: { 'aria-hidden': 'true' } }),
  ));
}

function settingsPanel() {
  return h('div', { class: 'profile-lists' },
    group(T.groupParty, [
      h('li', {}, h('details', { class: 'subgroup' },
        h('summary', { class: 'list-link', text: T.partySettings }),
        h('ul', { class: 'list list--nested' }, navItem(T.manageMembers, 'profile/members'), navItem(T.partyRules, 'profile/rules')),
      )),
      navItem(T.competition, 'profile/competition'),
    ], true),
    group(T.groupSettings, [
      themeSwitch(),
      navItem(T.login, 'profile/login'),
      navItem(T.account, 'profile/account'),
      navItem(T.health, 'profile/health'),
      isIos() ? navItem(STRINGS.iphone.title, 'profile/iphone') : null,
    ], true),
  );
}

/**
 * Day summary under the calendar: steps and % of the goal; on the user's own profile also the
 * ranking of you vs all your friends that day (their totals are readable: RLS, friends).
 */
async function daySummary({ day, steps, today, person, isMe }) {
  const pct = Math.round((steps / DAILY_GOAL) * 100);
  let ranking = null;
  if (isMe) {
    const friends = (await fetchFriends()) || [];
    const byUser = friends.length ? await fetchStepsForUsers(friends.map((f) => f.id), day, day) : new Map();
    const people = [{ id: person.id, name: C.you, avatar: person.avatar, isMe: true }, ...friends.map((f) => ({ id: f.id, name: f.name || `@${f.handle}`, avatar: f.avatar, isMe: false }))];
    const stepsById = { [person.id]: steps };
    for (const f of friends) stepsById[f.id] = (byUser && byUser.get(f.id) && byUser.get(f.id).get(day)) || 0;
    const byId = new Map(people.map((p) => [p.id, p]));
    ranking = h('div', { class: 'sc-sum-rank' },
      h('h4', { class: 'cal-sub-title', text: C.vsFriends }),
      h('ol', { class: 'ranking' }, rankDay(stepsById, people.map((p) => p.id)).map((r) => {
        const p = byId.get(r.id);
        const avatar = rankedAvatar(p.avatar, r.rank);
        const nameEl = h('span', { class: 'rank-name', text: p.name });
        return h('li', { class: `rank-row${p.isMe ? ' rank-row--me' : ''}` },
          p.isMe ? avatar : personButton(p.id, T.openProfile(p.name), avatar),
          p.isMe ? h('span', { class: 'rank-main' }, nameEl) : personButton(p.id, T.openProfile(p.name), nameEl, 'rank-main'),
          h('span', { class: 'rank-score', text: STRINGS.common.steps(formatSteps(r.value)) }),
        );
      })),
      friends.length ? null : h('p', { class: 'hint', text: C.noFriendsYet }),
    );
  }
  return h('div', { class: 'sc-sum' },
    h('p', { class: 'sc-sum-date', text: formatDate(day) }),
    h('p', { class: 'sc-sum-steps' }, h('b', { text: formatSteps(steps) }), ' ', C.steps),
    h('p', { class: 'sc-sum-goal', text: C.goalLine(pct, formatSteps(DAILY_GOAL)) }),
    day === today ? h('p', { class: 'hint', text: C.todayRunning }) : null,
    ranking,
  );
}

/** Calendar stickers: the user's place among them + their friends on each day they walked. */
async function ranksAmongFriends(userId, days) {
  const friends = (await fetchFriends()) || [];
  if (!friends.length || !days.length) return new Map();
  const ids = [userId, ...friends.map((f) => f.id)];
  const byUser = await fetchStepsForUsers(ids, days[0], days[days.length - 1]);
  if (!byUser) return new Map();
  const out = new Map();
  for (const day of days) {
    const stepsById = Object.fromEntries(ids.map((id) => [id, byUser.get(id).get(day) || 0]));
    if (!stepsById[userId]) continue;
    const mine = rankDay(stepsById, ids).find((r) => r.id === userId);
    if (mine) out.set(day, mine.rank);
  }
  return out;
}

/** "Send friend invite" / "Friends" control on another player's profile. */
function friendAction(handle, isFriend, toast) {
  if (!handle) return null;
  if (isFriend) return h('span', { class: 'tag tag--friend', text: T.friendsTag });
  const button = h('button', { class: 'btn btn-primary ph-edit', text: T.sendInvite, attrs: { type: 'button' } });
  button.addEventListener('click', async () => {
    button.disabled = true;
    const status = await sendFriendInvite(handle);
    toast(inviteMessage(status));
    if (['sent', 'already_sent'].includes(status)) button.textContent = T.inviteSentButton;
    else if (['accepted', 'already_friends'].includes(status)) button.replaceWith(h('span', { class: 'tag tag--friend', text: T.friendsTag }));
    else button.disabled = false;
  });
  return button;
}

// --- page --------------------------------------------------------------------------------
function profilePage({ person, isMe, toast, friendControl = null }) {
  const today = todayISO();
  const joinedDay = person.joinedAt ? toISODate(new Date(person.joinedAt)) : null;
  const tabs = isMe ? ['calendar', 'memories', 'friends', 'settings'] : ['calendar', 'memories'];
  let active = isMe && tabs.includes(ownTab) ? ownTab : 'calendar';

  const panel = h('div', { class: 'ptab-panel', attrs: { role: 'tabpanel', id: 'ptab-panel' } });
  const tabButtons = tabs.map((id) => h('button', {
    class: 'ptab', attrs: { type: 'button', role: 'tab', 'aria-controls': 'ptab-panel', 'aria-label': T.tabs[id], title: T.tabs[id] },
    dataset: { tab: id },
    on: { click: () => show(id) },
  }, ICONS[id]()));

  function show(id) {
    active = id;
    if (isMe) ownTab = id;
    for (const b of tabButtons) {
      const on = b.dataset.tab === id;
      b.classList.toggle('ptab--active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    }
    if (id === 'calendar') {
      panel.replaceChildren(stepsCalendar({
        userId: person.id,
        joinedDay,
        today,
        renderSummary: (day, daySteps) => daySummary({ day, steps: daySteps, today, person, isMe }),
        ranksFor: isMe ? (days) => ranksAmongFriends(person.id, days) : undefined,
      }));
    } else if (id === 'memories') {
      panel.replaceChildren(memoriesPanel({
        owner: { id: person.id, name: isMe ? C.you : person.displayName || T.noName, handle: person.handle, avatar: person.avatar, isMe },
        toast,
      }));
    } else if (id === 'friends') {
      panel.replaceChildren(friendsPanel({ toast }));
    } else {
      panel.replaceChildren(settingsPanel());
    }
  }

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  const tabBar = h('div', { class: 'ptabs', attrs: { role: 'tablist', 'aria-label': T.tabsLabel } }, tabButtons);
  tabBar.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.indexOf(active) + (e.key === 'ArrowRight' ? 1 : -1);
    const next = tabs[(i + tabs.length) % tabs.length];
    show(next);
    tabButtons[tabs.indexOf(next)].focus();
  });

  const callout = h('div', { class: 'ph-callout-slot' });
  if (isMe) {
    listIngestTokens().then((tokens) => {
      if (!tokens || tokens.length || !callout.isConnected) return;
      callout.replaceChildren(h('a', { class: 'callout callout--link', attrs: { href: '#/profile/health' } },
        h('span', { class: 'callout-icon' }, phoneIcon()),
        h('span', { class: 'callout-text' },
          h('strong', { class: 'callout-title', text: T.connectTitle }),
          h('span', { class: 'callout-sub', text: T.connectSub }),
        ),
        h('span', { class: 'callout-chevron', attrs: { 'aria-hidden': 'true' }, text: '›' }),
      ));
    });
  }

  const name = person.displayName || T.noName;
  const header = h('div', { class: 'profile-identity' },
    hero(person.handle, isMe ? () => show('settings') : null),
    h('div', { class: 'ph-head' },
      isMe
        ? h('a', { class: 'ph-avatar', attrs: { href: '#/profile/avatar', 'aria-label': T.customize } }, avatarBadge(person.avatar, { size: 'xl' }))
        : h('span', { class: 'ph-avatar' }, avatarBadge(person.avatar, { size: 'xl', label: T.avatarOf(name) })),
      h('h1', { class: 'profile-name', text: name }),
      person.joinedAt ? h('p', { class: 'profile-sub', text: T.joined(new Date(person.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })) }) : null,
      isMe ? h('div', { class: 'ph-buttons' },
        h('a', { class: 'btn btn-pill ph-edit', attrs: { href: '#/profile/account' }, text: T.editProfile }),
        h('a', { class: 'ph-round ph-round--outline', attrs: { href: '#/profile/avatar', 'aria-label': T.customizeButton, title: T.customizeButton } }, hangerIcon()),
      ) : null,
      friendControl ? h('div', { class: 'ph-buttons' }, friendControl) : null,
      callout,
    ),
  );

  show(active);
  return h('div', { class: 'page page-profile' },
    header,
    h('div', { class: 'profile-content' }, tabBar, panel),
  );
}

/** Scenic header strip: back button (others), @usertag, gear (own). */
function hero(handle, onSettings) {
  return h('div', { class: 'ph-hero scene' },
    onSettings ? null : h('button', { class: 'ph-round ph-back', text: '‹', attrs: { type: 'button', 'aria-label': STRINGS.app.back }, on: { click: () => history.back() } }),
    handle ? h('span', { class: `ph-handle${onSettings ? '' : ' ph-handle--shifted'}`, text: `@${handle}` }) : null,
    onSettings ? h('div', { class: 'ph-actions' },
      h('button', { class: 'ph-round', attrs: { type: 'button', 'aria-label': T.openSettings, title: T.openSettings }, on: { click: onSettings } }, gearIcon()),
    ) : null,
  );
}

/**
 * Locked profile: a player who is neither a friend nor in the user's party. Shows ONLY the
 * @usertag, a lock, and "Send friend invite" (decided 2026-10-06).
 */
async function lockedProfile(handle, toast) {
  const requests = await fetchFriendRequests();
  const pending = requests && requests.find((r) => r.handle === handle);
  let action;
  if (pending && pending.direction === 'out') {
    action = h('button', { class: 'btn btn-secondary', text: T.inviteSentButton, attrs: { type: 'button', disabled: true } });
  } else {
    action = friendAction(handle, false, toast);
    if (pending && pending.direction === 'in') action.textContent = T.acceptInvite;
  }
  return h('div', { class: 'page page-profile' },
    h('div', { class: 'profile-identity' },
      hero(handle, null),
      h('div', { class: 'ph-head' },
        h('span', { class: 'ph-avatar ph-avatar--locked', attrs: { 'aria-hidden': 'true' } }, lockGlyph()),
        h('h1', { class: 'profile-name', text: `@${handle}` }),
      ),
    ),
    h('div', { class: 'profile-content' },
      h('div', { class: 'ptab-empty' },
        h('span', { class: 'ptab-empty-icon' }, lockGlyph()),
        h('p', { class: 'ptab-empty-title', text: T.lockedTitle }),
        h('p', { class: 'hint', text: T.lockedText }),
        action,
      ),
    ),
  );
}

function lockGlyph() {
  return s('svg', { class: 'ptab-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    s('rect', { x: 5, y: 10.5, width: 14, height: 10, rx: 3 }), s('path', { d: 'M8.5 10.5 V8 A3.5 3.5 0 0 1 15.5 8 V10.5' }));
}

export function renderProfile({ state, toast }) {
  const p = state.profile || {};
  return profilePage({
    person: { id: state.auth.userId, displayName: p.displayName, avatar: state.avatar, joinedAt: p.joinedAt || null, handle: p.handle || null },
    isMe: true,
    toast,
  });
}

/** Another player's profile: full (read-only) for friends and party members, locked otherwise. */
export async function renderUserProfile({ state, toast }) {
  const target = viewedUser();
  const me = state.auth.userId;
  const ownHandle = state.profile && state.profile.handle;
  if (!target || target.id === me || (target.handle && target.handle === ownHandle)) {
    location.replace('#/profile');
    return h('div', { class: 'page' });
  }

  const friends = (await fetchFriends()) || [];
  const members = getPartyMembers(state);
  const known = target.id
    ? friends.find((f) => f.id === target.id) || members.find((m) => m.id === target.id)
    : friends.find((f) => f.handle === target.handle) || members.find((m) => m.handle === target.handle);
  const id = target.id || (known && known.id);
  const profile = id ? await fetchMemberProfile(id) : null; // RLS: friends and party members only

  if (!profile) {
    const handle = target.handle || (known && known.handle);
    if (handle) return lockedProfile(handle, toast);
    return h('div', { class: 'page page-profile' },
      h('div', { class: 'ptab-empty' },
        h('span', { class: 'ptab-empty-icon' }, lockGlyph()),
        h('p', { class: 'ptab-empty-title', text: T.privateTitle }),
        h('p', { class: 'hint', text: T.privateText }),
        h('button', { class: 'btn btn-pill', attrs: { type: 'button' }, text: STRINGS.app.back, on: { click: () => history.back() } }),
      ));
  }

  const isFriend = friends.some((f) => f.id === id);
  return profilePage({
    person: { id, displayName: profile.displayName, avatar: profile.avatar, joinedAt: profile.joinedAt, handle: profile.handle },
    isMe: false,
    toast,
    friendControl: friendAction(profile.handle, isFriend, toast),
  });
}
