// Avatar parts: a faceless "stomper" dummy (round head, high-knee stride), flat colors,
// thin dark outline. All shapes are hard-coded data: [tagName, attributes].
// Attribute values that start with '@' are resolved at build time:
//   '@skin' -> the validated skin hex color, '@hair' -> the hair color for a whitelisted id.
// The keys of each map below ARE the whitelist of part IDs (see docs/avatar-schema.md).
// Display labels live in js/strings.js.

const OL = '#16141c'; // outline
const W = '#ffffff';
const OUTLINE_W = 2.2;

// Skeleton (viewBox units). The figure faces right with the right knee raised.
const ARM_BACK = 'M86 88 L60 102 L46 114';
const ARM_FRONT = 'M128 84 L152 98 L160 112';
const UPPER_ARM_BACK = 'M86 88 L64 100';
const UPPER_ARM_FRONT = 'M128 84 L148 96';
const SLEEVE_BACK = 'M86 88 L60 102 L50 110';
const SLEEVE_FRONT = 'M128 84 L152 98 L157 107';
const LEG_BACK = 'M98 140 L94 204 L90 262';
const LEG_FRONT = 'M118 140 L148 160 L141 208';
const PANTS_BACK = 'M98 140 L94 204 L91.5 246';
const PANTS_FRONT = 'M118 140 L148 160 L143 194';
const THIGH_BACK = 'M98 140 L96 178';
const THIGH_FRONT = 'M118 140 L139 154';
const SOCK_BACK = 'M91.8 242 L90.8 258';
const SOCK_FRONT = 'M143.2 192 L141.6 204';
const HIPS = 'M86 132 L130 132 L129 146 C118 156 98 156 86 150 Z';
const TORSO = 'M80 82 C90 72 124 70 134 78 L128 146 C116 152 98 152 86 146 Z';
const TOP_BODY = 'M77 84 C88 70 126 68 137 78 L131 150 C118 156 96 156 83 150 Z';
const VEST_BODY = 'M84 82 L96 80 C100 88 114 88 118 78 L130 78 C136 104 134 128 131 150 C118 156 96 156 83 150 C80 128 80 104 84 82 Z';

// Hair and head accessories are drawn around a head at (100,66) r38;
// this moves them onto the dummy's head at (108,46) r21.
const HEAD_TRANSFORM = 'translate(108 46) scale(0.5526) translate(-100 -66)';
const onHead = (parts) => parts.map(([tag, attrs]) => [tag, { ...attrs, transform: HEAD_TRANSFORM }]);

function limb(d, color, width) {
  const base = { d, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  return [
    ['path', { ...base, stroke: OL, 'stroke-width': width + OUTLINE_W * 2 }],
    ['path', { ...base, stroke: color, 'stroke-width': width }],
  ];
}

function shape(tag, attrs, fill) {
  return [tag, { ...attrs, fill, stroke: OL, 'stroke-width': OUTLINE_W, 'stroke-linejoin': 'round' }];
}

const path = (d, fill) => shape('path', { d }, fill);
const line = (d, color, width = 2) => ['path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }];

/** Foot/shoe outline with the ankle at (x, y), toes pointing right. */
const footAt = (x, y) => `M${x - 9} ${y - 3} C${x - 10} ${y + 5} ${x - 6} ${y + 9} ${x + 2} ${y + 9} L${x + 18} ${y + 9} C${x + 20} ${y + 4} ${x + 12} ${y - 1} ${x + 4} ${y - 4} Z`;
const FOOT_BACK = footAt(90, 262);
const FOOT_FRONT = footAt(141, 208);

// ---------------------------------------------------------------------------
// Base body (faceless)
// ---------------------------------------------------------------------------

export const BODY = Object.freeze({
  shadow: [['ellipse', { cx: 98, cy: 274, rx: 32, ry: 4.5, fill: '#000000', opacity: 0.4 }]],
  legs: [...limb(LEG_BACK, '@skin', 15), ...limb(LEG_FRONT, '@skin', 15)],
  feet: [path(FOOT_BACK, '@skin'), path(FOOT_FRONT, '@skin')],
  arms: [
    ...limb(ARM_BACK, '@skin', 10), ...limb(ARM_FRONT, '@skin', 10),
    shape('circle', { cx: 44, cy: 116, r: 7 }, '@skin'),
    shape('circle', { cx: 161, cy: 114, r: 7 }, '@skin'),
  ],
  hips: [path(HIPS, '@skin')],
  neck: [shape('rect', { x: 101, y: 60, width: 13, height: 18, rx: 5 }, '@skin')],
  torso: [path(TORSO, '@skin')],
  head: [shape('circle', { cx: 108, cy: 46, r: 21 }, '@skin')],
});

// ---------------------------------------------------------------------------
// Hair: { back: [...], front: [...] }
// ---------------------------------------------------------------------------

const HAIR_TOP = 'M62 66 C58 22 142 22 138 66 C130 46 112 42 100 46 C88 42 70 46 62 66 Z';

export const HAIR = Object.freeze({
  h_none: { back: [], front: [] },
  h_buzz: { back: [], front: onHead([path('M64 58 C66 27 134 27 136 58 C122 45 78 45 64 58 Z', '@hair')]) },
  h_short: { back: [], front: onHead([path(HAIR_TOP, '@hair')]) },
  h_spiky: {
    back: [],
    front: onHead([path('M62 66 L60 40 L74 46 L76 26 L90 38 L100 18 L110 38 L124 26 L126 46 L140 40 L138 66 C126 48 74 48 62 66 Z', '@hair')]),
  },
  h_long: {
    back: onHead([path('M60 64 C56 20 144 20 140 64 L146 140 C130 148 70 148 54 140 Z', '@hair')]),
    front: onHead([path(HAIR_TOP, '@hair')]),
  },
  h_bob: {
    back: onHead([path('M58 62 C54 20 146 20 142 62 L144 104 C134 110 66 110 56 104 Z', '@hair')]),
    front: onHead([path('M62 66 C58 22 142 22 138 66 C120 50 100 46 84 50 C76 54 68 58 62 66 Z', '@hair')]),
  },
  h_ponytail: {
    back: onHead([path('M50 46 C14 40 8 104 34 124 C26 92 34 66 56 60 Z', '@hair')]),
    front: onHead([path(HAIR_TOP, '@hair')]),
  },
  h_bun: {
    back: onHead([shape('circle', { cx: 100, cy: 24, r: 16 }, '@hair')]),
    front: onHead([path(HAIR_TOP, '@hair')]),
  },
  h_curly: {
    back: [],
    front: onHead([[64, 62], [68, 46], [80, 34], [94, 28], [108, 28], [122, 34], [132, 46], [136, 62]]
      .map(([cx, cy]) => shape('circle', { cx, cy, r: 13 }, '@hair'))),
  },
  h_mohawk: {
    back: [],
    front: onHead([path('M90 58 C88 38 92 16 100 8 C108 16 112 38 110 58 C106 54 94 54 90 58 Z', '@hair')]),
  },
});

export const HAIR_COLORS = Object.freeze({
  hc_black: { color: '#2b2118' },
  hc_brown: { color: '#6b3e1f' },
  hc_auburn: { color: '#a5432a' },
  hc_blonde: { color: '#e8c262' },
  hc_grey: { color: '#a7a7a7' },
  hc_blue: { color: '#3d6fd6' },
  hc_pink: { color: '#f07ab4' },
  hc_green: { color: '#4caf50' },
});

// ---------------------------------------------------------------------------
// Clothes
// ---------------------------------------------------------------------------

function shortSleeves(color) {
  return [...limb(UPPER_ARM_BACK, color, 14), ...limb(UPPER_ARM_FRONT, color, 14)];
}

function longSleeves(color) {
  return [...limb(SLEEVE_BACK, color, 14), ...limb(SLEEVE_FRONT, color, 14)];
}

const collar = (color = OL) => line('M97 72 C103 79 115 79 121 71', color, 2);

export const TOPS = Object.freeze({
  t_tee: { parts: [...shortSleeves('#e0483a'), path(TOP_BODY, '#e0483a'), collar()] },
  t_tank: { parts: [path(VEST_BODY, '#2f80ed')] },
  t_jersey: {
    // Knit sweater with a cable pattern.
    parts: [
      ...longSleeves('#7b3fa0'),
      path(TOP_BODY, '#7b3fa0'),
      line('M90 100 L98 108 L106 100 L114 108 L122 100', '#5a2b78'),
      line('M90 108 L98 100 L106 108 L114 100 L122 108', '#5a2b78'),
      line('M84 140 C100 146 116 146 130 140', '#5a2b78', 2.5),
      collar('#5a2b78'),
    ],
  },
  t_hoodie: {
    parts: [
      ...longSleeves('#3fae5a'),
      path('M92 70 C96 58 122 56 126 68 L118 76 L100 78 Z', '#36994e'),
      path(TOP_BODY, '#3fae5a'),
      path('M92 120 L124 118 L126 138 L90 140 Z', '#36994e'),
      line('M104 80 V96', W, 1.6), line('M114 79 V95', W, 1.6),
    ],
  },
  t_jacket: {
    parts: [...longSleeves('#d6453a'), path(TOP_BODY, '#d6453a'), line('M109 76 L107 152', '#f1d7c0'), collar()],
  },
  t_singlet: {
    parts: [
      path(VEST_BODY, '#ffd23f'),
      shape('rect', { x: 94, y: 104, width: 26, height: 20, rx: 3 }, W),
      line('M100 111 H114', OL), line('M100 117 H110', OL),
    ],
  },
  t_tracksuit: {
    parts: [
      ...longSleeves('#1d3557'),
      line(SLEEVE_BACK, W), line(SLEEVE_FRONT, W),
      path(TOP_BODY, '#1d3557'),
      line('M84 92 L86 146', W), line('M131 88 L128 146', W),
      line('M109 76 L107 152', '#a8b4c8'),
    ],
  },
});

const hips = (color) => path(HIPS, color);

export const BOTTOMS = Object.freeze({
  b_shorts: { parts: [...limb(THIGH_BACK, '#1d3557', 22), ...limb(THIGH_FRONT, '#1d3557', 22), hips('#1d3557')] },
  b_runshorts: { parts: [...limb('M98 140 L97 166', '#e0483a', 21), ...limb('M118 140 L132 149', '#e0483a', 21), hips('#e0483a')] },
  b_leggings: { parts: [...limb(LEG_BACK, '#2b2b2b', 17), ...limb(LEG_FRONT, '#2b2b2b', 17), hips('#2b2b2b')] },
  b_joggers: {
    parts: [
      ...limb(PANTS_BACK, '#ff7a00', 21), ...limb(PANTS_FRONT, '#ff7a00', 21), hips('#ff7a00'),
      line('M112 150 C120 154 128 152 134 148', '#c75f00'),
    ],
  },
  b_skirt: { parts: [path('M86 134 L130 134 L142 176 L78 176 Z', '#f07ab4')] },
});

function shoes(color, sole = '#ffffff', sock = '#f6b8c8') {
  return [
    ...limb(SOCK_BACK, sock, 16), ...limb(SOCK_FRONT, sock, 16),
    line('M84 249 L99 250', '#7ccc3a', 2.5), line('M135 197 L150 199', '#7ccc3a', 2.5),
    path(FOOT_BACK, color), path(FOOT_FRONT, color),
    line('M82 270 L107 270', sole), line('M133 216 L158 216', sole),
  ];
}

export const SHOES = Object.freeze({
  s_none: { parts: [] },
  s_runner: { parts: shoes('#7ccc3a', '#3f8f2f') },
  s_white: { parts: shoes('#f4f4f4', '#9a9a9a') },
  s_blue: { parts: shoes('#2f80ed') },
  s_pink: { parts: shoes('#f07ab4') },
});

// ---------------------------------------------------------------------------
// Accessories (one at a time)
// ---------------------------------------------------------------------------

function glasses(frame, lens, width) {
  return [
    shape('circle', { cx: 86, cy: 68, r: 11 }, lens),
    shape('circle', { cx: 114, cy: 68, r: 11 }, lens),
    ['circle', { cx: 86, cy: 68, r: 11, fill: 'none', stroke: frame, 'stroke-width': width }],
    ['circle', { cx: 114, cy: 68, r: 11, fill: 'none', stroke: frame, 'stroke-width': width }],
    line('M97 68 L103 68', frame, width),
    line('M75 66 L63 63', frame, width), line('M125 66 L137 63', frame, width),
  ];
}

export const ACCESSORIES = Object.freeze({
  a_none: { parts: [] },
  a_cap: {
    parts: onHead([
      path('M62 58 C60 20 140 20 138 58 Z', '#2f80ed'),
      path('M100 58 C120 50 152 52 162 62 C140 67 118 65 100 62 Z', '#2f80ed'),
      ['circle', { cx: 100, cy: 27, r: 3, fill: W }],
    ]),
  },
  a_headband: { parts: onHead([path('M63 52 C80 40 120 40 137 52 L137 62 C120 50 80 50 63 62 Z', '#e0483a')]) },
  a_sunglasses: {
    parts: onHead([
      shape('rect', { x: 73, y: 60, width: 25, height: 15, rx: 7 }, '#222222'),
      shape('rect', { x: 102, y: 60, width: 25, height: 15, rx: 7 }, '#222222'),
      line('M98 65 L102 65', OL, 3), line('M73 64 L63 62', OL, 3), line('M127 64 L137 62', OL, 3),
    ]),
  },
  a_glasses: { parts: onHead(glasses(OL, 'none', 3)) },
  a_headphones: {
    parts: onHead([
      line('M60 70 C58 12 142 12 140 70', '#333333', 6),
      shape('rect', { x: 52, y: 58, width: 14, height: 26, rx: 6 }, '#e0483a'),
      shape('rect', { x: 134, y: 58, width: 14, height: 26, rx: 6 }, '#e0483a'),
    ]),
  },
  a_scarf: {
    parts: [
      path('M94 68 C102 80 118 80 126 68 L128 78 C118 90 102 90 92 78 Z', '#e0483a'),
      path('M116 84 L124 106 L114 108 L108 86 Z', '#e0483a'),
    ],
  },
  a_medal: {
    parts: [
      line('M98 74 L108 98 L120 74', '#2f80ed', 4),
      shape('circle', { cx: 108, cy: 104, r: 7 }, '#f6c445'),
      line('M108 100 V108', '#c4901a'),
    ],
  },
  a_watch: {
    parts: [shape('rect', { x: 47, y: 104, width: 12, height: 8, rx: 2, transform: 'rotate(-40 53 108)' }, '#222222')],
  },
});

// ---------------------------------------------------------------------------
// Golden set: LOCKED previews only. These IDs are NOT part of the avatar whitelist,
// so a stored avatar can never contain them. They are unlocked by rewards in Phase 5.
// ---------------------------------------------------------------------------

const GOLD = '#f4c430';

export const GOLDEN_SET = Object.freeze({
  g_glasses: { layer: 'acc', parts: onHead(glasses('#c4901a', '#ffe066', 4)) },
  g_vest: {
    layer: 'top',
    parts: [
      path('M80 84 L102 80 L104 152 L86 150 C82 128 80 104 80 84 Z', GOLD),
      path('M134 80 L114 78 L112 152 L130 150 C134 128 135 104 134 80 Z', GOLD),
      ['circle', { cx: 90, cy: 100, r: 2, fill: W }],
    ],
  },
  g_boots: {
    layer: 'shoes',
    parts: [
      ...limb('M93 226 L90.5 260', GOLD, 17), ...limb('M144.5 184 L141.5 206', GOLD, 17),
      path(FOOT_BACK, GOLD), path(FOOT_FRONT, GOLD),
      line('M82 270 L107 270', '#c4901a'), line('M133 216 L158 216', '#c4901a'),
    ],
  },
  g_crown: {
    layer: 'acc',
    parts: onHead([
      path('M70 34 L72 8 L87 22 L100 2 L113 22 L128 8 L130 34 Z', GOLD),
      ['circle', { cx: 100, cy: 24, r: 3.5, fill: '#e0483a' }],
      ['circle', { cx: 82, cy: 28, r: 2.5, fill: '#2f80ed' }],
      ['circle', { cx: 118, cy: 28, r: 2.5, fill: '#2f80ed' }],
    ]),
  },
  g_color: { layer: 'skin', skin: '#e6b422', parts: [] },
});
