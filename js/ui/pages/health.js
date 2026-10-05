// Health connect screen: manual entry (source 'manual'), the Android set-up (an independent
// Health Connect webhook app sends daily totals with a personal ingest token, source
// 'health_connect') and a link to the iPhone Shortcut set-up (source 'shortcut').

import { fetchManualEntryAllowed } from '../../data/settingsRepo.js';
import { ManualStepsSource } from '../../steps/manualSource.js';
import { fetchStepHistory, STEPS_MAX, syncFromSource } from '../../steps/sync.js';
import { ANDROID_APP } from '../../integrations/androidApp.js';
import { STRINGS } from '../../strings.js';
import { addDays, formatDate, todayISO } from '../../util/date.js';
import { card, formatSteps, screenHeader } from '../components.js';
import { h, onMount } from '../dom.js';
import { ingestUrlField, tokenCard } from '../ingestTokens.js';

const T = STRINGS.health;
const manualSource = new ManualStepsSource();

/** Android set-up: install the app, create a token, configure the app. Wrapped for scrolling. */
function androidSection(toast) {
  const release = h('a', {
    class: 'ext-link',
    text: T.androidReleaseLink,
    attrs: { href: ANDROID_APP.releaseUrl, target: '_blank', rel: 'noopener noreferrer' },
  });
  return h('div', { class: 'android-setup', attrs: { id: 'android-app', tabindex: '-1' } },
    card(T.androidSectionTitle,
      h('p', { class: 'health-card-text', text: T.androidIntro(ANDROID_APP.name) }),
      h('p', { class: 'hint', text: T.androidDoOnPhone }),
    ),
    card(T.androidInstallTitle,
      h('ol', { class: 'steps-list' },
        T.androidInstallSteps(ANDROID_APP.name, ANDROID_APP.version, ANDROID_APP.nameOnPhone).map((text) => h('li', { text }))),
      release,
    ),
    tokenCard('android', { title: T.androidTokenTitle, intro: T.androidTokenIntro, none: T.androidTokenNone, create: T.androidTokenCreate }, toast),
    card(T.androidSetupTitle,
      ingestUrlField(T.androidUrlLabel, toast),
      h('ol', { class: 'steps-list' }, T.androidSetupSteps.map((text) => h('li', { text }))),
      h('p', { class: 'hint', text: T.androidLimitsNote }),
    ),
  );
}

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
    const rows = await fetchStepHistory(userId, addDays(today, -6), today).catch(() => null);
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

  // The owner's switches decide whether the form is shown (the database enforces them anyway).
  // If they cannot be read, the form stays: the server still refuses writes that are not allowed.
  const manualBody = h('div', {}, h('p', { class: 'hint', text: T.manualChecking }));
  async function loadManualSwitch() {
    const allowed = await fetchManualEntryAllowed(userId);
    if (!manualBody.isConnected) return;
    manualBody.replaceChildren(...(allowed === false
      ? [h('p', { class: 'health-card-text', text: T.manualOff })]
      : [h('p', { class: 'health-card-text', text: T.manualText }), form]));
  }

  const android = androidSection(toast);

  const node = h('div', { class: 'page' },
    screenHeader(T.title),
    h('p', { class: 'hint', text: T.intro }),
    h('section', { class: 'card health-card' },
      h('div', { class: 'health-card-head' }, h('h2', { class: 'card-title', text: T.manualTitle })),
      manualBody,
    ),
    card(T.historyTitle, history),
    sourceCard(T.androidTitle, T.androidText, T.androidAction, () => {
      android.scrollIntoView({ behavior: 'smooth', block: 'start' });
      android.focus({ preventScroll: true });
    }),
    sourceCard(T.shortcutTitle, T.shortcutText, T.shortcutAction, () => navigate('profile/iphone')),
    android,
    h('p', { class: 'hint' }, T.privacy, ' ', h('a', { attrs: { href: 'privacy.html' }, text: T.privacyLink })),
  );
  onMount(node, loadHistory);
  onMount(node, loadManualSwitch);
  return node;
}
