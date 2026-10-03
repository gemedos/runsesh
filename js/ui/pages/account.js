// Account and Login / Log out screens for the signed-in user.
// The password is never shown or hinted at; only a "new password" field exists.

import { changePassword, signOut } from '../../auth/session.js';
import { checkPassword, cleanDisplayName, PASSWORD_MIN } from '../../auth/rules.js';
import { saveDisplayName } from '../../state/store.js';
import { STRINGS } from '../../strings.js';
import { card, screenHeader } from '../components.js';
import { h } from '../dom.js';

const T = STRINGS.account;

function sessionButtons() {
  const L = STRINGS.login;
  const one = h('button', { class: 'btn btn-secondary', text: L.logOut, attrs: { type: 'button' } });
  const all = h('button', { class: 'btn btn-secondary', text: L.logOutAll, attrs: { type: 'button' } });
  one.addEventListener('click', () => { one.disabled = true; signOut('local'); });
  all.addEventListener('click', () => { all.disabled = true; signOut('global'); });
  return [one, all, h('p', { class: 'hint', text: L.logOutAllHint })];
}

export function renderLogin({ state }) {
  const L = STRINGS.login;
  return h('div', { class: 'page' },
    screenHeader(L.title),
    card(L.signedInAs(state.auth.email), ...sessionButtons()),
  );
}

export function renderAccount({ state, toast }) {
  const profile = state.profile || {};

  // Display name
  const nameInput = h('input', { attrs: { id: 'acc-name', type: 'text', autocomplete: 'nickname', maxlength: 30, value: profile.displayName || '' } });
  const nameError = h('p', { class: 'field-error', attrs: { 'aria-live': 'polite' } });
  const nameBtn = h('button', { class: 'btn btn-primary', text: T.saveName, attrs: { type: 'submit' } });
  const nameForm = h('form', { class: 'form', attrs: { novalidate: true } },
    h('div', { class: 'field' }, h('label', { attrs: { for: 'acc-name' }, text: T.editName }), nameInput, nameError),
    nameBtn,
  );
  nameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    nameError.textContent = '';
    if (!cleanDisplayName(nameInput.value)) { nameError.textContent = T.nameFailed; return; }
    nameBtn.disabled = true;
    const ok = await saveDisplayName(nameInput.value);
    nameBtn.disabled = false;
    if (ok) toast(T.nameSaved); else nameError.textContent = T.nameFailed;
  });

  // Change password (new password only; nothing about the current one is displayed)
  const pwInput = h('input', { attrs: { id: 'acc-password', type: 'password', autocomplete: 'new-password', minlength: PASSWORD_MIN } });
  const pwError = h('p', { class: 'field-error', attrs: { 'aria-live': 'polite' } });
  const pwBtn = h('button', { class: 'btn btn-secondary', text: T.savePassword, attrs: { type: 'submit' } });
  const pwForm = h('form', { class: 'form', attrs: { novalidate: true } },
    h('div', { class: 'field' },
      h('label', { attrs: { for: 'acc-password' }, text: T.changePassword }),
      pwInput,
      h('p', { class: 'hint', text: STRINGS.auth.passwordHint(PASSWORD_MIN) }),
      pwError,
    ),
    pwBtn,
  );
  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    pwError.textContent = '';
    const check = checkPassword(pwInput.value);
    if (check) { pwError.textContent = check === 'too_short' ? STRINGS.auth.passwordShort(PASSWORD_MIN) : STRINGS.auth.passwordLong; return; }
    pwBtn.disabled = true;
    const res = await changePassword(pwInput.value);
    pwInput.value = '';
    pwBtn.disabled = false;
    if (res.ok) toast(T.passwordChanged); else pwError.textContent = T.passwordFailed;
  });

  const deleteBtn = h('button', { class: 'btn btn-danger', text: T.deleteAccount, attrs: { type: 'button' } });
  deleteBtn.addEventListener('click', () => toast(T.deleteLater));

  return h('div', { class: 'page' },
    screenHeader(T.title),
    card(T.cardTitle,
      h('dl', { class: 'kv' },
        h('dt', { text: T.name }), h('dd', { text: profile.displayName || T.noName }),
        h('dt', { text: T.email }), h('dd', { text: state.auth.email }),
      ),
      nameForm,
    ),
    card(T.changePassword, pwForm),
    card(T.sessionTitle, ...sessionButtons()),
    card(T.dangerZone, deleteBtn, h('a', { class: 'auth-link', attrs: { href: 'privacy.html' }, text: T.privacyLink })),
  );
}
