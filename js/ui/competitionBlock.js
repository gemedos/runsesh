// Circus-style competition header and standings list (used on Race and Competition screens).

import { RANKING_MODE_LABELS } from '../rules/ranking.js';
import { formatDate } from '../util/date.js';
import { avatarBadge, formatSteps, rankBadge } from './components.js';
import { h } from './dom.js';

export function circusHeader() {
  return h('div', { class: 'circus' },
    h('img', { class: 'circus-art', attrs: { src: 'img/circus.svg', alt: '' } }),
    h('span', { class: 'circus-label', text: 'COMPETITION' }),
  );
}

export function scoreLabel(mode, value) {
  if (mode === 'days_won') return `${value} ${value === 1 ? 'day' : 'days'} won`;
  if (mode === 'points_321') return `${value} pts`;
  return `${formatSteps(value)} steps`;
}

export function competitionMeta(competition, today) {
  const dates = competition.end
    ? `${formatDate(competition.start)} – ${formatDate(competition.end)}`
    : `From ${formatDate(competition.start)} (no end date)`;
  let status = 'Running';
  if (competition.start > today) status = 'Not started';
  else if (competition.end && competition.end < today) status = 'Finished';

  return h('div', { class: 'comp-meta' },
    h('h3', { class: 'comp-name', text: competition.name }),
    h('p', { class: 'comp-dates', text: dates }),
    h('div', { class: 'comp-tags' },
      h('span', { class: 'tag', text: status }),
      h('span', { class: 'tag', text: RANKING_MODE_LABELS[competition.mode] }),
      competition.golden ? h('span', { class: 'tag tag--gold', text: 'Golden reward' }) : null,
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
        rankBadge(row.rank),
        avatarBadge(m.avatar, { size: 'sm' }),
        h('span', { class: 'rank-name', text: m.name }),
        h('span', { class: 'rank-score', text: scoreLabel(competition.mode, row.value) }),
      );
    }),
  );
}
