// Shared UI for personal ingest tokens (CLAUDE.md "Health data ingest tokens"): the card that
// lists a platform's tokens with Revoke, creates a new one, and shows it once for copying, plus
// the copyable ingest address.
//
// The token is kept only in this card's DOM until the user taps "Done" or leaves the screen.
// It is never written to any storage, logged, or put in a URL.

import { INGEST_URL } from '../config.js';
import { createIngestToken, listIngestTokens, MAX_TOKENS, revokeIngestToken } from '../data/ingestTokenRepo.js';
import { STRINGS } from '../strings.js';
import { card } from './components.js';
import { h, onMount } from './dom.js';

const T = STRINGS.tokens;

const formatWhen = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export async function copyText(text, okMessage, toast) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage);
  } catch {
    toast(T.copyFailed);
  }
}

/** Read-only field + copy button for the ingest address. */
export function ingestUrlField(label, toast) {
  const url = h('input', { class: 'key-field', attrs: { type: 'text', readonly: true, 'aria-label': label } });
  url.value = INGEST_URL;
  const copy = h('button', { class: 'btn btn-secondary', text: T.copyUrl, attrs: { type: 'button' } });
  copy.addEventListener('click', () => copyText(INGEST_URL, T.urlCopied, toast));
  return h('div', { class: 'field' }, h('span', { class: 'hint', text: label }), url, copy);
}

/**
 * @param {'android'|'ios'} platform
 * @param {{title: string, intro: string, none: string, create: string}} text  platform wording
 */
export function tokenCard(platform, text, toast) {
  const list = h('div', { class: 'token-list' }, h('p', { class: 'hint', text: T.loading }));
  const reveal = h('div', { class: 'key-reveal', attrs: { hidden: true } });
  const actions = h('div', { class: 'key-actions' });

  function setBusy(busy) {
    for (const btn of node.querySelectorAll('.token-list button, .key-actions button')) btn.disabled = busy;
  }

  function hideToken() {
    reveal.replaceChildren();
    reveal.hidden = true;
  }

  function showToken(token) {
    const value = `Bearer ${token}`;
    const field = h('input', { class: 'key-field', attrs: { type: 'text', readonly: true, autocomplete: 'off', spellcheck: 'false', 'aria-label': T.headerValueLabel } });
    field.value = value; // set as a property: never parsed as HTML
    const copy = h('button', { class: 'btn btn-primary', text: T.copy, attrs: { type: 'button' } });
    copy.addEventListener('click', () => copyText(field.value, T.copied, toast));
    const done = h('button', { class: 'btn btn-secondary', text: T.done, attrs: { type: 'button' } });
    done.addEventListener('click', hideToken);
    reveal.replaceChildren(
      h('p', { class: 'key-warning', text: T.shownOnce }),
      h('span', { class: 'hint', text: T.headerValueLabel }),
      field,
      h('div', { class: 'key-actions' }, copy, done),
    );
    reveal.hidden = false;
    field.focus();
    field.select();
  }

  async function refresh() {
    const all = await listIngestTokens();
    if (!list.isConnected) return;
    if (!all) {
      list.replaceChildren(h('p', { class: 'hint', text: T.failed }));
      actions.replaceChildren();
      return;
    }

    const mine = all.filter((t) => t.platform === platform);
    list.replaceChildren(...(mine.length ? mine.map((t) => {
      const revoke = h('button', { class: 'btn btn-danger btn-small', text: T.revoke, attrs: { type: 'button' } });
      revoke.addEventListener('click', async () => {
        if (!window.confirm(T.revokeConfirm)) return;
        setBusy(true);
        const ok = await revokeIngestToken(t.id);
        setBusy(false);
        toast(ok ? T.revoked : T.failed);
        if (ok) refresh();
      });
      return h('div', { class: 'token-row' },
        h('p', { class: 'health-card-text' },
          T.status(t.hint, t.createdAt ? formatWhen(t.createdAt) : ''), ' ',
          t.lastUsedAt ? T.lastReceived(formatWhen(t.lastUsedAt)) : T.neverReceived),
        revoke,
      );
    }) : [h('p', { class: 'health-card-text', text: text.none })]));

    const atLimit = all.length >= MAX_TOKENS;
    const create = h('button', { class: 'btn btn-primary', text: text.create, attrs: { type: 'button', disabled: atLimit } });
    create.addEventListener('click', async () => {
      setBusy(true);
      const res = await createIngestToken(platform);
      setBusy(false);
      if (res.token) {
        showToken(res.token);
      } else {
        toast(res.error === 'limit' ? T.limit : T.failed);
      }
      refresh();
    });
    actions.replaceChildren(create, atLimit ? h('p', { class: 'hint', text: T.limit }) : null);
  }

  const node = card(text.title, h('p', { class: 'hint', text: text.intro }), list, reveal, actions);
  onMount(node, refresh);
  return node;
}
