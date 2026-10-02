// Avatar customization screen. Edits a local draft; "Save" validates and stores it.

import { AVATAR_FIELDS, buildAvatarSvg, isHexColor, validateAvatar } from '../../avatar/avatar.js';
import { GOLDEN_SET } from '../../avatar/parts.js';
import { saveAvatar } from '../../state/store.js';
import { STRINGS } from '../../strings.js';
import { screenHeader } from '../components.js';
import { h } from '../dom.js';

const T = STRINGS.avatarEditor;

const TABS = [
  { field: 'hair', crop: true },
  { field: 'hairColor', crop: true },
  { field: 'top' },
  { field: 'bottom' },
  { field: 'shoes' },
  { field: 'acc', golden: true },
];

export function renderAvatarEditor({ state, navigate, toast }) {
  let draft = { ...state.avatar };
  let activeTab = TABS[0];

  const preview = h('div', { class: 'editor-preview' });
  const tabBar = h('div', { class: 'editor-tabs', attrs: { role: 'tablist' } });
  const options = h('div', { class: 'editor-options' });

  const skinInput = h('input', { class: 'color-input', attrs: { type: 'color', id: 'skin-color', value: draft.skin } });
  skinInput.addEventListener('input', () => {
    if (!isHexColor(skinInput.value)) return;
    draft = { ...draft, skin: skinInput.value.toLowerCase() };
    drawPreview();
  });
  skinInput.addEventListener('change', drawOptions);

  function drawPreview() {
    preview.replaceChildren(buildAvatarSvg(draft, { label: T.preview }));
  }

  function drawTabs() {
    tabBar.replaceChildren(...TABS.map((tab) => h('button', {
      class: `chip${tab === activeTab ? ' chip--active' : ''}`,
      text: T.tabs[tab.field],
      attrs: { type: 'button', role: 'tab', 'aria-selected': tab === activeTab ? 'true' : 'false' },
      on: { click: () => { activeTab = tab; drawTabs(); drawOptions(); } },
    })));
  }

  function drawOptions() {
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
    class: 'btn btn-primary',
    text: T.save,
    attrs: { type: 'button' },
    on: {
      click: () => {
        const clean = validateAvatar(draft);
        if (!clean || !saveAvatar(clean)) {
          toast(T.saveFailed);
          return;
        }
        toast(T.saved);
        navigate('profile');
      },
    },
  });

  drawPreview();
  drawTabs();
  drawOptions();

  return h('div', { class: 'page page-editor' },
    screenHeader(T.title, 'profile'),
    preview,
    h('div', { class: 'card editor-skin' },
      h('label', { attrs: { for: 'skin-color' }, text: T.skin }),
      skinInput,
    ),
    tabBar,
    options,
    h('div', { class: 'sticky-actions' }, save),
  );
}
