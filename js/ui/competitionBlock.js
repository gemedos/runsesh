// Circus-style competition header and standings list (used on Race and Competition screens).

import { STRINGS } from '../strings.js';
import { formatDate } from '../util/date.js';
import { formatSteps, rankedAvatar } from './components.js';
import { h } from './dom.js';

const T = STRINGS.competition;

export function circusHeader() {
  return h('div', { class: 'circus' },
    h('img', { class: 'circus-art', attrs: { src: 'img/circus.svg', alt: '' } }),
    h('span', { class: 'circus-label', text: T.banner }),
  );
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

export function standingsList(competition, standings, members) {
  const byId = new Map(members.map((m) => [m.id, m]));
  return h('ol', { class: 'ranking' },
    standings.map((row) => {
      const m = byId.get(row.id);
      if (!m) return null;
      return h('li', { class: `rank-row${m.isMe ? ' rank-row--me' : ''}` },
        rankedAvatar(m.avatar, row.rank),
        h('span', { class: 'rank-name', text: m.name }),
        h('span', { class: 'rank-score', text: scoreLabel(competition.mode, row.value) }),
      );
    }),
  );
}
