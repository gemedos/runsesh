import { AVATAR_FIELDS, AVATAR_MAX_JSON_LENGTH, buildAvatarSvg, DEFAULT_AVATAR, HEAD_VIEWBOX, validateAvatar } from '../js/avatar/avatar.js';
import { STRINGS } from '../js/strings.js';
import { eq, ok, test } from './harness.js';

const good = { ...DEFAULT_AVATAR };

test('accepts a valid avatar and lowercases the color', () => {
  eq(validateAvatar({ ...good, skin: '#AABBCC' }).skin, '#aabbcc');
});

test('rejects bad colors', () => {
  for (const skin of ['#abc', 'red', '#12345g', '#1234567', 'url(x)', '#123456;x', ' #123456', '', null, 123456]) {
    eq(validateAvatar({ ...good, skin }), null, `skin ${skin}`);
  }
});

test('rejects unknown part ids, locked golden ids and markup', () => {
  eq(validateAvatar({ ...good, hair: 'h_nope' }), null);
  eq(validateAvatar({ ...good, acc: 'g_crown' }), null);
  eq(validateAvatar({ ...good, top: '<img src=x onerror=alert(1)>' }), null);
  eq(validateAvatar({ ...good, hair: 'toString' }), null);
  eq(validateAvatar({ ...good, hair: '__proto__' }), null);
});

test('rejects extra, missing or wrong-version fields', () => {
  eq(validateAvatar({ ...good, extra: 1 }), null);
  const missing = { ...good };
  delete missing.acc;
  eq(validateAvatar(missing), null);
  eq(validateAvatar({ ...good, v: 2 }), null);
  eq(validateAvatar(JSON.parse('{"__proto__": {"x": 1}}')), null);
  eq(validateAvatar([]), null);
  eq(validateAvatar('{}'), null);
});

test('rejects oversized input and keeps real avatars well under the limit', () => {
  eq(validateAvatar({ ...good, hair: 'h_'.padEnd(600, 'x') }), null);
  ok(JSON.stringify(validateAvatar(good)).length <= AVATAR_MAX_JSON_LENGTH, 'default avatar fits');
  ok(JSON.stringify(validateAvatar({ ...good, hair: 'h_ponytail', hairColor: 'hc_auburn', top: 't_tracksuit', bottom: 'b_runshorts', shoes: 's_runner', acc: 'a_sunglasses' })).length <= 200, 'longest IDs fit in 200');
});

test('every whitelisted part ID matches the documented pattern and has a label', () => {
  for (const [field, list] of Object.entries(AVATAR_FIELDS)) {
    for (const id of Object.keys(list)) {
      ok(/^[a-z]{1,2}_[a-z0-9]{1,16}$/.test(id), `${field}: ${id} pattern`);
      ok(typeof STRINGS.parts[id] === 'string', `${id} label`);
    }
  }
});

test('whitelists match docs/avatar-schema.md', () => {
  // Keep in sync with the "Allowed part IDs" table in docs/avatar-schema.md.
  const documented = {
    hair: ['h_none', 'h_buzz', 'h_short', 'h_spiky', 'h_long', 'h_bob', 'h_ponytail', 'h_bun', 'h_curly', 'h_mohawk'],
    hairColor: ['hc_black', 'hc_brown', 'hc_auburn', 'hc_blonde', 'hc_grey', 'hc_blue', 'hc_pink', 'hc_green'],
    top: ['t_tee', 't_tank', 't_jersey', 't_hoodie', 't_jacket', 't_singlet', 't_tracksuit'],
    bottom: ['b_shorts', 'b_runshorts', 'b_leggings', 'b_joggers', 'b_skirt'],
    shoes: ['s_none', 's_runner', 's_white', 's_blue', 's_pink'],
    acc: ['a_none', 'a_cap', 'a_headband', 'a_sunglasses', 'a_glasses', 'a_headphones', 'a_scarf', 'a_medal', 'a_watch'],
  };
  for (const [field, ids] of Object.entries(documented)) eq(Object.keys(AVATAR_FIELDS[field]), ids, field);
  eq(Object.keys(AVATAR_FIELDS), Object.keys(documented));
});

test('buildAvatarSvg falls back to the default for invalid input', () => {
  const svg = buildAvatarSvg({ ...good, skin: '"/><script>alert(1)</script>' });
  ok(svg instanceof SVGSVGElement, 'returns an SVG element');
  ok(!svg.querySelector('script'), 'no script element');
  ok(svg.outerHTML.includes(DEFAULT_AVATAR.skin), 'default skin used');
});

test('head crop uses the close-up viewBox', () => {
  eq(buildAvatarSvg(good, { crop: true }).getAttribute('viewBox'), HEAD_VIEWBOX);
});

test('golden preview ignores unknown ids', () => {
  eq(buildAvatarSvg(good, { golden: 'g_nope' }).childElementCount, buildAvatarSvg(good).childElementCount);
});
