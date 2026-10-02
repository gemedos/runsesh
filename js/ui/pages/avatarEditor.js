// Avatar customization screen. Edits a local draft; "Save" validates and stores it.

import { AVATAR_FIELDS, buildAvatarSvg, isHexColor, validateAvatar } from '../../avatar/avatar.js';
import { GOLDEN_SET } from '../../avatar/parts.js';
import { saveAvatar } from '../../state/store.js';
import { screenHeader } from '../components.js';
import { h } from '../dom.js';

const TABS = [
  { id: 'hair', label: 'Hair', field: 'hair', crop: true },
  { id: 'hairColor', label: 'Hair color', field: 'hairColor', crop: true },
  { id: 'top', label: 'Tops', field: 'top' },
  { id: 'bottom', label: 'Bottoms', field: 'bottom' },
  { id: 'shoes', label: 'Shoes', field: 'shoes' },
  { id: 'acc', label: 'Accessories', field: 'acc', golden: true },
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
    preview.replaceChildren(buildAvatarSvg(draft, { label: 'Avatar preview' }));
  }

  function drawTabs() {
    tabBar.replaceChildren(...TABS.map((tab) => h('button', {
      class: `chip${tab === activeTab ? ' chip--active' : ''}`,
      text: tab.label,
      attrs: { type: 'button', role: 'tab', 'aria-selected': tab === activeTab ? 'true' : 'false' },
      on: { click: () => { activeTab = tab; drawTabs(); drawOptions(); } },
    })));
  }

  function drawOptions() {
    const whitelist = AVATAR_FIELDS[activeTab.field];
    const grid = h('div', { class: 'option-grid' },
      Object.entries(whitelist).map(([id, part]) => {
        const candidate = { ...draft, [activeTab.field]: id };
        const selected = draft[activeTab.field] === id;
        return h('button', {
          class: `option${selected ? ' option--selected' : ''}`,
          attrs: { type: 'button', 'aria-pressed': selected ? 'true' : 'false', 'aria-label': part.label },
          on: { click: () => { draft = candidate; drawPreview(); drawOptions(); } },
        },
        buildAvatarSvg(candidate, { crop: activeTab.crop }),
        h('span', { class: 'option-label', text: part.label }),
        );
      }),
    );
    options.replaceChildren(grid);
    if (activeTab.golden) options.append(goldenSection());
  }

  function goldenSection() {
    return h('div', { class: 'golden-set' },
      h('h3', { class: 'golden-title', text: 'Golden set' }),
      h('p', { class: 'hint', text: 'Locked. Win competitions with a golden reward to unlock.' }),
      h('div', { class: 'option-grid' },
        Object.entries(GOLDEN_SET).map(([id, part]) => h('div', { class: 'option option--locked', attrs: { 'aria-label': `${part.label} (locked)`, role: 'img' } },
          buildAvatarSvg(draft, { golden: id, crop: part.layer === 'acc' }),
          h('span', { class: 'lock', attrs: { 'aria-hidden': 'true' } }, '🔒'),
          h('span', { class: 'option-label', text: part.label }),
        )),
      ),
    );
  }

  const save = h('button', {
    class: 'btn btn-primary',
    text: 'Save avatar',
    attrs: { type: 'button' },
    on: {
      click: () => {
        const clean = validateAvatar(draft);
        if (!clean || !saveAvatar(clean)) {
          toast('Could not save that avatar.');
          return;
        }
        toast('Avatar saved.');
        navigate('profile');
      },
    },
  });

  drawPreview();
  drawTabs();
  drawOptions();

  return h('div', { class: 'page page-editor' },
    screenHeader('Your avatar', 'profile'),
    preview,
    h('div', { class: 'card editor-skin' },
      h('label', { attrs: { for: 'skin-color' }, text: 'Skin / body color' }),
      skinInput,
    ),
    tabBar,
    options,
    h('div', { class: 'sticky-actions' }, save),
  );
}
