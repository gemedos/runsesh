// Middle tab: Competition.
// - No party: create or join a party first.
// - Party without a competition: "Create or join a competition". The leader gets the create
//   button; members see that they are waiting for the leader (they take part automatically).
// - Running competition: themed header (or the leader's photo), details, live standings.
// - Always (in a party): calendar of past competitions and the Hall of Fame.

import { backgroundUrl } from '../../data/competitionRepo.js';
import { loadStandings } from '../../data/competitionData.js';
import { getLeader, getPartyMembers, isLeader } from '../../state/store.js';
import { STRINGS } from '../../strings.js';
import { todayISO } from '../../util/date.js';
import { circusHeader, competitionMeta, standingsList, themedCardClass } from '../competitionBlock.js';
import { calendarCard, finishedDetail, hallOfFameCard } from '../competitionCalendar.js';
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
    renderDetail: async (c) => {
      if (c.finished) return finishedDetail(c, state.results[c.id], meId);
      const live = await loadStandings(c, members, steps, today);
      return h('div', { class: 'cal-result' },
        h('h4', { class: 'cal-result-title', text: T.liveTitle(c.name) }),
        standingsList(c, live, members),
      );
    },
  });

  return h('div', { class: 'page page-comp-hub' },
    h('h1', { class: 'sr-only', text: T.hubTitle }),
    top,
    calendar,
    hallOfFameCard({ history: state.history, results: state.results, meId }),
  );
}
