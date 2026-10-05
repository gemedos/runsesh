// Middle tab: Competition.
// - No party: create or join a party first.
// - Party without a competition: "Create or join a competition". The leader gets the create
//   button; members see that they are waiting for the leader (they take part automatically).
// - Running competition: themed header (or the leader's photo), details, live standings.
// - Always (in a party): calendar (tap a day: that day's competition and step ranking) and the
//   Hall of Fame.

import { backgroundUrl } from '../../data/competitionRepo.js';
import { loadStandings } from '../../data/competitionData.js';
import { dayStandings } from '../../rules/ranking.js';
import { getLeader, getPartyMembers, isLeader } from '../../state/store.js';
import { STRINGS } from '../../strings.js';
import { todayISO } from '../../util/date.js';
import { circusHeader, competitionMeta, standingsList, themedCardClass } from '../competitionBlock.js';
import { calendarCard, dayDetail, finishedOverall, hallOfFameCard } from '../competitionCalendar.js';
import { h, s } from '../dom.js';
import { partyGate } from './party.js';

const T = STRINGS.competition;

function gearIcon() {
  return s('svg', { class: 'btn-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    s('circle', { cx: 12, cy: 12, r: 3.2 }),
    s('path', { d: 'M12 2.8 V5.2 M12 18.8 V21.2 M2.8 12 H5.2 M18.8 12 H21.2 M5.5 5.5 L7.2 7.2 M16.8 16.8 L18.5 18.5 M5.5 18.5 L7.2 16.8 M16.8 7.2 L18.5 5.5' }),
  );
}

export async function renderCompetitionHub({ state, steps, navigate }) {
  const gate = partyGate(state, navigate);
  if (gate) return h('div', { class: 'page page-comp-hub' }, h('h1', { class: 'sr-only', text: T.hubTitle }), gate);

  const today = todayISO();
  const members = getPartyMembers(state);
  const meId = state.auth.userId;
  const leader = isLeader(state);
  const leaderName = (getLeader(state) || {}).name || T.leaderFallback;
  const competition = state.competition;

  let top;
  if (!competition) {
    top = h('section', { class: themedCardClass() },
      circusHeader(),
      h('h2', { class: 'card-title', text: T.createOrJoin }),
      h('p', { class: 'hint', text: leader ? T.leaderEmpty : T.memberEmpty(leaderName) }),
      leader
        ? h('a', { class: 'btn btn-primary', attrs: { href: '#/profile/competition' }, text: T.create })
        : null,
    );
  } else {
    const [photo, standings] = await Promise.all([
      backgroundUrl(competition.backgroundPath),
      loadStandings(competition, members, steps, today),
    ]);
    top = h('div', { class: 'section' },
      h('section', { class: themedCardClass(competition.theme) },
        circusHeader(competition.theme, photo),
        competitionMeta(competition, today),
        h('p', { class: 'hint', text: T.autoJoin }),
      ),
      h('section', { class: 'section' },
        h('h2', { class: 'section-title', text: T.standingsTitle }),
        standingsList(competition, standings, members),
        h('p', { class: 'hint', text: T.mockRulesHint }),
      ),
      h('div', { class: 'hub-actions' },
        h('a', { class: 'btn btn-pill', attrs: { href: '#/profile/competition' } }, gearIcon(), h('span', { text: leader ? T.settingsButton : T.rulesButton })),
      ),
    );
  }

  const all = competition ? [competition, ...state.history] : [...state.history];
  const calendar = calendarCard({
    competitions: all,
    today,
    renderDetail: async (c, day) => {
      const overall = c.finished
        ? finishedOverall(c, state.results[c.id], meId)
        : h('div', { class: 'cal-overall' },
          h('h5', { class: 'cal-sub-title', text: T.overallLive }),
          standingsList(c, await loadStandings(c, members, steps, today), members));
      if (day > today) return dayDetail({ competition: c, day, today, rows: null, overall });
      return dayDetail({ competition: c, day, today, rows: await loadDayRows(c, day), overall });
    },
  });

  /**
   * Everyone who took part, with their steps on `day`. Finished competitions use the frozen
   * participant list; people who have since left the party cannot be read any more (RLS),
   * so they are listed as "left the party" instead of 0 steps.
   */
  async function loadDayRows(c, day) {
    const current = new Map(members.map((m) => [m.id, m]));
    const people = c.finished && (state.results[c.id] || []).length
      ? state.results[c.id].map((r) => ({ id: r.id, name: r.name, avatar: r.avatar, isMe: r.id === meId, left: !current.has(r.id) }))
      : members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, isMe: m.isMe, left: false }));
    const readable = people.filter((p) => !p.left);
    const values = await Promise.all(readable.map((p) => steps.getStepsForDay(p.id, day)));
    const stepsById = Object.fromEntries(readable.map((p, i) => [p.id, values[i]]));
    const ranked = dayStandings({ mode: c.mode, stepsById, memberIds: readable.map((p) => p.id), dayDone: day < today });
    const byId = new Map(people.map((p) => [p.id, p]));
    return [
      ...ranked.map((r) => ({ ...byId.get(r.id), ...r })),
      ...people.filter((p) => p.left).map((p) => ({ ...p, value: 0, rank: ranked.length + 1, points: 0, wonDay: false })),
    ];
  }

  return h('div', { class: 'page page-comp-hub' },
    h('h1', { class: 'sr-only', text: T.hubTitle }),
    top,
    calendar,
    hallOfFameCard({ history: state.history, results: state.results, meId }),
  );
}
