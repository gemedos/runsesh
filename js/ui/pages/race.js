// Page 1: Race.

import { loadStandings } from '../../data/competitionData.js';
import { rankDay } from '../../rules/ranking.js';
import { getActiveCompetition, getPartyMembers } from '../../state/store.js';
import { STRINGS } from '../../strings.js';
import { todayISO } from '../../util/date.js';
import { circusHeader, competitionMeta, standingsList } from '../competitionBlock.js';
import { avatarBadge, card, formatSteps, rankedAvatar } from '../components.js';
import { h, onMount, s } from '../dom.js';
import { iosInstallHint } from '../installHint.js';

const TRACK_WIDTH = 1600;
const TRACK_PAD = 70;
const LANE_TOPS = [14, 66, 118];
const T = STRINGS.race;

export async function renderRace({ state, steps }) {
  const today = todayISO();
  const members = getPartyMembers(state);
  const todaySteps = await Promise.all(members.map((m) => steps.getStepsForDay(m.id, today)));
  const stepsById = Object.fromEntries(members.map((m, i) => [m.id, todaySteps[i]]));
  const ranking = rankDay(stepsById, members.map((m) => m.id));
  const goal = state.partyRules.dailyGoal;

  const competition = getActiveCompetition(state);
  const standings = competition ? await loadStandings(competition, members, steps, today) : null;

  return h('div', { class: 'page page-race' },
    iosInstallHint(),
    partyBar(state, members),
    myStepsHero(stepsById[state.meId] || 0),
    trackCard(members, ranking, goal),
    dailyRankingCard(members, ranking, goal),
    competitionCard(competition, standings, members, today),
  );
}

function partyBar(state, members) {
  return h('section', { class: 'party-bar' },
    h('a', { class: 'btn btn-primary', attrs: { href: '#/race/create-party' }, text: T.createParty }),
    h('div', { class: 'party-members', attrs: { 'aria-label': T.partyMembers(state.party.name) } },
      members.map((m) => h('span', { class: 'party-member' },
        avatarBadge(m.avatar, { size: 'md' }),
        h('span', { class: 'party-member-name', text: m.name }),
      )),
    ),
  );
}

function myStepsHero(mySteps) {
  return h('section', { class: 'steps-hero' },
    h('span', { class: 'steps-hero-number', text: formatSteps(mySteps) }),
    h('span', { class: 'steps-hero-label', text: T.yourSteps }),
    s('svg', { class: 'squiggle', viewBox: '0 0 130 12', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round' },
      s('path', { d: 'M3 6 Q11 0 19 6 T35 6 T51 6 T67 6 T83 6 T99 6 T115 6 T127 6' }),
    ),
  );
}

function trackCard(members, ranking, goal) {
  const top = ranking.length ? ranking[0].value : 0;
  const scaleMax = Math.max(goal * 1.2, top * 1.08);
  const xFor = (value) => TRACK_PAD + (value / scaleMax) * (TRACK_WIDTH - 2 * TRACK_PAD);
  const byId = new Map(members.map((m) => [m.id, m]));

  const track = h('div', { class: 'track' });
  track.style.width = `${TRACK_WIDTH}px`;

  for (let v = 0; v <= scaleMax; v += 2000) {
    const tick = h('span', { class: 'track-tick', text: v === 0 ? T.trackStart : T.trackTick(v / 1000) });
    tick.style.left = `${xFor(v)}px`;
    track.append(tick);
  }

  const flag = h('span', { class: 'track-goal' }, h('span', { class: 'track-goal-label', text: T.goal(formatSteps(goal)) }));
  flag.style.left = `${xFor(goal)}px`;
  track.append(flag);

  let meMarker = null;
  const markers = [];
  // Draw the leader last so it sits on top.
  [...ranking].reverse().forEach((row) => {
    const m = byId.get(row.id);
    const lane = ranking.indexOf(row) % LANE_TOPS.length;
    const marker = h('button', {
      class: `runner${m.isMe ? ' runner--me' : ''}`,
      attrs: { type: 'button', 'aria-label': T.runnerLabel(m.name, formatSteps(row.value)) },
    },
    avatarBadge(m.avatar, { size: 'sm' }),
    h('span', { class: 'runner-label' }, h('b', { text: m.name }), ` ${formatSteps(row.value)}`),
    );
    marker.style.left = `${xFor(row.value)}px`;
    marker.style.top = `${LANE_TOPS[lane]}px`;
    marker.addEventListener('click', () => {
      const wasOpen = marker.classList.contains('is-open');
      markers.forEach((el) => el.classList.remove('is-open'));
      if (!wasOpen) marker.classList.add('is-open');
    });
    if (m.isMe) meMarker = marker;
    markers.push(marker);
    track.append(marker);
  });

  const scroller = h('div', { class: 'track-scroll', attrs: { tabindex: '0', 'aria-label': T.trackLabel } }, track);
  enableMouseDrag(scroller);

  const node = card(T.trackTitle, scroller, h('p', { class: 'hint', text: T.trackHint }));
  onMount(node, () => requestAnimationFrame(() => {
    if (meMarker) scroller.scrollLeft = Math.max(0, meMarker.offsetLeft - scroller.clientWidth / 2);
  }));
  return node;
}

/** Touch already scrolls natively; this adds click-and-drag for mouse users. */
function enableMouseDrag(scroller) {
  let startX = 0;
  let startScroll = 0;
  let dragging = false;
  scroller.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    dragging = true;
    startX = e.clientX;
    startScroll = scroller.scrollLeft;
  });
  scroller.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    scroller.scrollLeft = startScroll - (e.clientX - startX);
  });
  const stop = () => { dragging = false; };
  scroller.addEventListener('pointerup', stop);
  scroller.addEventListener('pointerleave', stop);
}

function dailyRankingCard(members, ranking, goal) {
  const byId = new Map(members.map((m) => [m.id, m]));
  return card(T.todayTitle,
    h('ol', { class: 'ranking' },
      ranking.map((row) => {
        const m = byId.get(row.id);
        const fill = h('span', { class: 'progress-fill' });
        fill.style.width = `${Math.min(100, (row.value / goal) * 100)}%`;
        return h('li', { class: `rank-row${m.isMe ? ' rank-row--me' : ''}` },
          rankedAvatar(m.avatar, row.rank),
          h('span', { class: 'rank-main' },
            h('span', { class: 'rank-name', text: m.name }),
            h('span', { class: 'progress', attrs: { 'aria-hidden': 'true' } }, fill),
          ),
          h('span', { class: 'rank-score', text: STRINGS.common.steps(formatSteps(row.value)) }),
        );
      }),
    ),
  );
}

function competitionCard(competition, standings, members, today) {
  if (!competition) {
    return h('section', { class: 'card card--circus' },
      circusHeader(),
      h('p', { class: 'empty', text: STRINGS.competition.none }),
      h('a', { class: 'btn btn-primary', attrs: { href: '#/profile/competition' }, text: STRINGS.competition.create }),
    );
  }
  return h('section', { class: 'card card--circus' },
    circusHeader(),
    competitionMeta(competition, today),
    standingsList(competition, standings, members),
    h('p', { class: 'hint', text: STRINGS.competition.mockRulesHint }),
  );
}
