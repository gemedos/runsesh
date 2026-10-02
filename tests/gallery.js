// Dev-only: renders every whitelisted part so the drawings can be checked at a glance.
import { AVATAR_FIELDS, buildAvatarSvg, DEFAULT_AVATAR } from '../js/avatar/avatar.js';
import { GOLDEN_SET } from '../js/avatar/parts.js';
import { h } from '../js/ui/dom.js';

const root = document.getElementById('gallery');
const cell = (svg, label, head) => h('div', { class: head ? 'cell head' : 'cell' }, svg, label);

root.append(h('div', { class: 'big' }, buildAvatarSvg(DEFAULT_AVATAR), buildAvatarSvg({ ...DEFAULT_AVATAR, hair: 'h_curly', top: 't_tee', bottom: 'b_shorts', shoes: 's_white', acc: 'a_cap', skin: '#5ec8f0' })));
root.append(h('section', {}, h('h2', { text: 'default + head crop' }), h('div', { class: 'row' },
  cell(buildAvatarSvg(DEFAULT_AVATAR), 'default'),
  cell(buildAvatarSvg(DEFAULT_AVATAR, { crop: true }), 'crop', true),
)));

for (const [field, list] of Object.entries(AVATAR_FIELDS)) {
  root.append(h('section', {}, h('h2', { text: field }), h('div', { class: 'row' },
    Object.keys(list).map((id) => cell(buildAvatarSvg({ ...DEFAULT_AVATAR, hair: field === 'hairColor' ? 'h_short' : DEFAULT_AVATAR.hair, [field]: id }), id)),
  )));
}

root.append(h('section', {}, h('h2', { text: 'golden (locked previews)' }), h('div', { class: 'row' },
  Object.keys(GOLDEN_SET).map((id) => cell(buildAvatarSvg(DEFAULT_AVATAR, { golden: id }), id)),
)));
