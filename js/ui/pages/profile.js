// Page 2: Profile.

import { buildAvatarSvg } from '../../avatar/avatar.js';
import { h } from '../dom.js';

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
    h('a', { class: 'profile-hero', attrs: { href: '#/avatar', 'aria-label': 'Customize your avatar' } },
      buildAvatarSvg(state.avatar, { label: 'Your avatar' }),
      h('span', { class: 'profile-hero-hint', text: 'Tap to customize' }),
    ),
    h('p', { class: 'profile-name', text: state.account.name }),

    group('PARTY', [
      h('li', {}, h('details', { class: 'subgroup' },
        h('summary', { class: 'list-link', text: 'Party settings' }),
        h('ul', { class: 'list list--nested' }, navItem('Manage members', 'members'), navItem('Party rules', 'rules')),
      )),
      navItem('Competition', 'competition'),
    ], true),

    group('SETTINGS', [
      navItem('Login / Log out', 'login'),
      navItem('Account', 'account'),
      navItem('Health connect', 'health'),
    ]),
  );
}
