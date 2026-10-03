// Middle tab: Competition. Shows the active competition (themed header, details,
// standings) that used to sit at the bottom of the Race page.

import { loadStandings } from '../../data/competitionData.js';
import { getActiveCompetition, getCompetitionTheme, getPartyMembers } from '../../state/store.js';
import { STRINGS } from '../../strings.js';
import { todayISO } from '../../util/date.js';
import { circusHeader, competitionMeta, standingsList, themedCardClass } from '../competitionBlock.js';
import { h, s } from '../dom.js';

const T = STRINGS.competition;

function gearIcon() {
  return s('svg', { class: 'btn-icon', viewBox: '0 0 24 24', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    s('circle', { cx: 12, cy: 12, r: 3.2 }),
    s('path', { d: 'M12 2.8 V5.2 M12 18.8 V21.2 M2.8 12 H5.2 M18.8 12 H21.2 M5.5 5.5 L7.2 7.2 M16.8 16.8 L18.5 18.5 M5.5 18.5 L7.2 16.8 M16.8 7.2 L18.5 5.5' }),
  );
}

export async function renderCompetitionHub({ state, steps }) {
  const today = todayISO();
  const members = getPartyMembers(state);
  const competition = getActiveCompetition(state);
  const settings = h('a', { class: 'btn btn-pill', attrs: { href: '#/profile/competition' } }, gearIcon(), h('span', { text: T.settingsButton }));

  if (!competition) {
    return h('div', { class: 'page page-comp-hub' },
      h('h1', { class: 'sr-only', text: T.hubTitle }),
      h('section', { class: themedCardClass() },
        circusHeader(),
        h('p', { class: 'empty', text: T.none }),
        h('a', { class: 'btn btn-primary', attrs: { href: '#/profile/competition' }, text: T.create }),
      ),
    );
  }

  const theme = getCompetitionTheme(competition, state);
  const standings = await loadStandings(competition, members, steps, today);

  return h('div', { class: 'page page-comp-hub' },
    h('h1', { class: 'sr-only', text: T.hubTitle }),
    h('section', { class: themedCardClass(theme) },
      circusHeader(theme),
      competitionMeta(competition, today),
    ),
    h('section', { class: 'section' },
      h('h2', { class: 'section-title', text: T.standingsTitle }),
      standingsList(competition, standings, members),
      h('p', { class: 'hint', text: T.mockRulesHint }),
    ),
    h('div', { class: 'hub-actions' }, settings),
  );
}
