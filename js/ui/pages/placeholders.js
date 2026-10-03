// Placeholder screens: they show the intended layout with mock data.
// Nothing here talks to a backend. Disabled controls are intentional.

import { STEP_SCORING } from '../../rules/ranking.js';
import { getPartyMembers, setStepScoring } from '../../state/store.js';
import { STRINGS } from '../../strings.js';
import { avatarBadge, card, notConnectedBanner, screenHeader } from '../components.js';
import { h } from '../dom.js';

const disabledButton = (label, cls = 'btn btn-secondary') => h('button', { class: cls, text: label, attrs: { type: 'button', disabled: true } });

export function renderCreateParty() {
  const T = STRINGS.createParty;
  return h('div', { class: 'page' },
    screenHeader(T.title, 'race'),
    notConnectedBanner(T.notConnected),
    card(T.cardTitle,
      h('div', { class: 'field' },
        h('label', { attrs: { for: 'party-name' }, text: T.name }),
        h('input', { attrs: { id: 'party-name', type: 'text', disabled: true, placeholder: T.namePlaceholder } }),
      ),
      h('div', { class: 'field' },
        h('label', { attrs: { for: 'party-invite' }, text: T.invite }),
        h('input', { attrs: { id: 'party-invite', type: 'email', disabled: true, placeholder: T.invitePlaceholder } }),
      ),
      disabledButton(T.submit, 'btn btn-primary'),
    ),
  );
}

export function renderMembers({ state }) {
  const T = STRINGS.members;
  const members = getPartyMembers(state);
  return h('div', { class: 'page' },
    screenHeader(T.title),
    notConnectedBanner(),
    card(state.party.name,
      h('ul', { class: 'list' },
        members.map((m) => h('li', { class: 'member-row' },
          avatarBadge(m.avatar, { size: 'sm' }),
          h('span', { class: 'rank-name', text: m.isMe ? T.admin(m.name) : m.name }),
          m.isMe ? null : disabledButton(T.remove, 'btn btn-small'),
        )),
      ),
      disabledButton(T.invite, 'btn btn-primary'),
    ),
  );
}

export function renderRules({ state, toast }) {
  const T = STRINGS.rules;
  const rules = state.partyRules;
  const rows = [
    [T.dayResets, rules.dayResetsAt],
    [T.joining, rules.inviteOnly ? T.inviteOnly : T.open],
  ];

  const scoring = h('fieldset', { class: 'field radio-group' },
    h('legend', { text: T.scoringTitle }),
    Object.values(STEP_SCORING).map((value) => {
      const input = h('input', { attrs: { type: 'radio', name: 'step-scoring', value, checked: rules.stepScoring === value } });
      input.addEventListener('change', () => {
        if (input.checked && setStepScoring(value)) toast(T.scoringSaved);
      });
      return h('label', { class: 'radio' }, input, h('span', { text: T.scoring[value] }));
    }),
    h('p', { class: 'hint', text: T.scoringHint }),
  );

  return h('div', { class: 'page' },
    screenHeader(T.title),
    notConnectedBanner(),
    card(T.scoringTitle, scoring),
    card(T.cardTitle,
      h('dl', { class: 'kv' }, rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })])),
      disabledButton(T.edit),
    ),
  );
}
