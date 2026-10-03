// Competition calendar (month grid) and Hall of Fame.
// Days covered by a competition are highlighted; tapping one shows that competition:
// frozen results for finished ones, live standings for the running one.

import { STRINGS } from '../strings.js';
import { formatDate, parseISODate, toISODate } from '../util/date.js';
import { resultsList } from './competitionBlock.js';
import { card, rankedAvatar } from './components.js';
import { h } from './dom.js';

const T = STRINGS.competition;

/** The competition (if any) covering an ISO day. Open-ended ones run until today. */
function competitionOn(day, competitions, today) {
  return competitions.find((c) => day >= c.start && day <= (c.end || today)) || null;
}

/**
 * @param {object} opts
 * @param {object[]} opts.competitions active (if any) + finished competitions
 * @param {string} opts.today 'YYYY-MM-DD'
 * @param {(competition: object) => Promise<Node>|Node} opts.renderDetail
 */
export function calendarCard({ competitions, today, renderDetail }) {
  const todayDate = parseISODate(today);
  let month = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  let selectedId = null;

  const title = h('h3', { class: 'cal-month' });
  const grid = h('div', { class: 'cal-grid', attrs: { role: 'grid' } });
  const detail = h('div', { class: 'cal-detail', attrs: { 'aria-live': 'polite' } });

  async function select(competition) {
    selectedId = competition.id;
    draw();
    detail.replaceChildren(h('p', { class: 'hint', text: STRINGS.party.loading }));
    const node = await renderDetail(competition);
    if (detail.isConnected && selectedId === competition.id) detail.replaceChildren(node);
  }

  function draw() {
    title.textContent = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const cells = T.weekdays.map((d) => h('span', { class: 'cal-weekday', text: d, attrs: { role: 'columnheader' } }));
    const lead = (month.getDay() + 6) % 7; // Monday first
    for (let i = 0; i < lead; i += 1) cells.push(h('span', { class: 'cal-blank' }));
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= days; d += 1) {
      const iso = toISODate(new Date(month.getFullYear(), month.getMonth(), d));
      const comp = competitionOn(iso, competitions, today);
      const cls = ['cal-day'];
      if (iso === today) cls.push('cal-day--today');
      if (comp) cls.push(comp.finished ? 'cal-day--past' : 'cal-day--active');
      if (comp && comp.id === selectedId) cls.push('cal-day--selected');
      const label = T.dayLabel(formatDate(iso), comp ? comp.name : null);
      cells.push(comp
        ? h('button', { class: cls.join(' '), text: String(d), attrs: { type: 'button', 'aria-label': label }, on: { click: () => select(comp) } })
        : h('span', { class: cls.join(' '), text: String(d), attrs: { 'aria-label': label } }));
    }
    grid.replaceChildren(...cells);
  }

  const nav = (delta, label, symbol) => h('button', {
    class: 'cal-nav', text: symbol, attrs: { type: 'button', 'aria-label': label },
    on: { click: () => { month = new Date(month.getFullYear(), month.getMonth() + delta, 1); draw(); } },
  });

  draw();
  return card(T.calendarTitle,
    h('div', { class: 'cal-head' }, nav(-1, T.prevMonth, '‹'), title, nav(1, T.nextMonth, '›')),
    grid,
    h('p', { class: 'hint', text: T.calendarHint }),
    detail,
  );
}

/** Detail view for a finished competition. */
export function finishedDetail(competition, results, meId) {
  return h('div', { class: 'cal-result' },
    h('h4', { class: 'cal-result-title', text: T.resultsTitle(competition.name) }),
    h('p', { class: 'comp-dates', text: T.datesRange(formatDate(competition.start), formatDate(competition.end || competition.start)) }),
    resultsList(competition, results, meId),
  );
}

/** Hall of Fame: winners of every finished competition, plus the user's own best. */
export function hallOfFameCard({ history, results, meId }) {
  const mine = history
    .map((c) => ({ c, row: (results[c.id] || []).find((r) => r.id === meId) }))
    .filter((x) => x.row)
    .sort((a, b) => a.row.rank - b.row.rank);

  const top = mine.length
    ? h('p', { class: 'hall-you', text: T.hallYourBest(STRINGS.common.ordinal(mine[0].row.rank), mine[0].c.name) })
    : h('p', { class: 'hall-you hall-you--empty', text: T.hallYou });

  const list = history.length
    ? h('ul', { class: 'hall-list' }, history.map((c) => {
      const winners = (results[c.id] || []).filter((r) => r.rank === 1);
      const names = winners.map((w) => w.name || T.someone).join(', ');
      return h('li', { class: 'hall-row' },
        winners[0] ? rankedAvatar(winners[0].avatar, 1) : null,
        h('span', { class: 'rank-main' },
          h('span', { class: 'rank-name', text: c.name }),
          h('span', { class: 'rank-sub', text: winners.length ? T.hallWinner(names) : T.noResults }),
        ),
        h('span', { class: 'rank-score', text: formatDate(c.end || c.start) }),
      );
    }))
    : h('p', { class: 'hint', text: T.hallEmpty });

  return card(T.hallTitle, top, list);
}
