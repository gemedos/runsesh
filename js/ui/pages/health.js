// Health connect screen: manual entry works (source 'manual'); the Android app (Part B)
// and the Apple Shortcut (later phase) are described but not built yet.

import { ManualStepsSource } from '../../steps/manualSource.js';
import { fetchOwnHistory, STEPS_MAX, syncFromSource } from '../../steps/sync.js';
import { STRINGS } from '../../strings.js';
import { addDays, formatDate, todayISO } from '../../util/date.js';
import { card, formatSteps, screenHeader } from '../components.js';
import { h, onMount } from '../dom.js';

const T = STRINGS.health;
const manualSource = new ManualStepsSource();

function sourceCard(title, text, action, onAction, tag) {
  const btn = h('button', { class: 'btn btn-secondary', text: action, attrs: { type: 'button', disabled: !onAction } });
  if (onAction) btn.addEventListener('click', onAction);
  return h('section', { class: 'card health-card' },
    h('div', { class: 'health-card-head' },
      h('h2', { class: 'card-title', text: title }),
      tag ? h('span', { class: 'tag', text: tag }) : null,
    ),
    h('p', { class: 'health-card-text', text }),
    btn,
  );
}

export function renderHealth({ state, toast, navigate }) {
  const userId = state.auth.userId;
  const today = todayISO();

  // --- history (today + last 6 days) ---
  const history = h('div', { class: 'history' }, h('p', { class: 'hint', text: STRINGS.auth.working }));
  async function loadHistory() {
    const rows = await fetchOwnHistory(userId, addDays(today, -6), today).catch(() => null);
    if (!history.isConnected) return;
    if (!rows) { history.replaceChildren(h('p', { class: 'hint', text: T.historyFailed })); return; }
    if (!rows.length) { history.replaceChildren(h('p', { class: 'hint', text: T.historyEmpty })); return; }
    history.replaceChildren(h('ul', { class: 'history-list' }, rows.map((r) => h('li', { class: 'history-row' },
      h('span', { text: formatDate(r.day) }),
      h('span', { class: 'history-source', text: T.sources[r.source] || '' }),
      h('b', { text: STRINGS.common.steps(formatSteps(r.steps)) }),
    ))));
  }

  // --- manual entry ---
  const stepsInput = h('input', { attrs: { id: 'manual-steps', type: 'number', inputmode: 'numeric', min: 0, max: STEPS_MAX, step: 1, required: true } });
  const error = h('p', { class: 'field-error', attrs: { 'aria-live': 'polite' } });
  const save = h('button', { class: 'btn btn-primary', text: T.manualSave, attrs: { type: 'submit' } });
  const form = h('form', { class: 'form', attrs: { novalidate: true } },
    h('div', { class: 'field' }, h('label', { attrs: { for: 'manual-steps' }, text: T.manualLabel }), stepsInput, error),
    save,
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    const raw = stepsInput.value.trim();
    const steps = /^\d{1,6}$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(steps) || steps < 0 || steps > STEPS_MAX) { error.textContent = T.manualInvalid; return; }
    save.disabled = true;
    manualSource.setEntry(today, steps);
    const res = await syncFromSource(manualSource, userId, today, today).catch(() => ({ ok: false, saved: 0 }));
    save.disabled = false;
    if (res.saved > 0) {
      toast(T.manualSaved);
      stepsInput.value = '';
      loadHistory();
    } else {
      error.textContent = res.discarded ? T.manualInvalid : T.manualFailed;
    }
  });

  // --- Android placeholder section (Part B adds the real flow) ---
  const androidSection = h('section', { class: 'card', attrs: { id: 'android-app', tabindex: '-1' } },
    h('h2', { class: 'card-title', text: T.androidSectionTitle }),
    h('p', { class: 'hint', text: T.androidSection }),
  );

  const node = h('div', { class: 'page' },
    screenHeader(T.title),
    h('p', { class: 'hint', text: T.intro }),
    h('section', { class: 'card health-card' },
      h('div', { class: 'health-card-head' }, h('h2', { class: 'card-title', text: T.manualTitle })),
      h('p', { class: 'health-card-text', text: T.manualText }),
      form,
    ),
    card(T.historyTitle, history),
    sourceCard(T.androidTitle, T.androidText, T.androidAction, () => {
      androidSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      androidSection.focus({ preventScroll: true });
    }),
    sourceCard(T.shortcutTitle, T.shortcutText, T.shortcutAction, () => navigate('profile/iphone')),
    androidSection,
    h('p', { class: 'hint' }, T.privacy, ' ', h('a', { attrs: { href: 'privacy.html' }, text: T.privacyLink })),
  );
  onMount(node, loadHistory);
  return node;
}
