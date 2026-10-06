// Memories UI (docs/design.md §11): the profile tab (grid grouped by day, "Add a memory" on the
// own profile), a full-size viewer, and the "Today's memories" strip on the race page.
// Photos are shown through short-lived signed URLs; who may see them is decided by RLS.

import { addMemory, deleteMemory, fetchMemories, fetchMemoriesForDay, MEMORIES_PER_DAY, signedUrls } from '../data/memoriesRepo.js';
import { STRINGS } from '../strings.js';
import { formatDate, todayISO } from '../util/date.js';
import { IMAGE_ACCEPT } from '../util/image.js';
import { avatarBadge } from './components.js';
import { h } from './dom.js';
import { openProfile } from './profileLink.js';
import { openSheet } from './sheet.js';

const T = STRINGS.memories;

function photo(url, alt, cls) {
  const missing = () => h('span', { class: `${cls} memory-missing`, attrs: { role: 'img', 'aria-label': T.unavailable } });
  if (!url) return missing();
  const img = h('img', { class: cls, attrs: { src: url, alt, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' } });
  img.addEventListener('error', () => img.replaceWith(missing()), { once: true }); // expired link or deleted file
  return img;
}

/**
 * Full-size view in a sheet: photo, owner, date; the owner can delete it.
 * @param {{name: string, handle?: string, avatar: object, id: string, isMe: boolean}} owner
 */
export function openMemoryViewer(memory, url, owner, { onDeleted, toast } = {}) {
  let close = () => {};
  const del = owner.isMe ? h('button', { class: 'btn btn-danger btn-small', text: T.delete, attrs: { type: 'button' } }) : null;
  if (del) {
    del.addEventListener('click', async () => {
      if (!window.confirm(T.deleteConfirm)) return;
      del.disabled = true;
      const ok = await deleteMemory(memory);
      if (toast) toast(ok ? T.deleted : T.failed);
      if (ok) { close(); if (onDeleted) onDeleted(); } else del.disabled = false;
    });
  }
  const who = h('button', {
    class: 'memory-owner person-link', attrs: { type: 'button', 'aria-label': STRINGS.profile.openProfile(owner.name) },
    on: { click: () => openProfile(owner.id) },
  },
  avatarBadge(owner.avatar, { size: 'md' }),
  h('span', { class: 'fr-main' },
    h('span', { class: 'rank-name', text: owner.name }),
    h('span', { class: 'rank-sub', text: [owner.handle ? `@${owner.handle}` : null, formatDate(memory.day)].filter(Boolean).join(' · ') }),
  ));
  close = openSheet(T.viewerLabel(owner.name), h('div', { class: 'memory-viewer' },
    photo(url, T.photoAlt(owner.name, formatDate(memory.day)), 'memory-full'),
    h('div', { class: 'memory-viewer-bar' }, who, del),
  ));
}

/** Profile tab: all memories of one player, newest first, grouped by day. */
export function memoriesPanel({ owner, toast }) {
  const body = h('div', { class: 'memories' }, h('p', { class: 'hint', text: STRINGS.party.loading }));
  const today = todayISO();

  async function load() {
    const list = await fetchMemories(owner.id);
    if (!list) { body.replaceChildren(addBar(0), h('p', { class: 'hint', text: T.failed })); return; }
    const urls = await signedUrls(list.map((m) => m.path));
    const todayCount = list.filter((m) => m.day === today).length;

    const days = [];
    for (const m of list) {
      const last = days[days.length - 1];
      if (last && last.day === m.day) last.items.push(m); else days.push({ day: m.day, items: [m] });
    }
    body.replaceChildren(
      addBar(todayCount),
      list.length ? h('div', { class: 'memory-days' }, days.map((d) => h('section', { class: 'memory-day' },
        h('h4', { class: 'cal-sub-title', text: d.day === today ? T.today : formatDate(d.day) }),
        h('div', { class: 'memory-grid' }, d.items.map((m) => h('button', {
          class: 'memory-tile', attrs: { type: 'button', 'aria-label': T.photoAlt(owner.name, formatDate(m.day)) },
          on: { click: () => openMemoryViewer(m, urls.get(m.path), owner, { onDeleted: load, toast }) },
        }, photo(urls.get(m.path), '', 'memory-thumb')))),
      ))) : h('div', { class: 'ptab-empty' },
        h('p', { class: 'ptab-empty-title', text: T.emptyTitle }),
        h('p', { class: 'hint', text: owner.isMe ? T.emptyOwn : T.emptyOther }),
      ),
    );
  }

  function addBar(todayCount) {
    if (!owner.isMe) return null;
    const left = MEMORIES_PER_DAY - todayCount;
    const input = h('input', { class: 'sr-only', attrs: { type: 'file', accept: IMAGE_ACCEPT, id: 'memory-file', disabled: left <= 0 } });
    const label = h('label', { class: `btn btn-primary${left <= 0 ? ' btn--disabled' : ''}`, attrs: { for: 'memory-file', 'aria-disabled': left <= 0 ? 'true' : 'false' } },
      h('span', { class: 'btn-plus', attrs: { 'aria-hidden': 'true' }, text: '+' }), h('span', { text: T.add }));
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      label.classList.add('btn--busy');
      toast(T.uploading);
      const res = await addMemory(owner.id, file, todayISO());
      label.classList.remove('btn--busy');
      toast(res.ok ? T.added : T.errors[res.reason] || T.failed);
      if (res.ok) load();
    });
    return h('div', { class: 'memory-add' }, input, label, h('span', { class: 'hint', text: T.leftToday(Math.max(0, left), MEMORIES_PER_DAY) }));
  }

  load();
  return body;
}

/** Race page: today's memories of the party (member list), newest last. Hidden when none. */
export function todayMemoriesStrip({ members, toast }) {
  const section = h('section', { class: 'section memory-strip-section', attrs: { hidden: true } });
  (async () => {
    const list = await fetchMemoriesForDay(members.map((m) => m.id), todayISO());
    if (!list || !list.length) return;
    const urls = await signedUrls(list.map((m) => m.path));
    const byId = new Map(members.map((m) => [m.id, m]));
    section.replaceChildren(
      h('h2', { class: 'section-title', text: T.todayTitle }),
      h('div', { class: 'memory-strip', attrs: { role: 'list' } }, list.map((m) => {
        const member = byId.get(m.userId);
        const owner = { id: m.userId, name: member.isMe ? STRINGS.race.you : member.name || STRINGS.members.unnamed, handle: member.handle, avatar: member.avatar, isMe: member.isMe };
        return h('button', {
          class: 'memory-card', attrs: { type: 'button', role: 'listitem', 'aria-label': T.photoAlt(owner.name, T.today) },
          on: { click: () => openMemoryViewer(m, urls.get(m.path), owner, { toast, onDeleted: () => section.remove() }) },
        },
        photo(urls.get(m.path), '', 'memory-card-photo'),
        h('span', { class: 'memory-card-who' }, avatarBadge(owner.avatar, { size: 'sm' }), h('span', { class: 'memory-card-name', text: owner.name })),
        );
      })),
    );
    section.hidden = false;
  })();
  return section;
}
