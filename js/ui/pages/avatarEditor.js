// Avatar customization screen. Edits a local draft; "Save" validates and stores it.
// Layout (see docs/design.md): night scene with the figure → panel with text tabs and a
// 3/4-column tile grid → floating Save pill. Two columns on desktop.

import { AVATAR_FIELDS, buildAvatarSvg, isHexColor, validateAvatar } from '../../avatar/avatar.js';
import { GOLDEN_SET } from '../../avatar/parts.js';
import { saveAvatar } from '../../state/store.js';
import { STRINGS } from '../../strings.js';
import { h } from '../dom.js';

const T = STRINGS.avatarEditor;

const TABS = [
  { id: 'skin' },
  { id: 'hair', field: 'hair', crop: true },
  { id: 'hairColor', field: 'hairColor', crop: true },
  { id: 'top', field: 'top' },
  { id: 'bottom', field: 'bottom' },
  { id: 'shoes', field: 'shoes' },
  { id: 'acc', field: 'acc', golden: true },
];

// Quick picks for the body color. Constants, and validated again like any other color.
const SKIN_SWATCHES = ['#ff8c1a', '#ffd23f', '#5ec8f0', '#7ccc3a', '#f07ab4', '#b38bff', '#ffdbac', '#e0ac69', '#c68642', '#8d5524', '#f4f4f4', '#3a3a46'];

export function renderAvatarEditor({ state, navigate, toast }) {
  let draft = { ...state.avatar };
  let activeTab = TABS[0];

  const preview = h('div', { class: 'editor-figure stomp' });
  const tabBar = h('div', { class: 'editor-tabs', attrs: { role: 'tablist' } });
  const options = h('div', { class: 'editor-options' });

  function setSkin(hex) {
    if (!isHexColor(hex)) return;
    draft = { ...draft, skin: hex.toLowerCase() };
    drawPreview();
  }

  function drawPreview() {
    preview.replaceChildren(buildAvatarSvg(draft, { label: T.preview }));
  }

  function drawTabs() {
    tabBar.replaceChildren(...TABS.map((tab) => h('button', {
      class: `chip${tab === activeTab ? ' chip--active' : ''}`,
      text: T.tabs[tab.id],
      attrs: { type: 'button', role: 'tab', 'aria-selected': tab === activeTab ? 'true' : 'false' },
      on: { click: () => { activeTab = tab; drawTabs(); drawOptions(); } },
    })));
  }

  function skinPanel() {
    const input = h('input', { class: 'color-input', attrs: { type: 'color', id: 'skin-color', value: draft.skin } });
    input.addEventListener('input', () => setSkin(input.value));
    const swatches = h('div', { class: 'swatches' },
      SKIN_SWATCHES.map((hex) => {
        const selected = draft.skin === hex;
        const btn = h('button', {
          class: `swatch${selected ? ' swatch--selected' : ''}`,
          attrs: { type: 'button', 'aria-label': T.swatch(hex), 'aria-pressed': selected ? 'true' : 'false' },
          on: { click: () => { setSkin(hex); input.value = hex; drawOptions(); } },
        });
        btn.style.setProperty('--swatch', hex); // constant from the list above
        return btn;
      }),
    );
    return h('div', { class: 'skin-panel' },
      h('label', { class: 'skin-picker', attrs: { for: 'skin-color' } }, input, h('span', { text: T.skinPicker })),
      swatches,
    );
  }

  function drawOptions() {
    if (!activeTab.field) {
      options.replaceChildren(skinPanel());
      return;
    }
    const whitelist = AVATAR_FIELDS[activeTab.field];
    const grid = h('div', { class: 'option-grid' },
      Object.keys(whitelist).map((id) => {
        const candidate = { ...draft, [activeTab.field]: id };
        const selected = draft[activeTab.field] === id;
        return h('button', {
          class: `option${selected ? ' option--selected' : ''}`,
          attrs: { type: 'button', 'aria-pressed': selected ? 'true' : 'false', 'aria-label': STRINGS.parts[id] },
          on: { click: () => { draft = candidate; drawPreview(); drawOptions(); } },
        },
        selected ? h('span', { class: 'option-check', attrs: { 'aria-hidden': 'true' } }, '✓') : null,
        buildAvatarSvg(candidate, { crop: activeTab.crop }),
        h('span', { class: 'option-label', text: STRINGS.parts[id] }),
        );
      }),
    );
    options.replaceChildren(grid);
    if (activeTab.golden) options.append(goldenSection());
  }

  function goldenSection() {
    return h('div', { class: 'golden-set' },
      h('h3', { class: 'golden-title', text: T.goldenTitle }),
      h('p', { class: 'hint', text: T.goldenHint }),
      h('div', { class: 'option-grid' },
        Object.entries(GOLDEN_SET).map(([id, part]) => h('div', { class: 'option option--locked', attrs: { 'aria-label': T.locked(STRINGS.parts[id]), role: 'img' } },
          buildAvatarSvg(draft, { golden: id, crop: part.layer === 'acc' }),
          h('span', { class: 'lock', attrs: { 'aria-hidden': 'true' } }, '🔒'),
          h('span', { class: 'option-label', text: STRINGS.parts[id] }),
        )),
      ),
    );
  }

  const save = h('button', {
    class: 'btn btn-primary btn-xl',
    text: T.save,
    attrs: { type: 'button' },
    on: {
      click: async () => {
        // Validated here, then by the database (CHECK constraint). On failure the
        // previous avatar stays and the user sees a generic message.
        const clean = validateAvatar(draft);
        if (!clean) { toast(T.saveFailed); return; }
        save.disabled = true;
        const ok = await saveAvatar(clean);
        save.disabled = false;
        if (!ok) { toast(T.saveFailed); return; }
        toast(T.saved);
        navigate('profile');
      },
    },
  });

  drawPreview();
  drawTabs();
  drawOptions();

  return h('div', { class: 'page page-editor' },
    h('div', { class: 'editor-stage scene' },
      h('a', { class: 'back-link back-link--float', attrs: { href: '#/profile', 'aria-label': STRINGS.app.back } }, '‹'),
      h('h1', { class: 'sr-only', text: T.title }),
      preview,
    ),
    h('div', { class: 'editor-panel' }, tabBar, options),
    h('div', { class: 'sticky-actions' }, save),
  );
}
