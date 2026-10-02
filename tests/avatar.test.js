import { buildAvatarSvg, DEFAULT_AVATAR, validateAvatar } from '../js/avatar/avatar.js';
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

test('buildAvatarSvg falls back to the default for invalid input', () => {
  const svg = buildAvatarSvg({ ...good, skin: '"/><script>alert(1)</script>' });
  ok(svg instanceof SVGSVGElement, 'returns an SVG element');
  ok(!svg.querySelector('script'), 'no script element');
  ok(svg.outerHTML.includes(DEFAULT_AVATAR.skin), 'default skin used');
});

test('head crop uses the close-up viewBox', () => {
  eq(buildAvatarSvg(good, { crop: true }).getAttribute('viewBox'), '46 8 108 108');
});

test('golden preview ignores unknown ids', () => {
  eq(buildAvatarSvg(good, { golden: 'g_nope' }).childElementCount, buildAvatarSvg(good).childElementCount);
});
