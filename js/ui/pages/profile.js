// Page 2: Profile.

import { buildAvatarSvg } from '../../avatar/avatar.js';
import { STRINGS } from '../../strings.js';
import { h } from '../dom.js';

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

export function renderProfile({ state }) {
  return h('div', { class: 'page page-profile' },
    h('a', { class: 'profile-hero', attrs: { href: '#/profile/avatar', 'aria-label': T.customize } },
      buildAvatarSvg(state.avatar, { label: T.yourAvatar }),
      h('span', { class: 'profile-hero-hint', text: T.tapToCustomize }),
    ),
    h('p', { class: 'profile-name', text: state.account.name }),

    group(T.groupParty, [
      h('li', {}, h('details', { class: 'subgroup' },
        h('summary', { class: 'list-link', text: T.partySettings }),
        h('ul', { class: 'list list--nested' }, navItem(T.manageMembers, 'profile/members'), navItem(T.partyRules, 'profile/rules')),
      )),
      navItem(T.competition, 'profile/competition'),
    ], true),

    group(T.groupSettings, [
      navItem(T.login, 'profile/login'),
      navItem(T.account, 'profile/account'),
      navItem(T.health, 'profile/health'),
    ]),
  );
}
