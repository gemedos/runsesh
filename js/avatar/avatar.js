// Avatar model, validation and safe SVG building.
// Stored format (small JSON, nothing else is accepted):
//   { v: 1, skin: '#RRGGBB', hair, hairColor, top, bottom, shoes, acc }
// Every part field must be a whitelisted ID from parts.js.

import { s } from '../ui/dom.js';
import { ACCESSORIES, BODY, BOTTOMS, GOLDEN_SET, HAIR, HAIR_COLORS, SHOES, TOPS } from './parts.js';

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Upper bound for the serialized avatar JSON (a real one is ~130 characters). See docs/avatar-schema.md. */
export const AVATAR_MAX_JSON_LENGTH = 512;

/** Field name -> whitelist map. */
export const AVATAR_FIELDS = Object.freeze({
  hair: HAIR,
  hairColor: HAIR_COLORS,
  top: TOPS,
  bottom: BOTTOMS,
  shoes: SHOES,
  acc: ACCESSORIES,
});

const ALLOWED_KEYS = ['v', 'skin', ...Object.keys(AVATAR_FIELDS)];

/** The plain graphite mannequin in running kit (docs/design.md, section 7). */
export const DEFAULT_AVATAR = Object.freeze({
  v: 1,
  skin: '#5b5e69',
  hair: 'h_none',
  hairColor: 'hc_brown',
  top: 't_tank',
  bottom: 'b_runshorts',
  shoes: 's_white',
  acc: 'a_none',
});

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

export function isHexColor(value) {
  return typeof value === 'string' && HEX_COLOR_RE.test(value);
}

/**
 * Returns a clean, frozen copy of the avatar, or null if anything is off:
 * unknown keys, missing keys, wrong version, bad color, or a part ID not on the whitelist.
 */
export function validateAvatar(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  if (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) return null;
  const keys = Object.keys(input);
  if (keys.length !== ALLOWED_KEYS.length || !keys.every((k) => ALLOWED_KEYS.includes(k))) return null;
  if (keys.some((k) => typeof input[k] === 'string' && input[k].length > AVATAR_MAX_JSON_LENGTH)) return null;
  if (JSON.stringify(input).length > AVATAR_MAX_JSON_LENGTH) return null;
  if (input.v !== 1 || !isHexColor(input.skin)) return null;

  const out = { v: 1, skin: input.skin.toLowerCase() };
  for (const [field, whitelist] of Object.entries(AVATAR_FIELDS)) {
    const value = input[field];
    if (typeof value !== 'string' || !has(whitelist, value)) return null;
    out[field] = value;
  }
  return Object.freeze(out);
}

/** Valid avatar or the default one. */
export function sanitizeAvatar(input) {
  return validateAvatar(input) || DEFAULT_AVATAR;
}

export const FULL_VIEWBOX = '26 4 158 250';
/** Profile-picture close-up: the head in profile, neck and shoulder line at the bottom. */
export const HEAD_VIEWBOX = '86 4 56 56';

// Studio lighting (docs/design.md, section 7): one soft key light from the upper left/back.
// Every surface is drawn twice: in its colour, then with this gradient on top. Far-side limbs
// use a darker version, as if in the body's shadow. Coordinates are fixed; no user data.
const LIGHT = { x1: 70, y1: 16, x2: 128, y2: 238 };
const LIGHT_STOPS = {
  near: [[0, '#ffffff', 0.22], [0.42, '#ffffff', 0], [0.55, '#000000', 0], [1, '#000000', 0.3]],
  far: [[0, '#000000', 0.16], [0.5, '#000000', 0.24], [1, '#000000', 0.42]],
};
let drawingCount = 0;

function lightGradient(id, stops) {
  return s('linearGradient', { id, gradientUnits: 'userSpaceOnUse', ...LIGHT },
    ...stops.map(([offset, color, opacity]) => s('stop', { offset, 'stop-color': color, 'stop-opacity': opacity })));
}

/** The lighting copy of a surface: same geometry, gradient instead of colour, no edge. */
function lightingCopy(tag, attrs, gradientUrl) {
  const copy = { ...attrs };
  if (copy.fill && copy.fill !== 'none') {
    copy.fill = gradientUrl;
    copy.stroke = 'none';
  } else if (copy.stroke) {
    copy.stroke = gradientUrl;
  }
  delete copy['stroke-opacity'];
  return s(tag, copy);
}

/**
 * Builds an <svg> for an avatar.
 * @param {object} avatar any object; it is validated here again, invalid input renders the default
 * @param {object} [opts]
 * @param {boolean} [opts.crop] head close-up (profile icon)
 * @param {string} [opts.golden] a GOLDEN_SET id to show as a locked preview
 * @param {string} [opts.label] accessible label (set with setAttribute, never parsed)
 */
export function buildAvatarSvg(avatar, opts = {}) {
  const a = sanitizeAvatar(avatar);
  const golden = typeof opts.golden === 'string' && has(GOLDEN_SET, opts.golden) ? GOLDEN_SET[opts.golden] : null;

  const colors = {
    '@skin': golden && golden.skin ? golden.skin : a.skin,
    '@hair': HAIR_COLORS[a.hairColor].color,
  };

  const hair = HAIR[a.hair];
  const top = TOPS[a.top];
  const bottom = BOTTOMS[a.bottom];
  const shoes = golden && golden.layer === 'shoes' ? golden : SHOES[a.shoes];
  const acc = ACCESSORIES[a.acc];
  const g = (slot) => (golden && golden[slot]) || [];

  // Back to front. [parts, far?]: far-side parts get the darker lighting.
  const layers = [
    [hair.back],
    [opts.crop ? [] : BODY.shadow],
    [BODY.farLeg, true], [bottom.far || [], true], [shoes.far || [], true],
    [BODY.farArm, true], [top.far || [], true],
    [BODY.torso], [BODY.nearLeg], [BODY.neck],
    [bottom.main || []], [bottom.near || []], [shoes.near || []],
    [top.main || []], [g('main')], [acc.main || []],
    [BODY.head], [hair.front], [acc.head || []], [g('head')],
    [BODY.nearArm], [top.near || []], [acc.near || []],
  ];

  const svg = s('svg', {
    viewBox: opts.crop ? HEAD_VIEWBOX : FULL_VIEWBOX,
    class: opts.crop ? 'avatar-svg avatar-head' : 'avatar-svg',
    role: opts.label ? 'img' : null,
    'aria-hidden': opts.label ? null : 'true',
    focusable: 'false',
  });
  if (opts.label) svg.setAttribute('aria-label', opts.label);

  drawingCount += 1;
  const nearId = `rs-av${drawingCount}-near`;
  const farId = `rs-av${drawingCount}-far`;
  svg.append(s('defs', {}, lightGradient(nearId, LIGHT_STOPS.near), lightGradient(farId, LIGHT_STOPS.far)));

  for (const [parts, far] of layers) {
    for (const [tag, attrs, kind] of parts) {
      const resolved = {};
      for (const [name, value] of Object.entries(attrs)) {
        resolved[name] = typeof value === 'string' && has(colors, value) ? colors[value] : value;
      }
      svg.append(s(tag, resolved));
      if (kind === 'surf') svg.append(lightingCopy(tag, resolved, `url(#${far ? farId : nearId})`));
    }
  }
  return svg;
}
