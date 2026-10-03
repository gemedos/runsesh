// "runsesh on iPhone" set-up screen: install as a Home Screen app, log in inside it, and send
// steps from Apple Health with an Apple Shortcut (personal Shortcut key, CLAUDE.md §2.1
// exception) or by hand.
//
// The Shortcut key is shown once for copying. It is kept only in this screen's DOM until the
// user taps "Done" or leaves, and is never written to any storage or logged.

import { SUPABASE_URL } from '../../config.js';
import { createShortcutKey, getShortcutKeyStatus, revokeShortcutKey } from '../../data/shortcutKeyRepo.js';
import { STRINGS } from '../../strings.js';
import { card, screenHeader } from '../components.js';
import { h, onMount } from '../dom.js';
import { isIos, isStandalone, shareIcon } from '../installHint.js';

const T = STRINGS.iphone;
const INGEST_URL = `${SUPABASE_URL}/functions/v1/ingest-steps`;

function deviceStatus() {
  if (!isIos()) return { text: T.statusOther, cls: 'device-status' };
  if (isStandalone()) return { text: T.statusInstalled, cls: 'device-status device-status--ok' };
  return { text: T.statusBrowser, cls: 'device-status device-status--todo' };
}

const formatWhen = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

async function copyText(text, okMessage, toast) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
  } catch {
    toast(T.keyCopyFailed);
  }
}

/** The key card: status, create/replace/revoke, and the one-time key display. */
function keyCard(toast) {
  const status = h('p', { class: 'health-card-text', text: T.keyLoading });
  const reveal = h('div', { class: 'key-reveal', attrs: { hidden: true } });
  const actions = h('div', { class: 'key-actions' });

  function setBusy(busy) {
    for (const btn of actions.querySelectorAll('button')) btn.disabled = busy;
  }

  function showKey(key) {
    const field = h('input', { class: 'key-field', attrs: { type: 'text', readonly: true, autocomplete: 'off', spellcheck: 'false', 'aria-label': T.keyTitle } });
    field.value = key; // set as a property: never parsed as HTML
    const copy = h('button', { class: 'btn btn-primary', text: T.keyCopy, attrs: { type: 'button' } });
    copy.addEventListener('click', () => copyText(field.value, T.keyCopied, toast));
    const done = h('button', { class: 'btn btn-secondary', text: T.keyHide, attrs: { type: 'button' } });
    done.addEventListener('click', () => { reveal.replaceChildren(); reveal.hidden = true; });
    reveal.replaceChildren(h('p', { class: 'key-warning', text: T.keyShownOnce }), field, h('div', { class: 'key-actions' }, copy, done));
    reveal.hidden = false;
    field.focus();
    field.select();
  }

  async function refresh() {
    const s = await getShortcutKeyStatus();
    if (!status.isConnected) return;
    if (!s) {
      status.textContent = T.keyFailed;
      actions.replaceChildren();
      return;
    }
    if (!s.hasKey) {
      status.textContent = T.keyNone;
    } else {
      const created = s.createdAt ? formatWhen(s.createdAt) : '';
      status.textContent = `${T.keyStatus(s.hint, created)} ${s.lastUsedAt ? T.keyLastUsed(formatWhen(s.lastUsedAt)) : T.keyNeverUsed}`;
    }

    const create = h('button', { class: 'btn btn-primary', text: s.hasKey ? T.keyReplace : T.keyCreate, attrs: { type: 'button' } });
    create.addEventListener('click', async () => {
      if (s.hasKey && !window.confirm(T.keyReplaceConfirm)) return;
      setBusy(true);
      const key = await createShortcutKey();
      setBusy(false);
      if (!key) { toast(T.keyFailed); return; }
      showKey(key);
      refresh();
    });
    const buttons = [create];
    if (s.hasKey) {
      const revoke = h('button', { class: 'btn btn-danger', text: T.keyRevoke, attrs: { type: 'button' } });
      revoke.addEventListener('click', async () => {
        if (!window.confirm(T.keyRevokeConfirm)) return;
        setBusy(true);
        const ok = await revokeShortcutKey();
        setBusy(false);
        toast(ok ? T.keyRevoked : T.keyFailed);
        if (ok) { reveal.replaceChildren(); reveal.hidden = true; refresh(); }
      });
      buttons.push(revoke);
    }
    actions.replaceChildren(...buttons);
  }

  const node = card(T.keyTitle, h('p', { class: 'hint', text: T.keyIntro }), status, reveal, actions);
  onMount(node, refresh);
  return node;
}

function buildCard(toast) {
  const url = h('input', { class: 'key-field', attrs: { type: 'text', readonly: true, 'aria-label': T.urlLabel } });
  url.value = INGEST_URL;
  const copyUrl = h('button', { class: 'btn btn-secondary', text: T.copyUrl, attrs: { type: 'button' } });
  copyUrl.addEventListener('click', () => copyText(INGEST_URL, T.urlCopied, toast));
  return card(T.buildTitle,
    h('ol', { class: 'steps-list' }, T.buildSteps.map((text) => h('li', { text }))),
    h('div', { class: 'field' }, h('span', { class: 'hint', text: T.urlLabel }), url),
    copyUrl,
    h('p', { class: 'hint', text: T.limitsNote }),
  );
}

export function renderIphone({ navigate, toast }) {
  const status = deviceStatus();
  return h('div', { class: 'page' },
    screenHeader(T.title),
    card(T.statusTitle, h('p', { class: status.cls, text: status.text })),
    card(T.installTitle,
      h('ol', { class: 'steps-list' },
        T.installSteps.map((text, i) => h('li', {}, text, i === 1 ? h('span', { class: 'steps-list-icon' }, shareIcon()) : null)),
      ),
    ),
    card(T.loginTitle, h('p', { class: 'health-card-text', text: T.loginText })),
    card(T.stepsTitle,
      h('p', { class: 'health-card-text', text: T.stepsText }),
      h('button', { class: 'btn btn-secondary', text: T.manualAction, attrs: { type: 'button' }, on: { click: () => navigate('profile/health') } }),
    ),
    keyCard(toast),
    buildCard(toast),
    card(T.updateTitle, h('p', { class: 'health-card-text', text: T.updateText })),
  );
}
