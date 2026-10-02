// Small shared UI pieces.

import { buildAvatarSvg } from '../avatar/avatar.js';
import { STRINGS } from '../strings.js';
import { h, s } from './dom.js';

/** Header for sub-screens with a back link to the parent hash route. */
export function screenHeader(title, backRoute = 'profile') {
  return h('div', { class: 'screen-header' },
    h('a', { class: 'back-link', attrs: { href: `#/${backRoute}`, 'aria-label': STRINGS.app.back } }, '‹'),
    h('h1', { class: 'screen-title', text: title }),
  );
}

/** Teal call-out card: icon circle, bold title, teal subtitle. */
export function notConnectedBanner(detail = STRINGS.common.notConnectedDefault) {
  const plug = s('svg', { class: 'callout-svg', viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    s('path', { d: 'M9 3 V8 M15 3 V8' }),
    s('path', { d: 'M6 8 H18 V11 A6 6 0 0 1 6 11 Z' }),
    s('path', { d: 'M12 17 V21' }),
  );
  return h('div', { class: 'callout', attrs: { role: 'note' } },
    h('span', { class: 'callout-icon' }, plug),
    h('span', { class: 'callout-text' },
      h('strong', { class: 'callout-title', text: STRINGS.common.notConnectedTitle }),
      h('span', { class: 'callout-sub', text: detail }),
    ),
  );
}

/** Round head close-up of an avatar. */
export function avatarBadge(avatar, { size = 'md', label } = {}) {
  return h('span', { class: `avatar-badge avatar-badge--${size}` }, buildAvatarSvg(avatar, { crop: true, label }));
}

const RANK_CLASS = { 1: 'rank--gold', 2: 'rank--silver', 3: 'rank--copper' };

/** Rank sticker: a starburst with "1st"/"2nd"/"3rd" in gold/silver/copper, a small chip otherwise. */
export function rankBadge(rank) {
  const medal = RANK_CLASS[rank];
  return h('span', { class: `rank ${medal || 'rank--plain'}`, attrs: { 'aria-label': STRINGS.common.rank(rank) } },
    medal ? h('span', { class: 'rank-burst' }, h('span', { class: 'rank-text', text: STRINGS.common.ordinal(rank) })) : String(rank),
  );
}

/** Round avatar with its rank sticker overlapping the top-left corner. */
export function rankedAvatar(avatar, rank) {
  return h('span', { class: 'ranked-avatar' }, avatarBadge(avatar, { size: 'lg' }), rankBadge(rank));
}

export function card(title, ...children) {
  return h('section', { class: 'card' }, title ? h('h2', { class: 'card-title', text: title }) : null, ...children);
}

export function formatSteps(n) {
  return n.toLocaleString();
}
