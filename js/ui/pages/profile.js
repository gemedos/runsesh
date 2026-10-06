// Page 3: Profile (docs/design.md §11, inspo "profile structure").
// Header: scenic strip, @usertag (when usertags exist), gear → Settings tab, big avatar, name,
// "Joined <month>", Edit profile + wardrobe, "Connect your phone" call-out.
// Icon tabs: Calendar (own steps day by day) · Memories · Friends · Settings.
// Another player's profile ("#/user", id kept in memory) is read-only: Calendar and Memories.
// Who can be viewed is decided by RLS: today, party members.

import { listIngestTokens } from '../../data/ingestTokenRepo.js';
import { fetchMemberProfile } from '../../data/profileRepo.js';
import { getPartyMembers } from '../../state/store.js';
import { STRINGS } from '../../strings.js';
import { formatDate, todayISO, toISODate } from '../../util/date.js';
import { avatarBadge, formatSteps, rankedAvatar } from '../components.js';
import { h, s } from '../dom.js';
import { isIos } from '../installHint.js';
import { viewedUserId } from '../profileLink.js';
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

// --- other tab bodies --------------------------------------------------------------------
function comingSoon(iconName, title, text) {
  return h('div', { class: 'ptab-empty' },
    h('span', { class: 'ptab-empty-icon' }, ICONS[iconName]()),
    h('p', { class: 'ptab-empty-title', text: title }),
    h('p', { class: 'hint', text }),
  );
}

/** Day summary under the calendar: steps, % of the goal, and (own) you vs your friends. */
function daySummary({ day, steps, today, person, isMe }) {
  const pct = Math.round((steps / DAILY_GOAL) * 100);
  return h('div', { class: 'sc-sum' },
    h('p', { class: 'sc-sum-date', text: formatDate(day) }),
    h('p', { class: 'sc-sum-steps' }, h('b', { text: formatSteps(steps) }), ' ', C.steps),
    h('p', { class: 'sc-sum-goal', text: C.goalLine(pct, formatSteps(DAILY_GOAL)) }),
    day === today ? h('p', { class: 'hint', text: C.todayRunning }) : null,
    isMe ? h('div', { class: 'sc-sum-rank' },
      h('h4', { class: 'cal-sub-title', text: C.vsFriends }),
      h('ol', { class: 'ranking' }, h('li', { class: 'rank-row rank-row--me' },
        rankedAvatar(person.avatar, 1),
        h('span', { class: 'rank-main' }, h('span', { class: 'rank-name', text: C.you })),
        h('span', { class: 'rank-score', text: STRINGS.common.steps(formatSteps(steps)) }),
      )),
      h('p', { class: 'hint', text: C.friendsSoon }),
    ) : null,
  );
}

// --- page --------------------------------------------------------------------------------
function profilePage({ person, isMe }) {
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
      }));
    } else if (id === 'memories') {
      panel.replaceChildren(comingSoon('memories', T.memoriesTitle, isMe ? T.memoriesSoon : T.memoriesSoonOther));
    } else if (id === 'friends') {
      panel.replaceChildren(comingSoon('friends', T.friendsTitle, T.friendsSoon));
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
    h('div', { class: 'ph-hero scene' },
      isMe ? null : h('button', { class: 'ph-round ph-back', text: '‹', attrs: { type: 'button', 'aria-label': STRINGS.app.back }, on: { click: () => history.back() } }),
      person.handle ? h('span', { class: 'ph-handle', text: `@${person.handle}` }) : null,
      isMe ? h('div', { class: 'ph-actions' },
        h('button', { class: 'ph-round', attrs: { type: 'button', 'aria-label': T.openSettings, title: T.openSettings }, on: { click: () => show('settings') } }, gearIcon()),
      ) : null,
    ),
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
      callout,
    ),
  );

  show(active);
  return h('div', { class: 'page page-profile' },
    header,
    h('div', { class: 'profile-content' }, tabBar, panel),
  );
}

export function renderProfile({ state }) {
  const p = state.profile || {};
  return profilePage({
    person: { id: state.auth.userId, displayName: p.displayName, avatar: state.avatar, joinedAt: p.joinedAt || null, handle: null },
    isMe: true,
  });
}

/** Another player's profile (read-only). Only party members can be opened for now. */
export async function renderUserProfile({ state }) {
  const id = viewedUserId();
  if (!id || id === state.auth.userId) {
    location.replace('#/profile');
    return h('div', { class: 'page' });
  }
  const member = getPartyMembers(state).find((m) => m.id === id);
  const profile = member ? await fetchMemberProfile(id) : null;
  if (!profile) {
    return h('div', { class: 'page page-profile' },
      h('div', { class: 'ptab-empty' },
        h('span', { class: 'ptab-empty-icon' }, ICONS.friends()),
        h('p', { class: 'ptab-empty-title', text: T.privateTitle }),
        h('p', { class: 'hint', text: T.privateText }),
        h('button', { class: 'btn btn-pill', attrs: { type: 'button' }, text: STRINGS.app.back, on: { click: () => history.back() } }),
      ));
  }
  return profilePage({
    person: { id, displayName: profile.displayName || member.name, avatar: profile.avatar || member.avatar, joinedAt: profile.joinedAt, handle: null },
    isMe: false,
  });
}
