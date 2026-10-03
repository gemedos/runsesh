// Competition settings (Profile → Competition, and the button on the Competition tab).
// Leader: create the competition, edit it, choose the theme or upload their own background
// photo, end it early, or delete it. Everyone else: the same information, read-only.
// The database enforces leader-only editing (RLS + functions); this screen just follows it.

import {
  backgroundUrl, createCompetition, deleteCompetition, endCompetition, removeBackground, updateCompetition, uploadBackground,
} from '../../data/competitionRepo.js';
import { RANKING_MODES } from '../../rules/ranking.js';
import { COMPETITION_NAME_MAX, COMPETITION_THEMES, validateCompetitionInput } from '../../state/competition.js';
import { getLeader, isLeader, refreshParty } from '../../state/store.js';
import { STRINGS } from '../../strings.js';
import { formatDate, todayISO } from '../../util/date.js';
import { IMAGE_ACCEPT, prepareImage } from '../../util/image.js';
import { circusHeader, competitionMeta, THEME_ART, themedCardClass } from '../competitionBlock.js';
import { card, screenHeader } from '../components.js';
import { h } from '../dom.js';
import { partyGate } from './party.js';

const T = STRINGS.competition;

async function busy(btn, fn) {
  if (btn.disabled) return;
  btn.disabled = true;
  try { await fn(); } finally { if (btn.isConnected) btn.disabled = false; }
}

export async function renderCompetition({ state, navigate, toast }) {
  const gate = partyGate(state, navigate);
  if (gate) return h('div', { class: 'page page-competition' }, screenHeader(T.screenTitle, 'profile'), gate);

  const today = todayISO();
  const leader = isLeader(state);
  const leaderName = (getLeader(state) || {}).name || T.leaderFallback;
  const competition = state.competition;
  const photo = competition ? await backgroundUrl(competition.backgroundPath) : null;

  const header = h('section', { class: themedCardClass(competition ? competition.theme : 'circus') },
    circusHeader(competition ? competition.theme : 'circus', photo),
    competition ? competitionMeta(competition, today) : h('p', { class: 'empty', text: leader ? T.leaderEmpty : T.memberEmpty(leaderName) }),
  );

  if (!leader) {
    return h('div', { class: 'page page-competition' },
      screenHeader(T.screenTitle, 'profile'),
      h('p', { class: 'hint', text: T.leaderOnly(leaderName) }),
      header,
      competition ? rulesCard(competition) : null,
    );
  }

  if (!competition) {
    return h('div', { class: 'page page-competition' },
      screenHeader(T.screenTitle, 'profile'),
      header,
      competitionForm({ today, toast, onSubmit: (value) => createCompetition(state.party.id, value) }),
    );
  }

  return h('div', { class: 'page page-competition' },
    screenHeader(T.screenTitle, 'profile'),
    header,
    competitionForm({ today, toast, competition, onSubmit: (value) => updateCompetition(competition.id, value) }),
    themePicker(competition, toast),
    photoCard(competition, Boolean(photo), toast),
    lifecycleCard(competition, today, toast),
  );
}

function rulesCard(competition) {
  return card(T.editTitle,
    h('dl', { class: 'kv' },
      h('dt', { text: T.form.mode }), h('dd', { text: T.modes[competition.mode] }),
      h('dt', { text: T.form.start }), h('dd', { text: formatDate(competition.start) }),
      h('dt', { text: T.form.end }), h('dd', { text: competition.end ? formatDate(competition.end) : '—' }),
      h('dt', { text: T.goldenReward }), h('dd', { text: competition.golden ? '✓' : '—' }),
      h('dt', { text: T.themeTitle }), h('dd', { text: T.themes[competition.theme] }),
    ),
    h('p', { class: 'hint', text: T.autoJoin }),
  );
}

function field(label, id, input, errorEl, hint) {
  return h('div', { class: 'field' },
    h('label', { attrs: { for: id }, text: label }),
    input,
    hint ? h('p', { class: 'hint', text: hint }) : null,
    errorEl,
  );
}

/** Create (no competition) or edit (existing competition) form. Leader only. */
function competitionForm({ today, toast, competition = null, onSubmit }) {
  const F = T.form;
  const errorEl = () => h('p', { class: 'field-error', attrs: { 'aria-live': 'polite' } });
  const errors = { name: errorEl(), start: errorEl(), end: errorEl(), mode: errorEl(), form: errorEl() };

  const name = h('input', { attrs: { id: 'comp-name', type: 'text', maxlength: COMPETITION_NAME_MAX, autocomplete: 'off', placeholder: F.namePlaceholder, value: competition ? competition.name : '' } });
  const start = h('input', { attrs: { id: 'comp-start', type: 'date', required: true, value: competition ? competition.start : today } });
  const end = h('input', { attrs: { id: 'comp-end', type: 'date', value: competition && competition.end ? competition.end : '' } });
  const golden = h('input', { class: 'switch-input', attrs: { id: 'comp-golden', type: 'checkbox', checked: Boolean(competition && competition.golden) } });
  const current = competition ? competition.mode : RANKING_MODES.DAYS_WON;

  const modes = h('fieldset', { class: 'field radio-group' },
    h('legend', { text: F.mode }),
    Object.values(RANKING_MODES).map((mode) => h('label', { class: 'radio' },
      h('input', { attrs: { type: 'radio', name: 'comp-mode', value: mode, checked: mode === current } }),
      h('span', { text: T.modes[mode] }),
    )),
    errors.mode,
  );

  const submit = h('button', { class: 'btn btn-primary', attrs: { type: 'submit' }, text: competition ? F.save : F.submit });
  const form = h('form', { class: 'card form', attrs: { novalidate: true } },
    h('h2', { class: 'card-title', text: competition ? T.editTitle : T.create }),
    competition ? null : h('p', { class: 'hint', text: T.autoJoin }),
    field(F.name, 'comp-name', name, errors.name),
    field(F.start, 'comp-start', start, errors.start),
    field(F.end, 'comp-end', end, errors.end, F.endHint),
    modes,
    h('div', { class: 'field switch-row' },
      h('label', { class: 'switch', attrs: { for: 'comp-golden' } },
        golden,
        h('span', { class: 'switch-track', attrs: { 'aria-hidden': 'true' } }),
        h('span', { text: F.golden }),
      ),
    ),
    errors.form,
    submit,
  );

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(submit, async () => {
      Object.values(errors).forEach((el) => { el.textContent = ''; });
      const checked = form.querySelector('input[name="comp-mode"]:checked');
      const res = validateCompetitionInput({
        name: name.value, start: start.value, end: end.value, mode: checked ? checked.value : '', golden: golden.checked,
      });
      if (!res.ok) {
        for (const [key, msg] of Object.entries(res.errors)) (errors[key] || errors.form).textContent = msg;
        return;
      }
      const ok = await onSubmit(res.value);
      if (!ok) { errors.form.textContent = T.saveFailed; return; }
      toast(competition ? T.saved : F.created);
      refreshParty();
    });
  });
  return form;
}

function themePicker(competition, toast) {
  return card(T.themeTitle,
    h('p', { class: 'hint', text: T.themeHint }),
    h('div', { class: 'theme-grid', attrs: { role: 'radiogroup', 'aria-label': T.themeTitle } },
      COMPETITION_THEMES.map((theme) => {
        const selected = theme === competition.theme;
        const btn = h('button', {
          class: `theme-option${selected ? ' theme-option--selected' : ''}`,
          attrs: { type: 'button', role: 'radio', 'aria-checked': selected ? 'true' : 'false' },
        },
        h('img', { class: 'theme-thumb', attrs: { src: THEME_ART[theme], alt: '' } }),
        selected ? h('span', { class: 'option-check', attrs: { 'aria-hidden': 'true' } }, '✓') : null,
        h('span', { class: 'theme-name', text: T.themes[theme] }),
        );
        btn.addEventListener('click', () => {
          if (selected) return;
          busy(btn, async () => {
            const ok = await updateCompetition(competition.id, { theme });
            toast(ok ? T.themeSaved(T.themes[theme]) : T.saveFailed);
            if (ok) refreshParty();
          });
        });
        return btn;
      }),
    ),
  );
}

function photoCard(competition, hasPhoto, toast) {
  const fileInput = h('input', { class: 'sr-only', attrs: { type: 'file', accept: IMAGE_ACCEPT, tabindex: '-1', 'aria-hidden': 'true' } });
  const upload = h('button', { class: 'btn btn-secondary', text: hasPhoto ? T.photoReplace : T.photoUpload, attrs: { type: 'button' } });
  const status = h('p', { class: 'field-error', attrs: { 'aria-live': 'polite' } });

  upload.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    busy(upload, async () => {
      status.textContent = '';
      upload.textContent = T.photoWorking;
      const prepared = await prepareImage(file);
      if (!prepared.ok) {
        status.textContent = T.photoErrors[prepared.reason];
        upload.textContent = hasPhoto ? T.photoReplace : T.photoUpload;
        return;
      }
      const ok = await uploadBackground(competition, prepared.blob);
      upload.textContent = hasPhoto ? T.photoReplace : T.photoUpload;
      if (!ok) { status.textContent = T.photoErrors.upload; return; }
      toast(T.photoSaved);
      refreshParty();
    });
  });

  const actions = [upload];
  if (hasPhoto) {
    const remove = h('button', { class: 'btn btn-danger', text: T.photoRemove, attrs: { type: 'button' } });
    remove.addEventListener('click', () => busy(remove, async () => {
      const ok = await removeBackground(competition);
      toast(ok ? T.photoRemoved : T.actionFailed);
      if (ok) refreshParty();
    }));
    actions.push(remove);
  }
  return card(T.photoTitle, h('p', { class: 'hint', text: T.photoHint }), fileInput, h('div', { class: 'key-actions' }, ...actions), status);
}

function lifecycleCard(competition, today, toast) {
  const end = h('button', { class: 'btn btn-secondary', text: T.endButton, attrs: { type: 'button', disabled: competition.start > today } });
  end.addEventListener('click', () => busy(end, async () => {
    if (!window.confirm(T.endConfirm)) return;
    const ok = await endCompetition(competition.id);
    toast(ok ? T.ended : T.actionFailed);
    if (ok) refreshParty();
  }));
  const del = h('button', { class: 'btn btn-danger', text: T.deleteButton, attrs: { type: 'button' } });
  del.addEventListener('click', () => busy(del, async () => {
    if (!window.confirm(T.deleteConfirm)) return;
    const ok = await deleteCompetition(competition);
    toast(ok ? T.deleted : T.actionFailed);
    if (ok) refreshParty();
  }));
  return card(null,
    h('div', { class: 'key-actions' }, end, del),
    competition.start > today ? h('p', { class: 'hint', text: T.notStarted }) : null,
  );
}
