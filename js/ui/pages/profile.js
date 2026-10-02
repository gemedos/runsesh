// Page 2: Profile.
// Layout (see docs/design.md): identity block (night banner, big avatar, name, customize pill)
// → sheet lists (PARTY, SETTINGS). Two columns on desktop.

import { buildAvatarSvg } from '../../avatar/avatar.js';
import { STRINGS } from '../../strings.js';
import { avatarBadge } from '../components.js';
import { h, s } from '../dom.js';
import { getTheme, setTheme, THEMES } from '../theme.js';

const T = STRINGS.profile;

function navItem(label, route) {
  return h('li', {}, h('a', { class: 'list-link', attrs: { href: `#/${route}` } }, h('span', { text: label }), h('span', { class: 'chevron', text: '›' })));
}

function group(title, items, open = false) {
  return h('details', { class: 'group', attrs: { open } },
    h('summary', { class: 'group-title', text: title }),
    h('ul', { class: 'list' }, items),
  );
}

function hangerIcon() {
  return s('svg', { class: 'btn-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    s('path', { d: 'M12 8 C12 6.5 13 6 13.5 5.5 A2 2 0 1 0 10.2 4.2' }),
    s('path', { d: 'M12 8 L3 15.5 C2.3 16.1 2.7 17 3.6 17 H20.4 C21.3 17 21.7 16.1 21 15.5 Z' }),
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

export function renderProfile({ state }) {
  return h('div', { class: 'page page-profile' },
    h('div', { class: 'profile-identity' },
      h('a', { class: 'profile-banner scene', attrs: { href: '#/profile/avatar', 'aria-label': T.customize } },
        h('span', { class: 'stomp' }, buildAvatarSvg(state.avatar, { label: T.yourAvatar })),
      ),
      h('div', { class: 'profile-head' },
        avatarBadge(state.avatar, { size: 'xl' }),
        h('p', { class: 'profile-name', text: state.account.name }),
        h('p', { class: 'profile-sub', text: state.party.name }),
        h('a', { class: 'btn btn-pill', attrs: { href: '#/profile/avatar' } }, hangerIcon(), h('span', { text: T.customizeButton })),
      ),
    ),

    h('div', { class: 'profile-lists' },
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
      ], true),
    ),
  );
}
