import { cleanPartyName, INVITE_CODE_RE, inviteLink } from '../js/data/partyRepo.js';
import { codeFromInput } from '../js/state/invite.js';
import { eq, test } from './harness.js';

const CODE = 'AbCdEfGhIjKlMnOpQrStUv_-';

test('invite codes: exactly 24 base64url characters', () => {
  eq([INVITE_CODE_RE.test(CODE), INVITE_CODE_RE.test(CODE.slice(1)), INVITE_CODE_RE.test(`${CODE}x`), INVITE_CODE_RE.test('A'.repeat(23) + '/')], [true, false, false, false]);
});

test('invite links put the code after # only', () => {
  const link = inviteLink('https://gemedos.github.io/runsesh/index.html', CODE);
  eq(link, `https://gemedos.github.io/runsesh/#/join/${CODE}`);
  eq(new URL(link).search, '');
});

test('pasted invite input: full link or bare code, nothing else', () => {
  eq(codeFromInput(`https://gemedos.github.io/runsesh/#/join/${CODE}`), CODE);
  eq(codeFromInput(`  ${CODE}  `), CODE);
  eq(codeFromInput(`https://evil.example/?code=${CODE}`), null);
  eq(codeFromInput('<img src=x onerror=1>'), null);
  eq(codeFromInput(''), null);
});

test('party names: trimmed, 2 to 30 characters', () => {
  eq([cleanPartyName('  Lunch Runners '), cleanPartyName('A'), cleanPartyName('x'.repeat(31)), cleanPartyName(null)], ['Lunch Runners', null, null, null]);
});
