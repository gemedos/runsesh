// Invite code taken from an opened invite link (#/join/CODE). Kept in memory only, never in
// storage (CLAUDE.md invite-code exception). It survives the trip through the login screen
// within the same tab; after a reload the user simply opens the link again.

import { INVITE_CODE_RE } from '../data/partyRepo.js';

let pending = null;

/**
 * If the address bar holds an invite link, remember the code and remove it from the address
 * bar right away (replacing the history entry). Returns true if the hash was an invite link.
 */
export function captureInviteFromHash() {
  const match = /^#\/join\/([^/?#]*)$/.exec(location.hash);
  if (!match) return false;
  pending = INVITE_CODE_RE.test(match[1]) ? match[1] : 'invalid';
  location.replace('#/join');
  return true;
}

/** Pulls a code out of a pasted link or a bare code. */
export function codeFromInput(text) {
  const value = String(text || '').trim();
  const fromLink = /#\/join\/([A-Za-z0-9_-]{24})\s*$/.exec(value);
  const code = fromLink ? fromLink[1] : value;
  return INVITE_CODE_RE.test(code) ? code : null;
}

export function getPendingInvite() {
  return pending;
}

export function clearPendingInvite() {
  pending = null;
}
