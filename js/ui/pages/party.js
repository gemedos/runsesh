// Party screens: no-party state, create, join (invite link), members & invites, party rules.
// The buttons shown depend on the role, but the database enforces every rule (RLS +
// functions); hiding a button is never the protection.

import { SITE_URL } from '../../config.js';
import {
  cleanPartyName, countMyActiveInvites, createInvite, createParty, expireAllInvites, inviteLink,
  joinParty, kickMember, leaveParty, previewInvite, revokeMyInvites, updateParty,
} from '../../data/partyRepo.js';
import { isNativeApp } from '../../platform.js';
import { STEP_SCORING } from '../../rules/ranking.js';
import { clearPendingInvite, codeFromInput, getPendingInvite } from '../../state/invite.js';
import { getLeader, getPartyMembers, isLeader, refreshParty } from '../../state/store.js';
import { STRINGS } from '../../strings.js';
import { avatarBadge, card, screenHeader } from '../components.js';
import { h, onMount } from '../dom.js';
import { personButton } from '../profileLink.js';

const P = STRINGS.party;

const button = (text, cls, onClick, attrs = {}) => h('button', { class: cls, text, attrs: { type: 'button', ...attrs }, on: { click: onClick } });

async function withBusy(btn, fn) {
  if (btn.disabled) return;
  btn.disabled = true;
  try { await fn(); } finally { if (btn.isConnected) btn.disabled = false; }
}

/** Loading / error / no-party states shared by the pages. Returns null when a party is ready. */
export function partyGate(state, navigate, { allowNoParty = false } = {}) {
  if (state.partyStatus === 'loading' || state.partyStatus === 'idle') {
    return card(null, h('p', { class: 'hint', text: P.loading }));
  }
  if (state.partyStatus === 'error') {
    return card(null, h('p', { class: 'hint', text: P.loadFailed }), button(P.retry, 'btn btn-secondary', () => refreshParty()));
  }
  if (!state.party && !allowNoParty) return noPartyCard(navigate);
  return null;
}

export function noPartyCard(navigate) {
  return h('section', { class: 'card no-party' },
    h('h2', { class: 'card-title', text: P.noneTitle }),
    h('p', { class: 'health-card-text', text: P.noneText }),
    h('div', { class: 'no-party-actions' },
      button(P.create, 'btn btn-primary', () => navigate('race/create-party')),
      button(P.join, 'btn btn-secondary', () => navigate('join')),
    ),
  );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function renderCreateParty({ state, navigate, toast }) {
  const T = STRINGS.createParty;
  if (state.party) {
    return h('div', { class: 'page' }, screenHeader(T.title, 'race'), card(null, h('p', { class: 'hint', text: T.alreadyInParty })));
  }
  const name = h('input', { attrs: { id: 'party-name', type: 'text', maxlength: 30, autocomplete: 'off', placeholder: T.namePlaceholder } });
  const error = h('p', { class: 'field-error', attrs: { 'aria-live': 'polite' } });
  const submit = h('button', { class: 'btn btn-primary', text: T.submit, attrs: { type: 'submit' } });
  const form = h('form', { class: 'form', attrs: { novalidate: true } },
    h('div', { class: 'field' }, h('label', { attrs: { for: 'party-name' }, text: T.name }), name, h('p', { class: 'hint', text: T.nameHint }), error),
    submit,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    withBusy(submit, async () => {
      error.textContent = '';
      const clean = cleanPartyName(name.value);
      if (!clean) { error.textContent = T.nameInvalid; return; }
      const res = await createParty(clean);
      if (!res.ok) { error.textContent = res.code === 'already_in_party' ? T.alreadyInParty : T.failed; return; }
      await refreshParty();
      toast(T.created);
      navigate('profile/members');
    });
  });
  return h('div', { class: 'page' },
    screenHeader(T.title, 'race'),
    card(T.cardTitle, h('p', { class: 'hint', text: T.intro }), form),
  );
}

// ---------------------------------------------------------------------------
// Join (from an invite link, or by pasting one)
// ---------------------------------------------------------------------------

export function renderJoin({ state, navigate, toast }) {
  if (state.party) {
    clearPendingInvite();
    return h('div', { class: 'page' }, screenHeader(P.joinTitle, 'race'), card(null, h('p', { class: 'hint', text: P.joinErrors.already_in_party })));
  }
  const area = h('div', { class: 'join-area' });

  function showError(code) {
    area.replaceChildren(h('p', { class: 'field-error', text: P.joinErrors[code] || P.joinErrors.error }), pasteForm());
  }

  async function showPreview(code) {
    area.replaceChildren(h('p', { class: 'hint', text: P.loading }));
    const preview = await previewInvite(code);
    if (!area.isConnected) return;
    if (!preview) { clearPendingInvite(); showError('invalid_invite'); return; }
    const join = button(P.joinButton, 'btn btn-primary', () => withBusy(join, async () => {
      const result = await joinParty(code);
      if (result !== 'ok') { showError(result); return; }
      clearPendingInvite();
      await refreshParty();
      toast(P.joined(preview.partyName));
      navigate('race');
    }));
    const cancel = button(P.joinCancel, 'btn btn-secondary', () => { clearPendingInvite(); navigate('race'); });
    area.replaceChildren(
      h('p', { class: 'join-preview', text: P.joinPreview(preview.partyName, preview.memberCount, preview.leaderName) }),
      h('div', { class: 'no-party-actions' }, join, cancel),
    );
  }

  function pasteForm() {
    const input = h('input', { attrs: { id: 'join-code', type: 'text', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off' } });
    const submit = h('button', { class: 'btn btn-primary', text: P.joinCheck, attrs: { type: 'submit' } });
    const form = h('form', { class: 'form', attrs: { novalidate: true } },
      h('div', { class: 'field' }, h('label', { attrs: { for: 'join-code' }, text: P.joinField }), input),
      submit,
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = codeFromInput(input.value);
      input.value = ''; // do not leave the code on screen
      if (!code) { showError('invalid_invite'); return; }
      showPreview(code);
    });
    return form;
  }

  const pending = getPendingInvite();
  const node = h('div', { class: 'page' },
    screenHeader(P.joinTitle, 'race'),
    card(null, h('p', { class: 'hint', text: P.joinPaste }), area),
  );
  if (pending === 'invalid') { clearPendingInvite(); showError('invalid_invite'); }
  else if (pending) onMount(node, () => showPreview(pending));
  else area.replaceChildren(pasteForm());
  return node;
}

// ---------------------------------------------------------------------------
// Members, invites, leaving
// ---------------------------------------------------------------------------

async function copy(text, toast) {
  const M = STRINGS.members;
  try {
    await navigator.clipboard.writeText(text);
    toast(M.inviteCopied);
  } catch {
    toast(M.inviteCopyFailed);
  }
}

function inviteCard(state, toast) {
  const M = STRINGS.members;
  const status = h('p', { class: 'hint', text: '' });
  const reveal = h('div', { class: 'key-reveal', attrs: { hidden: true } });

  async function refreshStatus() {
    const n = await countMyActiveInvites(state.auth.userId);
    if (status.isConnected && n !== null) status.textContent = M.inviteActive(n);
  }

  function showLink(link) {
    const field = h('input', { class: 'key-field', attrs: { type: 'text', readonly: true, 'aria-label': M.inviteTitle } });
    field.value = link; // property, never parsed as HTML
    const actions = [button(M.inviteCopy, 'btn btn-primary', () => copy(field.value, toast))];
    if (typeof navigator.share === 'function') {
      actions.push(button(M.inviteShare, 'btn btn-secondary', () => {
        navigator.share({ title: 'runsesh', text: M.inviteShareText, url: field.value }).catch(() => {});
      }));
    }
    actions.push(button(M.inviteDone, 'btn btn-secondary', () => { reveal.replaceChildren(); reveal.hidden = true; }));
    reveal.replaceChildren(h('p', { class: 'key-warning', text: M.inviteShownOnce }), field, h('div', { class: 'key-actions' }, ...actions));
    reveal.hidden = false;
    field.select();
  }

  const create = button(M.inviteCreate, 'btn btn-primary', () => withBusy(create, async () => {
    const res = await createInvite();
    if (!res.ok) { toast(res.code === 'too_many_invites' ? M.inviteTooMany : M.failed); return; }
    // Inside the Android app the page origin is local, so links must point at the website.
    showLink(inviteLink(isNativeApp() ? SITE_URL : document.baseURI, res.data));
    refreshStatus();
  }));
  const revokeMine = button(M.inviteRevokeMine, 'btn btn-secondary', () => withBusy(revokeMine, async () => {
    if (!window.confirm(M.inviteRevokeMineConfirm)) return;
    const res = await revokeMyInvites();
    toast(res.ok ? M.inviteRevokedMine(res.data || 0) : M.failed);
    reveal.replaceChildren(); reveal.hidden = true;
    refreshStatus();
  }));
  const actions = [create, revokeMine];
  if (isLeader(state)) {
    const expireAll = button(M.inviteExpireAll, 'btn btn-danger', () => withBusy(expireAll, async () => {
      if (!window.confirm(M.inviteExpireAllConfirm)) return;
      const res = await expireAllInvites();
      toast(res.ok ? M.inviteExpiredAll(res.data || 0) : M.failed);
      reveal.replaceChildren(); reveal.hidden = true;
      refreshStatus();
    }));
    actions.push(expireAll);
  }
  const node = card(M.inviteTitle, h('p', { class: 'hint', text: M.inviteText }), status, reveal, h('div', { class: 'key-actions' }, ...actions));
  onMount(node, refreshStatus);
  return node;
}

export function renderMembers({ state, navigate, toast }) {
  const M = STRINGS.members;
  const gate = partyGate(state, navigate);
  if (gate) return h('div', { class: 'page' }, screenHeader(M.title), gate);

  const leader = isLeader(state);
  const members = getPartyMembers(state);
  const list = h('ul', { class: 'list' }, members.map((m) => {
    const label = m.name || M.unnamed;
    const removeBtn = leader && !m.isMe ? button(M.remove, 'btn btn-small btn-danger', () => withBusy(removeBtn, async () => {
      if (!window.confirm(M.removeConfirm(label))) return;
      const res = await kickMember(m.id);
      toast(res.ok ? M.removed(label) : M.failed);
      if (res.ok) refreshParty();
    })) : null;
    return h('li', { class: 'member-row' },
      personButton(m.id, STRINGS.profile.openProfile(label), [
        avatarBadge(m.avatar, { size: 'sm' }),
        h('span', { class: 'rank-name', text: m.isMe ? M.you(label) : label }),
      ], 'member-link'),
      m.role === 'leader' ? h('span', { class: 'tag tag--gold', text: M.leader }) : null,
      removeBtn,
    );
  }));

  // Who takes over if the leader leaves (automatic: the longest-standing member).
  const next = leader ? members.find((m) => !m.isMe) : null;
  const leave = button(M.leave, 'btn btn-danger', () => withBusy(leave, async () => {
    if (!window.confirm(M.leaveConfirm)) return;
    const res = await leaveParty();
    if (!res.ok) { toast(M.failed); return; }
    await refreshParty();
    toast(M.left);
    navigate('race');
  }));

  return h('div', { class: 'page' },
    screenHeader(M.title),
    card(state.party.name, list),
    inviteCard(state, toast),
    card(M.leaveTitle,
      h('p', { class: 'hint', text: leader ? M.leaveLeaderText(next ? next.name || M.unnamed : null) : M.leaveText }),
      leave,
    ),
  );
}

// ---------------------------------------------------------------------------
// Party rules: everyone reads, only the leader edits
// ---------------------------------------------------------------------------

export function renderRules({ state, navigate, toast }) {
  const T = STRINGS.rules;
  const gate = partyGate(state, navigate);
  if (gate) return h('div', { class: 'page' }, screenHeader(T.title), gate);
  const leader = isLeader(state);
  const leaderName = (getLeader(state) || {}).name || STRINGS.competition.leaderFallback;

  const nameCard = (() => {
    if (!leader) return null;
    const input = h('input', { attrs: { id: 'rename-party', type: 'text', maxlength: 30, value: state.party.name } });
    const save = h('button', { class: 'btn btn-secondary', text: T.rename, attrs: { type: 'submit' } });
    const form = h('form', { class: 'form', attrs: { novalidate: true } },
      h('div', { class: 'field' }, h('label', { attrs: { for: 'rename-party' }, text: T.nameTitle }), input), save);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      withBusy(save, async () => {
        const ok = await updateParty(state.party.id, { name: input.value });
        toast(ok ? T.renamed : T.failed);
        if (ok) refreshParty();
      });
    });
    return card(T.nameTitle, form);
  })();

  const scoring = h('fieldset', { class: 'field radio-group', attrs: { disabled: !leader } },
    h('legend', { text: T.scoringTitle }),
    Object.values(STEP_SCORING).map((value) => {
      const input = h('input', { attrs: { type: 'radio', name: 'step-scoring', value, checked: state.party.stepScoring === value } });
      input.addEventListener('change', async () => {
        if (!input.checked) return;
        const ok = await updateParty(state.party.id, { stepScoring: value });
        toast(ok ? T.scoringSaved : T.failed);
        refreshParty();
      });
      return h('label', { class: 'radio' }, input, h('span', { text: T.scoring[value] }));
    }),
    h('p', { class: 'hint', text: T.scoringHint }),
  );

  return h('div', { class: 'page' },
    screenHeader(T.title),
    leader ? null : h('p', { class: 'hint', text: STRINGS.competition.leaderOnly(leaderName) }),
    nameCard,
    card(T.scoringTitle, scoring),
    card(T.cardTitle,
      h('dl', { class: 'kv' },
        h('dt', { text: T.dayResets }), h('dd', { text: T.dayResetsValue }),
        h('dt', { text: T.joining }), h('dd', { text: T.joiningValue }),
      ),
    ),
  );
}
