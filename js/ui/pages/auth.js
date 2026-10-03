// Logged-out screens: log in, sign up, forgot password, and set a new password (after a
// reset link). All messages are generic so they never reveal whether an email has an account.
// Submit buttons are disabled while a request runs (cosmetic; real limits are server-side).

import { changePassword, requestPasswordReset, signIn, signUp } from '../../auth/session.js';
import { checkEmail, checkPassword, cleanDisplayName, PASSWORD_MIN } from '../../auth/rules.js';
import { STRINGS } from '../../strings.js';
import { h } from '../dom.js';

const T = STRINGS.auth;

function authShell(title, ...children) {
  return h('div', { class: 'page page-auth' },
    h('div', { class: 'auth-brand' },
      h('img', { class: 'auth-logo', attrs: { src: 'icons/logo.svg', alt: STRINGS.app.logoAlt } }),
      h('p', { class: 'hint', text: T.tagline }),
    ),
    h('section', { class: 'card form auth-card' }, h('h1', { class: 'card-title', text: title }), ...children),
  );
}

function input(id, label, attrs, hint) {
  const el = h('input', { attrs: { id, ...attrs } });
  const error = h('p', { class: 'field-error', attrs: { 'aria-live': 'polite' } });
  const field = h('div', { class: 'field' },
    h('label', { attrs: { for: id }, text: label }),
    el,
    hint ? h('p', { class: 'hint', text: hint }) : null,
    error,
  );
  return { el, error, field };
}

const notice = () => h('p', { class: 'auth-notice', attrs: { role: 'status', 'aria-live': 'polite' } });
const link = (route, text) => h('a', { class: 'auth-link', attrs: { href: `#/${route}` }, text });

/** Runs an async submit with the button disabled. */
function busy(button, fn) {
  return async (e) => {
    e.preventDefault();
    if (button.disabled) return;
    const label = button.textContent;
    button.disabled = true;
    button.textContent = T.working;
    try {
      await fn();
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = label;
      }
    }
  };
}

function clear(...errors) {
  errors.forEach((el) => { el.textContent = ''; });
}

export function renderLoginScreen({ navigate, next }) {
  const email = input('login-email', T.email, { type: 'email', autocomplete: 'username', required: true, inputmode: 'email' });
  const password = input('login-password', T.password, { type: 'password', autocomplete: 'current-password', required: true });
  const msg = notice();
  const submit = h('button', { class: 'btn btn-primary', attrs: { type: 'submit' }, text: T.logIn });
  const form = h('form', { class: 'form', attrs: { novalidate: true } }, email.field, password.field, msg, submit);
  form.addEventListener('submit', busy(submit, async () => {
    clear(email.error, msg);
    if (!checkEmail(email.el.value)) { email.error.textContent = T.emailInvalid; return; }
    const res = await signIn({ email: email.el.value, password: password.el.value });
    if (!res.ok) { msg.textContent = T.loginFailed; return; }
    password.el.value = '';
    navigate(next || 'race');
  }));
  return authShell(T.loginTitle, form, link('forgot', T.toForgot), link('signup', T.toSignup));
}

export function renderSignupScreen() {
  const name = input('signup-name', T.displayName, { type: 'text', autocomplete: 'nickname', required: true, maxlength: 30 }, T.displayNameHint);
  const email = input('signup-email', T.email, { type: 'email', autocomplete: 'email', required: true, inputmode: 'email' });
  const password = input('signup-password', T.password, { type: 'password', autocomplete: 'new-password', required: true, minlength: PASSWORD_MIN }, T.passwordHint(PASSWORD_MIN));
  const msg = notice();
  const submit = h('button', { class: 'btn btn-primary', attrs: { type: 'submit' }, text: T.signUp });
  const form = h('form', { class: 'form', attrs: { novalidate: true } }, name.field, email.field, password.field,
    h('p', { class: 'hint' }, T.privacyAgree, ' ', h('a', { attrs: { href: 'privacy.html' }, text: T.privacyLink })),
    msg, submit);
  form.addEventListener('submit', busy(submit, async () => {
    clear(name.error, email.error, password.error, msg);
    let valid = true;
    if (!cleanDisplayName(name.el.value)) { name.error.textContent = T.nameInvalid; valid = false; }
    if (!checkEmail(email.el.value)) { email.error.textContent = T.emailInvalid; valid = false; }
    const pw = checkPassword(password.el.value);
    if (pw === 'too_short') { password.error.textContent = T.passwordShort(PASSWORD_MIN); valid = false; }
    if (pw === 'too_long') { password.error.textContent = T.passwordLong; valid = false; }
    if (!valid) return;
    const res = await signUp({ email: email.el.value, password: password.el.value, displayName: name.el.value });
    password.el.value = '';
    msg.textContent = res.ok ? T.signupDone : T.signupFailed;
    if (res.ok) form.replaceChildren(msg);
  }));
  return authShell(T.signupTitle, form, link('login', T.toLogin));
}

export function renderForgotScreen() {
  const email = input('forgot-email', T.email, { type: 'email', autocomplete: 'email', required: true, inputmode: 'email' });
  const msg = notice();
  const submit = h('button', { class: 'btn btn-primary', attrs: { type: 'submit' }, text: T.sendReset });
  const form = h('form', { class: 'form', attrs: { novalidate: true } }, email.field, msg, submit);
  form.addEventListener('submit', busy(submit, async () => {
    clear(email.error, msg);
    if (!checkEmail(email.el.value)) { email.error.textContent = T.emailInvalid; return; }
    await requestPasswordReset(email.el.value);
    msg.textContent = T.resetSent; // same message whether or not the account exists
  }));
  return authShell(T.forgotTitle, form, link('login', T.toLogin));
}

/** Shown after a password-reset link signed the user in (see auth-callback.html). */
export function renderResetScreen({ state, navigate }) {
  if (!state.auth) return authShell(T.resetTitle, h('p', { class: 'hint', text: T.resetNeedsLink }), link('forgot', T.toForgot));
  const password = input('reset-password', T.newPassword, { type: 'password', autocomplete: 'new-password', required: true, minlength: PASSWORD_MIN }, T.passwordHint(PASSWORD_MIN));
  const msg = notice();
  const submit = h('button', { class: 'btn btn-primary', attrs: { type: 'submit' }, text: T.savePassword });
  const form = h('form', { class: 'form', attrs: { novalidate: true } }, password.field, msg, submit);
  form.addEventListener('submit', busy(submit, async () => {
    clear(password.error, msg);
    const pw = checkPassword(password.el.value);
    if (pw) { password.error.textContent = pw === 'too_short' ? T.passwordShort(PASSWORD_MIN) : T.passwordLong; return; }
    const res = await changePassword(password.el.value);
    password.el.value = '';
    msg.textContent = res.ok ? T.resetDone : T.resetFailed;
    if (res.ok) setTimeout(() => navigate('race'), 1500);
  }));
  return authShell(T.resetTitle, form);
}

export function renderNotConfigured() {
  return authShell(STRINGS.app.name, h('p', { class: 'hint', text: T.notConfigured }));
}
