// Placeholder screens: they show the intended layout with mock data.
// Nothing here talks to a backend. Disabled controls are intentional.

import { MOCK_PARTY_RULES } from '../../data/mockData.js';
import { getPartyMembers } from '../../state/store.js';
import { avatarBadge, card, notConnectedBanner, screenHeader } from '../components.js';
import { h } from '../dom.js';

const disabledButton = (label, cls = 'btn btn-secondary') => h('button', { class: cls, text: label, attrs: { type: 'button', disabled: true } });

export function renderCreateParty() {
  return h('div', { class: 'page' },
    screenHeader('Create a party', 'race'),
    notConnectedBanner('Parties and invites arrive in a later phase.'),
    card('New party',
      h('div', { class: 'field' },
        h('label', { attrs: { for: 'party-name' }, text: 'Party name' }),
        h('input', { attrs: { id: 'party-name', type: 'text', disabled: true, placeholder: 'e.g. Lunch Break Runners' } }),
      ),
      h('div', { class: 'field' },
        h('label', { attrs: { for: 'party-invite' }, text: 'Invite by email' }),
        h('input', { attrs: { id: 'party-invite', type: 'email', disabled: true, placeholder: 'friend@example.com' } }),
      ),
      disabledButton('Create party', 'btn btn-primary'),
    ),
  );
}

export function renderMembers({ state }) {
  const members = getPartyMembers(state);
  return h('div', { class: 'page' },
    screenHeader('Manage members'),
    notConnectedBanner(),
    card(state.party.name,
      h('ul', { class: 'list' },
        members.map((m) => h('li', { class: 'member-row' },
          avatarBadge(m.avatar, { size: 'sm' }),
          h('span', { class: 'rank-name', text: m.isMe ? `${m.name} (admin)` : m.name }),
          m.isMe ? null : disabledButton('Remove', 'btn btn-small'),
        )),
      ),
      disabledButton('Invite members', 'btn btn-primary'),
    ),
  );
}

export function renderRules() {
  const rows = [
    ['Daily goal', `${MOCK_PARTY_RULES.dailyGoal.toLocaleString()} steps`],
    ['Day resets at', MOCK_PARTY_RULES.dayResetsAt],
    ['Step sources', MOCK_PARTY_RULES.stepSources],
    ['Joining', MOCK_PARTY_RULES.inviteOnly ? 'Invite only' : 'Open'],
  ];
  return h('div', { class: 'page' },
    screenHeader('Party rules'),
    notConnectedBanner(),
    card('Rules',
      h('dl', { class: 'kv' }, rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })])),
      disabledButton('Edit rules'),
    ),
  );
}

export function renderLogin() {
  return h('div', { class: 'page' },
    screenHeader('Login / Log out'),
    notConnectedBanner('Sign-in will be handled by the auth provider in Phase 2.'),
    card('Sign in',
      h('div', { class: 'field' },
        h('label', { attrs: { for: 'login-email' }, text: 'Email' }),
        h('input', { attrs: { id: 'login-email', type: 'email', autocomplete: 'username', disabled: true } }),
      ),
      disabledButton('Continue', 'btn btn-primary'),
      disabledButton('Sign in with a passkey'),
    ),
    card('Signed in',
      disabledButton('Log out'),
      disabledButton('Log out of all devices'),
    ),
  );
}

export function renderAccount({ state }) {
  return h('div', { class: 'page' },
    screenHeader('Account'),
    notConnectedBanner(),
    card('Your account',
      h('dl', { class: 'kv' },
        h('dt', { text: 'Name' }), h('dd', { text: state.account.name }),
        h('dt', { text: 'Email' }), h('dd', { text: state.account.email }),
      ),
      disabledButton('Change password'),
    ),
    card('Danger zone', disabledButton('Delete account and data', 'btn btn-danger')),
  );
}

export function renderHealth() {
  const source = (name, desc) => h('li', { class: 'health-row' },
    h('span', { class: 'health-text' }, h('b', { text: name }), h('span', { class: 'hint', text: desc })),
    h('label', { class: 'switch' },
      h('input', { class: 'switch-input', attrs: { type: 'checkbox', disabled: true, 'aria-label': `Connect ${name}` } }),
      h('span', { class: 'switch-track', attrs: { 'aria-hidden': 'true' } }),
    ),
  );
  return h('div', { class: 'page' },
    screenHeader('Health connect'),
    notConnectedBanner('Real step data arrives in Phase 4. The app currently uses mock steps.'),
    card('Step sources',
      h('ul', { class: 'list' },
        source('Apple Health', 'iPhone and Apple Watch steps'),
        source('Health Connect', 'Android steps'),
      ),
      h('p', { class: 'hint', text: 'Only daily step totals will be shared with your party.' }),
    ),
  );
}
