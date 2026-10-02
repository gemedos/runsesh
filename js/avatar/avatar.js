// Avatar model, validation and safe SVG building.
// Stored format (small JSON, nothing else is accepted):
//   { v: 1, skin: '#RRGGBB', hair, hairColor, top, bottom, shoes, acc }
// Every part field must be a whitelisted ID from parts.js.

import { s } from '../ui/dom.js';
import { ACCESSORIES, BODY, BOTTOMS, GOLDEN_SET, HAIR, HAIR_COLORS, SHOES, TOPS } from './parts.js';

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

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

export const DEFAULT_AVATAR = Object.freeze({
  v: 1,
  skin: '#f1c27d',
  hair: 'h_short',
  hairColor: 'hc_brown',
  top: 't_tee',
  bottom: 'b_shorts',
  shoes: 's_runner',
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

export const FULL_VIEWBOX = '20 0 160 290';
export const HEAD_VIEWBOX = '46 8 108 108';

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
  const layers = [
    hair.back,
    BODY.legs,
    BOTTOMS[a.bottom].parts,
    golden && golden.layer === 'shoes' ? golden.parts : (a.shoes === 's_none' ? BODY.feet : SHOES[a.shoes].parts),
    BODY.arms,
    BODY.neck,
    BODY.torso,
    TOPS[a.top].parts,
    golden && golden.layer === 'top' ? golden.parts : [],
    BODY.head,
    BODY.face,
    hair.front,
    ACCESSORIES[a.acc].parts,
    golden && golden.layer === 'acc' ? golden.parts : [],
  ];

  const svg = s('svg', {
    viewBox: opts.crop ? HEAD_VIEWBOX : FULL_VIEWBOX,
    class: opts.crop ? 'avatar-svg avatar-head' : 'avatar-svg',
    role: opts.label ? 'img' : null,
    'aria-hidden': opts.label ? null : 'true',
    focusable: 'false',
  });
  if (opts.label) svg.setAttribute('aria-label', opts.label);

  for (const layer of layers) {
    for (const [tag, attrs] of layer) {
      const resolved = {};
      for (const [name, value] of Object.entries(attrs)) {
        resolved[name] = typeof value === 'string' && has(colors, value) ? colors[value] : value;
      }
      svg.append(s(tag, resolved));
    }
  }
  return svg;
}
