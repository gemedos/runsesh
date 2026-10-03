// Themed competition header and standings list (Competition page and settings screen).

import { DEFAULT_AVATAR } from '../avatar/avatar.js';
import { DEFAULT_COMPETITION_THEME, isCompetitionTheme } from '../state/competition.js';
import { STRINGS } from '../strings.js';
import { formatDate } from '../util/date.js';
import { formatSteps, rankedAvatar } from './components.js';
import { h } from './dom.js';

const T = STRINGS.competition;

// Theme -> header artwork (constants; the theme itself is validated against the whitelist).
export const THEME_ART = Object.freeze({
  circus: 'img/circus.svg',
  spring: 'img/comp-spring.svg',
  summer: 'img/comp-summer.svg',
  fall: 'img/comp-fall.svg',
  winter: 'img/comp-winter.svg',
});

const safeTheme = (theme) => (isCompetitionTheme(theme) ? theme : DEFAULT_COMPETITION_THEME);

/**
 * Header art with the red COMPETITION label on top. `photoUrl` (the leader's own background,
 * a short-lived signed Supabase Storage URL) replaces the theme picture when present.
 */
export function circusHeader(theme = DEFAULT_COMPETITION_THEME, photoUrl = null) {
  const t = safeTheme(theme);
  const art = photoUrl
    ? h('img', { class: 'circus-art circus-photo', attrs: { src: photoUrl, alt: '', referrerpolicy: 'no-referrer' } })
    : h('img', { class: 'circus-art', attrs: { src: THEME_ART[t], alt: '' } });
  return h('div', { class: 'circus' }, art, h('span', { class: 'circus-label', text: T.banner }));
}

/** Class names for a themed competition card. */
export function themedCardClass(theme) {
  return `card card--circus comp-theme--${safeTheme(theme)}`;
}

export function scoreLabel(mode, value) {
  if (mode === 'days_won') return T.scoreDaysWon(value);
  if (mode === 'points_321') return T.scorePoints(value);
  return T.scoreSteps(formatSteps(value));
}

export function competitionMeta(competition, today) {
  const dates = competition.end
    ? T.datesRange(formatDate(competition.start), formatDate(competition.end))
    : T.datesOpen(formatDate(competition.start));
  let status = T.statusRunning;
  if (competition.start > today) status = T.statusNotStarted;
  else if (competition.end && competition.end < today) status = T.statusFinished;

  return h('div', { class: 'comp-meta' },
    h('h3', { class: 'comp-name', text: competition.name }),
    h('p', { class: 'comp-dates', text: dates }),
    h('div', { class: 'comp-tags' },
      h('span', { class: 'tag', text: status }),
      h('span', { class: 'tag', text: T.modes[competition.mode] }),
      competition.golden ? h('span', { class: 'tag tag--gold', text: T.goldenReward }) : null,
    ),
  );
}

/** Live standings of the active competition (rows: {id, value, rank}). */
export function standingsList(competition, standings, members) {
  const byId = new Map(members.map((m) => [m.id, m]));
  return h('ol', { class: 'ranking' },
    standings.map((row) => {
      const m = byId.get(row.id);
      if (!m) return null;
      return h('li', { class: `rank-row${m.isMe ? ' rank-row--me' : ''}` },
        rankedAvatar(m.avatar, row.rank),
        h('span', { class: 'rank-name', text: m.name || STRINGS.members.unnamed }),
        h('span', { class: 'rank-score', text: scoreLabel(competition.mode, row.value) }),
      );
    }),
  );
}

/** Frozen results of a finished competition (rows carry their own name/avatar snapshot). */
export function resultsList(competition, results, meId) {
  if (!results || !results.length) return h('p', { class: 'hint', text: T.noResults });
  return h('ol', { class: 'ranking' },
    results.map((row) => h('li', { class: `rank-row${row.id === meId ? ' rank-row--me' : ''}` },
      rankedAvatar(row.avatar || DEFAULT_AVATAR, row.rank),
      h('span', { class: 'rank-name', text: row.name || T.someone }),
      h('span', { class: 'rank-score', text: scoreLabel(competition.mode, row.value) }),
    )),
  );
}
