// Competition screen (circus style) with the "Create a competition" form.
// Phase 1: the form only updates local mock state.

import { loadStandings } from '../../data/competitionData.js';
import { RANKING_MODE_LABELS, RANKING_MODES } from '../../rules/ranking.js';
import { COMPETITION_NAME_MAX } from '../../state/competition.js';
import { createCompetition, getActiveCompetition, getPartyMembers, setActiveCompetition } from '../../state/store.js';
import { todayISO } from '../../util/date.js';
import { circusHeader, competitionMeta, standingsList } from '../competitionBlock.js';
import { card, notConnectedBanner, screenHeader } from '../components.js';
import { h } from '../dom.js';

export async function renderCompetition({ state, steps, toast }) {
  const today = todayISO();
  const members = getPartyMembers(state);
  const active = getActiveCompetition(state);
  const standings = active ? await loadStandings(active, members, steps, today) : [];

  return h('div', { class: 'page page-competition' },
    screenHeader('Competition', 'profile'),
    notConnectedBanner('Competitions are stored on this device only, with mock steps.'),
    h('section', { class: 'card card--circus' },
      circusHeader(),
      active ? competitionMeta(active, today) : h('p', { class: 'empty', text: 'No competition yet.' }),
      active ? standingsList(active, standings, members) : null,
    ),
    competitionPicker(state),
    createForm(today, toast),
  );
}

function competitionPicker(state) {
  if (state.competitions.length < 2) return null;
  const select = h('select', { attrs: { id: 'active-comp' } },
    state.competitions.map((c) => h('option', {
      text: c.mock ? `${c.name} (mock)` : c.name,
      attrs: { value: c.id, selected: c.id === state.activeCompetitionId },
    })),
  );
  select.addEventListener('change', () => setActiveCompetition(select.value));
  return card('Show competition', h('label', { class: 'sr-only', attrs: { for: 'active-comp' }, text: 'Competition' }), select);
}

function field(label, id, input, errorEl, hint) {
  return h('div', { class: 'field' },
    h('label', { attrs: { for: id }, text: label }),
    input,
    hint ? h('p', { class: 'hint', text: hint }) : null,
    errorEl,
  );
}

function createForm(today, toast) {
  const errors = {
    name: h('p', { class: 'field-error', attrs: { 'aria-live': 'polite' } }),
    start: h('p', { class: 'field-error', attrs: { 'aria-live': 'polite' } }),
    end: h('p', { class: 'field-error', attrs: { 'aria-live': 'polite' } }),
    mode: h('p', { class: 'field-error', attrs: { 'aria-live': 'polite' } }),
    form: h('p', { class: 'field-error', attrs: { 'aria-live': 'polite' } }),
  };

  const name = h('input', { attrs: { id: 'comp-name', type: 'text', maxlength: COMPETITION_NAME_MAX, autocomplete: 'off', placeholder: 'e.g. Autumn Sprint' } });
  const start = h('input', { attrs: { id: 'comp-start', type: 'date', required: true, value: today } });
  const end = h('input', { attrs: { id: 'comp-end', type: 'date' } });
  const golden = h('input', { class: 'switch-input', attrs: { id: 'comp-golden', type: 'checkbox' } });

  const modes = h('fieldset', { class: 'field radio-group' },
    h('legend', { text: 'Ranking mode' }),
    Object.values(RANKING_MODES).map((mode, i) => h('label', { class: 'radio' },
      h('input', { attrs: { type: 'radio', name: 'comp-mode', value: mode, checked: i === 0 } }),
      h('span', { text: RANKING_MODE_LABELS[mode] }),
    )),
    errors.mode,
  );

  const form = h('form', { class: 'card form', attrs: { novalidate: true } },
    h('h2', { class: 'card-title', text: 'Create a competition' }),
    field('Name (optional)', 'comp-name', name, errors.name),
    field('Start date', 'comp-start', start, errors.start),
    field('End date (optional)', 'comp-end', end, errors.end, 'Leave empty for an open-ended competition.'),
    modes,
    h('div', { class: 'field switch-row' },
      h('label', { class: 'switch', attrs: { for: 'comp-golden' } },
        golden,
        h('span', { class: 'switch-track', attrs: { 'aria-hidden': 'true' } }),
        h('span', { text: 'Golden reward for the winner' }),
      ),
    ),
    errors.form,
    h('button', { class: 'btn btn-primary', attrs: { type: 'submit' }, text: 'Create competition' }),
  );

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    Object.values(errors).forEach((el) => { el.textContent = ''; });
    const checked = form.querySelector('input[name="comp-mode"]:checked');
    const res = createCompetition({
      name: name.value,
      start: start.value,
      end: end.value,
      mode: checked ? checked.value : '',
      golden: golden.checked,
    });
    if (!res.ok) {
      for (const [key, msg] of Object.entries(res.errors)) (errors[key] || errors.form).textContent = msg;
      return;
    }
    toast('Competition created (local mock only).');
  });

  return form;
}
