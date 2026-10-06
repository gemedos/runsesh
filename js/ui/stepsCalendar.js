// Profile calendar (docs/design.md §11, inspo "profile structure"): one player's own steps day by
// day, regardless of parties or competitions. Sunday first; each day is a small number above a
// circle:
//   lock   day before the account existed        empty  future day or no steps
//   "?"    today (still running)                 ring   progress towards the daily goal
// The daily goal (10,000 steps) is shown ONLY here, by the owner's choice.
// Tapping a past day or today shows a summary under the calendar.

import { fetchStepHistory } from '../steps/sync.js';
import { STRINGS } from '../strings.js';
import { formatDate, parseISODate, toISODate } from '../util/date.js';
import { rankBadge } from './components.js';
import { h, s } from './dom.js';

const T = STRINGS.profileCalendar;
export const DAILY_GOAL = 10000;
const RING_R = 21;
const RING_LEN = 2 * Math.PI * RING_R;

/** "8.4k" style short count for inside the circle. */
export function shortSteps(n) {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

function lockIcon() {
  return s('svg', { class: 'sc-lock', viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    s('rect', { x: 5, y: 10.5, width: 14, height: 10, rx: 3 }),
    s('path', { d: 'M8.5 10.5 V8 A3.5 3.5 0 0 1 15.5 8 V10.5' }),
  );
}

function ring(fraction) {
  const f = Math.max(0, Math.min(1, fraction));
  return s('svg', { class: 'sc-ring', viewBox: '0 0 48 48', 'aria-hidden': 'true' },
    s('circle', { class: 'sc-ring-track', cx: 24, cy: 24, r: RING_R }),
    f > 0 ? s('circle', {
      class: 'sc-ring-fill', cx: 24, cy: 24, r: RING_R,
      'stroke-dasharray': `${(RING_LEN * f).toFixed(2)} ${RING_LEN.toFixed(2)}`,
      transform: 'rotate(-90 24 24)',
    }) : null,
  );
}

/**
 * @param {object} opts
 * @param {string} opts.userId whose steps (own, or a party member's; RLS decides)
 * @param {string|null} opts.joinedDay 'YYYY-MM-DD' the account was created (earlier days are locked)
 * @param {string} opts.today
 * @param {(day: string, steps: number) => Promise<Node>|Node} opts.renderSummary
 * @param {(days: string[]) => Promise<Map<string, number>>} [opts.ranksFor] day → place (friends, later)
 */
export function stepsCalendar({ userId, joinedDay, today, renderSummary, ranksFor }) {
  const todayDate = parseISODate(today);
  let month = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  let selected = null;
  let drawSeq = 0;
  const cache = new Map(); // 'YYYY-MM' -> Map(day -> steps)

  const title = h('h3', { class: 'sc-month' });
  const grid = h('div', { class: 'sc-grid', attrs: { role: 'grid', 'aria-busy': 'true' } });
  const summary = h('div', { class: 'sc-summary', attrs: { 'aria-live': 'polite' } });

  async function monthData(first, last) {
    const key = first.slice(0, 7);
    if (!cache.has(key)) {
      const rows = await fetchStepHistory(userId, first, last).catch(() => null);
      if (!rows) return null;
      cache.set(key, new Map(rows.map((r) => [r.day, r.steps])));
    }
    return cache.get(key);
  }

  async function select(day, steps) {
    selected = day;
    for (const btn of grid.querySelectorAll('.sc-day[aria-pressed]')) btn.setAttribute('aria-pressed', btn.dataset.day === day ? 'true' : 'false');
    summary.replaceChildren(h('p', { class: 'hint', text: STRINGS.party.loading }));
    let node;
    try {
      node = await renderSummary(day, steps);
    } catch {
      node = h('p', { class: 'hint', text: T.dayFailed });
    }
    if (summary.isConnected && selected === day) summary.replaceChildren(node);
  }

  async function draw() {
    const seq = ++drawSeq;
    title.textContent = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const first = toISODate(month);
    const last = toISODate(new Date(month.getFullYear(), month.getMonth(), daysInMonth));
    grid.setAttribute('aria-busy', 'true');

    const data = first > today ? new Map() : await monthData(first, last);
    const days = [];
    for (let d = 1; d <= daysInMonth; d += 1) days.push(toISODate(new Date(month.getFullYear(), month.getMonth(), d)));
    const ranks = ranksFor && data ? await ranksFor(days.filter((d) => d <= today)).catch(() => new Map()) : new Map();
    if (seq !== drawSeq) return; // a newer month was requested meanwhile

    const cells = T.weekdays.map((w) => h('span', { class: 'sc-weekday', text: w, attrs: { role: 'columnheader' } }));
    const lead = month.getDay(); // Sunday first
    for (let i = 0; i < lead; i += 1) cells.push(h('span', { class: 'sc-blank' }));

    for (const day of days) {
      const n = Number(day.slice(8));
      const steps = data ? data.get(day) || 0 : 0;
      const isToday = day === today;
      const future = day > today;
      // Before the account existed, unless steps were added for that day (e.g. by the admin).
      const locked = !future && joinedDay && day < joinedDay && !steps;
      const rank = ranks.get(day);
      const goal = !future && !locked && steps >= DAILY_GOAL;

      let inner;
      if (locked) inner = h('span', { class: 'sc-dot sc-dot--lock' }, lockIcon());
      else if (future) inner = h('span', { class: 'sc-dot' });
      else {
        const face = isToday && !steps
          ? h('span', { class: 'sc-face sc-face--q', text: '?' })
          : rank && steps > 0
            ? h('span', { class: 'sc-face' }, rankBadge(rank))
            : h('span', { class: 'sc-face', text: steps > 0 ? shortSteps(steps) : '' });
        inner = h('span', { class: `sc-dot${goal ? ' sc-dot--goal' : ''}${steps > 0 ? ' sc-dot--steps' : ''}` }, ring(steps / DAILY_GOAL), face);
      }

      const label = locked ? T.dayLocked(formatDate(day))
        : future ? formatDate(day)
          : T.dayLabel(formatDate(day), steps.toLocaleString(), isToday);
      const number = h('span', { class: `sc-num${isToday ? ' sc-num--today' : ''}`, text: String(n) });
      cells.push(locked || future
        ? h('span', { class: 'sc-day', attrs: { 'aria-label': label } }, number, inner)
        : h('button', {
          class: 'sc-day', attrs: { type: 'button', 'aria-label': label, 'aria-pressed': day === selected ? 'true' : 'false' },
          dataset: { day },
          on: { click: () => select(day, steps) },
        }, number, inner));
    }
    grid.replaceChildren(...cells);
    grid.setAttribute('aria-busy', 'false');
    if (!data) summary.replaceChildren(h('p', { class: 'hint', text: T.monthFailed }));
  }

  const nav = (delta, label, symbol) => h('button', {
    class: 'sc-nav', text: symbol, attrs: { type: 'button', 'aria-label': label },
    on: { click: () => { month = new Date(month.getFullYear(), month.getMonth() + delta, 1); draw(); } },
  });

  const node = h('div', { class: 'sc' },
    h('div', { class: 'sc-head' }, title, h('span', { class: 'sc-navs' }, nav(-1, T.prevMonth, '‹'), nav(1, T.nextMonth, '›'))),
    h('div', { class: 'sc-card' }, grid),
    summary,
  );
  draw();
  return node;
}
