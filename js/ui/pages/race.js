// Page 1: Race.
// Layout (see docs/design.md): party row → stage (night world + hero number + minimap)
// → rankings. The competition lives on its own tab (pages/competitionHub.js).

import { buildAvatarSvg } from '../../avatar/avatar.js';
import { rankDay } from '../../rules/ranking.js';
import { fetchDayForUsers } from '../../steps/sync.js';
import { getPartyMembers } from '../../state/store.js';
import { STRINGS } from '../../strings.js';
import { todayISO } from '../../util/date.js';
import { avatarBadge, formatSteps, rankBadge, rankedAvatar } from '../components.js';
import { h, onMount, s } from '../dom.js';
import { iosInstallHint } from '../installHint.js';
import { openProfile, personButton } from '../profileLink.js';
import { openSheet } from '../sheet.js';
import { partyGate } from './party.js';

const T = STRINGS.race;

// The world is one continuous path. Positions depend only on step counts.
const WORLD_WIDTH = 2400;
const WORLD_PAD = 150;
// Depth lanes: further back = higher on the path and smaller.
const LANES = [
  { bottom: 76, scale: 1, z: 30 },
  { bottom: 102, scale: 0.86, z: 20 },
  { bottom: 126, scale: 0.74, z: 10 },
];

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function renderRace({ state, steps, navigate }) {
  // Not in a party yet (or still loading): offer to create or join one.
  const gate = partyGate(state, navigate);
  if (gate) return h('div', { class: 'page page-race' }, iosInstallHint(), gate);

  const today = todayISO();
  const meId = state.auth.userId;
  const members = getPartyMembers(state);
  const todaySteps = await Promise.all(members.map((m) => steps.getStepsForDay(m.id, today)));
  const stepsById = Object.fromEntries(members.map((m, i) => [m.id, todaySteps[i]]));
  const ranking = rankDay(stepsById, members.map((m) => m.id));

  return h('div', { class: 'page page-race' },
    iosInstallHint(),
    partyBar(state, members),
    stage(members, ranking, stepsById[meId] || 0, meId, today),
    rankingsSection(members, ranking),
  );
}

/** Party row: "Invite friends" (every member may invite) followed by the members. */
function partyBar(state, members) {
  return h('section', { class: 'party-bar' },
    h('a', { class: 'btn btn-promo btn-compact', attrs: { href: '#/profile/members' } },
      h('span', { class: 'btn-plus', attrs: { 'aria-hidden': 'true' }, text: '+' }), h('span', { text: STRINGS.party.inviteButton })),
    h('div', { class: 'party-members', attrs: { 'aria-label': T.partyMembers(state.party.name) } },
      members.map((m) => personButton(m.id, STRINGS.profile.openProfile(m.isMe ? T.you : m.name || STRINGS.members.unnamed), [
        avatarBadge(m.avatar, { size: 'md' }),
        h('span', { class: 'party-member-name', text: m.isMe ? T.you : m.name || STRINGS.members.unnamed }),
      ], 'party-member')),
    ),
  );
}

// ---------------------------------------------------------------------------
// Stage: hero number + continuous world + minimap
// ---------------------------------------------------------------------------

/** Rounds up to a "nice" multiple of 1,000 steps so ticks land on round numbers. */
function scaleFor(ranking) {
  const top = ranking.length ? ranking[0].value : 0;
  return Math.max(6000, Math.ceil((top * 1.1) / 1000) * 1000);
}

function tickStep(scaleMax) {
  return scaleMax <= 12000 ? 2000 : scaleMax <= 24000 ? 4000 : 6000;
}

function stage(members, ranking, mySteps, meId, today) {
  const scaleMax = scaleFor(ranking);
  const xFor = (value) => WORLD_PAD + (Math.min(value, scaleMax) / scaleMax) * (WORLD_WIDTH - 2 * WORLD_PAD);
  const byId = new Map(members.map((m) => [m.id, m]));
  const step = tickStep(scaleMax);

  // --- the world -----------------------------------------------------------
  const track = h('div', { class: 'world-track' });
  track.style.width = `${WORLD_WIDTH}px`;
  track.append(h('span', { class: 'world-ground' }));

  const start = h('span', { class: 'world-start' }, h('span', { class: 'world-sign', text: T.trackStart }));
  start.style.left = `${xFor(0)}px`;
  track.append(start);
  for (let v = 1000; v <= scaleMax; v += 1000) {
    const post = h('span', { class: `world-post${v % step === 0 ? ' world-post--major' : ''}` },
      h('span', { class: 'world-sign', text: T.trackTick(v / 1000) }));
    post.style.left = `${xFor(v)}px`;
    track.append(post);
  }

  const runners = new Map();
  ranking.forEach((row, index) => {
    const m = byId.get(row.id);
    const lane = LANES[index % LANES.length];
    const runner = h('button', {
      class: `runner${m.isMe ? ' runner--me' : ''}`,
      attrs: { type: 'button', 'aria-label': T.runnerOpen(m.isMe ? T.you : m.name || STRINGS.members.unnamed, formatSteps(row.value)) },
      dataset: { id: m.id },
    },
    h('span', { class: 'runner-bubble' }, formatSteps(row.value), rankBadge(row.rank)),
    h('span', { class: 'runner-figure' }, buildAvatarSvg(m.avatar)),
    h('span', { class: 'runner-name', text: m.isMe ? T.you : m.name || STRINGS.members.unnamed }),
    );
    runner.style.left = `${xFor(row.value)}px`;
    runner.style.bottom = `${lane.bottom}px`;
    runner.style.zIndex = String(lane.z + (ranking.length - index));
    runner.style.setProperty('--s', String(lane.scale));
    runner.style.setProperty('--delay', `${(index * 0.17) % 1.1}s`);
    runners.set(m.id, runner);
    track.append(runner);
  });

  liftCrowdedBubbles(ranking, xFor, runners);

  const world = h('div', { class: 'world', attrs: { tabindex: '0', 'aria-label': T.trackLabel } }, track);

  // --- hero number over the sky ------------------------------------------------
  const number = h('span', { class: 'hero-number', text: formatSteps(mySteps) });
  const hero = h('div', { class: 'stage-hero', attrs: { 'aria-live': 'off' } },
    number,
    h('span', { class: 'hero-label', text: T.yourSteps }),
    s('svg', { class: 'squiggle', viewBox: '0 0 130 12', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round' },
      s('path', { d: 'M3 6 Q11 0 19 6 T35 6 T51 6 T67 6 T83 6 T99 6 T115 6 T127 6' })),
  );

  // --- minimap -----------------------------------------------------------------
  const pct = (x) => `${(x / WORLD_WIDTH) * 100}%`;
  const windowEl = h('span', { class: 'mm-window', attrs: { 'aria-hidden': 'true' } });
  const rail = h('div', { class: 'mm-rail' }, h('span', { class: 'mm-line', attrs: { 'aria-hidden': 'true' } }), windowEl);
  for (let v = step; v <= scaleMax; v += step) {
    const tick = h('span', { class: 'mm-tick', text: T.trackTick(v / 1000) });
    tick.style.left = pct(xFor(v));
    rail.append(tick);
  }
  const dots = new Map();
  [...ranking].reverse().forEach((row) => { // leader drawn last = on top
    const m = byId.get(row.id);
    const dot = h('button', {
      class: `mm-dot${m.isMe ? ' mm-dot--me' : ''}`,
      attrs: { type: 'button', 'aria-label': T.runnerLabel(m.isMe ? T.you : m.name || STRINGS.members.unnamed, formatSteps(row.value)) },
    }, avatarBadge(m.avatar, { size: 'sm' }));
    dot.style.left = pct(xFor(row.value));
    dot.addEventListener('click', () => focusRunner(m.id, true));
    dots.set(m.id, dot);
    rail.append(dot);
  });
  const minimap = h('div', { class: 'minimap', attrs: { role: 'group', 'aria-label': T.minimapLabel } }, rail);

  // --- behaviour -----------------------------------------------------------------
  let focusedId = null;
  function focusRunner(id, scroll) {
    if (!runners.has(id)) return;
    if (focusedId !== id) {
      runners.get(focusedId)?.classList.remove('is-focused');
      dots.get(focusedId)?.classList.remove('is-focused');
      focusedId = id;
      runners.get(id).classList.add('is-focused');
      dots.get(id).classList.add('is-focused');
    }
    if (scroll) {
      const left = runners.get(id).offsetLeft - world.clientWidth / 2;
      world.scrollTo({ left, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }

  function nearestToCenter() {
    const center = world.scrollLeft + world.clientWidth / 2;
    let best = null;
    let bestDist = Infinity;
    for (const [id, el] of runners) {
      const d = Math.abs(el.offsetLeft - center);
      if (d < bestDist) { best = id; bestDist = d; }
    }
    return best;
  }

  let frame = 0;
  function sync() {
    frame = 0;
    world.style.setProperty('--px', String(world.scrollLeft));
    windowEl.style.left = pct(world.scrollLeft);
    windowEl.style.width = pct(world.clientWidth);
    const id = nearestToCenter();
    if (id) focusRunner(id, false);
  }
  world.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(sync); }, { passive: true });
  const onResize = () => {
    if (!world.isConnected) { window.removeEventListener('resize', onResize); return; }
    if (!frame) frame = requestAnimationFrame(sync);
  };
  window.addEventListener('resize', onResize);

  // Tapping a runner opens their profile; runners standing on top of each other open a chooser
  // sheet first (inspo "on two runners collision choose profile pop up").
  for (const [id, runner] of runners) {
    runner.addEventListener('click', () => {
      const x = xFor(ranking.find((r) => r.id === id).value);
      const group = ranking.filter((r) => Math.abs(xFor(r.value) - x) < OVERLAP_PX);
      if (group.length > 1) runnerSheet(group, byId, today);
      else openProfile(id);
    });
  }
  enableMouseDrag(world);
  enableRailDrag(rail, world);

  const node = h('section', { class: 'stage' },
    h('div', { class: 'stage-view' }, world, hero, minimap),
  );
  onMount(node, () => requestAnimationFrame(() => {
    const me = runners.get(meId);
    if (me) world.scrollLeft = Math.max(0, me.offsetLeft - world.clientWidth / 2);
    sync();
    countUp(number, mySteps);
  }));
  return node;
}

/** Runners closer than this (world px) overlap on screen. */
const OVERLAP_PX = 44;

/** "5s", "12m", "3h", "2d" since an ISO timestamp. */
export function formatAgo(iso, now = Date.now()) {
  const sec = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (!Number.isFinite(sec)) return '';
  if (sec < 60) return T.agoSeconds(sec);
  if (sec < 3600) return T.agoMinutes(Math.floor(sec / 60));
  if (sec < 86400) return T.agoHours(Math.floor(sec / 3600));
  return T.agoDays(Math.floor(sec / 86400));
}

/** Bottom sheet listing overlapping runners: avatar, name, steps, when last updated. */
function runnerSheet(group, byId, today) {
  const agoEls = new Map();
  const rows = group.map((row) => {
    const m = byId.get(row.id);
    const name = m.isMe ? T.you : m.name || STRINGS.members.unnamed;
    const ago = h('span', { class: 'sheet-row-ago' });
    agoEls.set(row.id, ago);
    return h('li', {}, h('button', {
      class: 'sheet-row', attrs: { type: 'button', 'aria-label': STRINGS.profile.openProfile(name) },
      on: { click: () => openProfile(row.id) },
    },
    avatarBadge(m.avatar, { size: 'lg' }),
    h('span', { class: 'sheet-row-main' },
      h('span', { class: 'sheet-row-name', text: m.isMe ? m.name || name : name }),
      m.handle ? h('span', { class: 'sheet-row-handle', text: `@${m.handle}` }) : null,
    ),
    h('span', { class: 'sheet-row-side' }, h('b', { text: STRINGS.common.steps(formatSteps(row.value)) }), ago),
    ));
  });
  openSheet(T.pickRunner, h('ul', { class: 'sheet-list' }, rows));
  fetchDayForUsers(group.map((r) => r.id), today).then((rowsById) => {
    if (!rowsById) return;
    for (const [id, el] of agoEls) {
      const r = rowsById.get(id);
      if (r && r.updatedAt) el.textContent = T.updatedAgo(formatAgo(r.updatedAt));
    }
  }).catch(() => {});
}

/**
 * Runners standing close together would cover each other's step bubbles. Walking along the
 * path, each bubble that is too close to the previous one moves up a level (max 2) and gets
 * a thin leader line down to its runner.
 */
const BUBBLE_GAP = 84; // world px
const BUBBLE_LIFT = 34; // px per level
function liftCrowdedBubbles(ranking, xFor, runners) {
  const byX = [...ranking].sort((a, b) => a.value - b.value);
  let prevX = -Infinity;
  let level = 0;
  for (const row of byX) {
    const x = xFor(row.value);
    level = x - prevX < BUBBLE_GAP ? (level + 1) % 3 : 0;
    prevX = x;
    runners.get(row.id).style.setProperty('--lift', `${level * BUBBLE_LIFT}px`);
  }
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
    if (dragging) scroller.scrollLeft = startScroll - (e.clientX - startX);
  });
  const stop = () => { dragging = false; };
  scroller.addEventListener('pointerup', stop);
  scroller.addEventListener('pointerleave', stop);
}

/** Pressing or dragging on the minimap rail travels the world to that point. */
function enableRailDrag(rail, world) {
  let dragging = false;
  const jump = (e) => {
    const rect = rail.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    world.scrollLeft = frac * WORLD_WIDTH - world.clientWidth / 2;
  };
  rail.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.mm-dot')) return;
    dragging = true;
    rail.setPointerCapture(e.pointerId);
    jump(e);
  });
  rail.addEventListener('pointermove', (e) => { if (dragging) jump(e); });
  rail.addEventListener('pointerup', () => { dragging = false; });
  rail.addEventListener('pointercancel', () => { dragging = false; });
}

function countUp(el, target) {
  if (reducedMotion() || target <= 0) return;
  const start = performance.now();
  const duration = 700;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = formatSteps(Math.round(target * eased));
    if (t < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

function rankingsSection(members, ranking) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const nameOf = (m) => (m.isMe ? T.you : m.name || STRINGS.members.unnamed);
  return h('section', { class: 'section' },
    h('h2', { class: 'section-title', text: T.todayTitle }),
    h('ol', { class: 'ranking' },
      ranking.map((row, i) => {
        const m = byId.get(row.id);
        let sub = T.leader;
        if (i > 0) {
          const prev = ranking[i - 1];
          const prevName = nameOf(byId.get(prev.id));
          sub = prev.value === row.value ? T.tied(prevName) : T.behind(formatSteps(prev.value - row.value), prevName);
        }
        return h('li', { class: `rank-row${m.isMe ? ' rank-row--me' : ''}` },
          personButton(m.id, STRINGS.profile.openProfile(nameOf(m)), rankedAvatar(m.avatar, row.rank)),
          personButton(m.id, STRINGS.profile.openProfile(nameOf(m)), [
            h('span', { class: 'rank-name', text: nameOf(m) }),
            h('span', { class: 'rank-sub', text: sub }),
          ], 'rank-main'),
          h('span', { class: 'rank-score', text: STRINGS.common.steps(formatSteps(row.value)) }),
        );
      }),
    ),
  );
}
