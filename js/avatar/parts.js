// Avatar parts. All shapes are hard-coded data: [tagName, attributes].
// Attribute values that start with '@' are resolved at build time:
//   '@skin' -> the validated skin hex color, '@hair' -> the hair color for a whitelisted id.
// The keys of each map below ARE the whitelist of part IDs.

const OL = '#3a2a20'; // outline
const W = '#ffffff';

const ARM_L = 'M74 126 L52 188';
const ARM_R = 'M126 126 L148 188';
const SLEEVE_L = 'M74 126 L65 151';
const SLEEVE_R = 'M126 126 L135 151';
const LONG_L = 'M74 126 L54 182';
const LONG_R = 'M126 126 L146 182';
const LEG_L = 'M89 196 L86 266';
const LEG_R = 'M111 196 L114 266';

function limb(d, color, width) {
  return [
    ['path', { d, fill: 'none', stroke: OL, 'stroke-width': width + 6, 'stroke-linecap': 'round' }],
    ['path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round' }],
  ];
}

function shape(tag, attrs, fill) {
  return [tag, { ...attrs, fill, stroke: OL, 'stroke-width': 3, 'stroke-linejoin': 'round' }];
}

const path = (d, fill) => shape('path', { d }, fill);
const line = (d, color, width = 3) => ['path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round' }];

// ---------------------------------------------------------------------------
// Base body
// ---------------------------------------------------------------------------

export const BODY = Object.freeze({
  legs: [...limb(LEG_L, '@skin', 20), ...limb(LEG_R, '@skin', 20)],
  feet: [
    shape('ellipse', { cx: 82, cy: 270, rx: 12, ry: 7 }, '@skin'),
    shape('ellipse', { cx: 118, cy: 270, rx: 12, ry: 7 }, '@skin'),
  ],
  arms: [
    ...limb(ARM_L, '@skin', 18), ...limb(ARM_R, '@skin', 18),
    shape('circle', { cx: 52, cy: 191, r: 10 }, '@skin'),
    shape('circle', { cx: 148, cy: 191, r: 10 }, '@skin'),
  ],
  neck: [shape('rect', { x: 90, y: 96, width: 20, height: 22, rx: 6 }, '@skin')],
  torso: [shape('rect', { x: 66, y: 112, width: 68, height: 90, rx: 24 }, '@skin')],
  head: [
    shape('circle', { cx: 62, cy: 70, r: 9 }, '@skin'),
    shape('circle', { cx: 138, cy: 70, r: 9 }, '@skin'),
    shape('circle', { cx: 100, cy: 66, r: 38 }, '@skin'),
  ],
  face: [
    ['ellipse', { cx: 86, cy: 69, rx: 4.5, ry: 6, fill: OL }],
    ['ellipse', { cx: 114, cy: 69, rx: 4.5, ry: 6, fill: OL }],
    ['circle', { cx: 87.6, cy: 66.4, r: 1.6, fill: W }],
    ['circle', { cx: 115.6, cy: 66.4, r: 1.6, fill: W }],
    ['ellipse', { cx: 77, cy: 83, rx: 7, ry: 4, fill: '#ff6b6b', opacity: 0.35 }],
    ['ellipse', { cx: 123, cy: 83, rx: 7, ry: 4, fill: '#ff6b6b', opacity: 0.35 }],
    line('M79 56 Q86 51 93 56', '@hair', 3.5),
    line('M107 56 Q114 51 121 56', '@hair', 3.5),
    line('M88 86 Q100 97 112 86', OL, 3.5),
  ],
});

// ---------------------------------------------------------------------------
// Hair: { back: [...], front: [...] }. Display labels live in js/strings.js.
// ---------------------------------------------------------------------------

const HAIR_TOP = 'M62 66 C58 22 142 22 138 66 C130 46 112 42 100 46 C88 42 70 46 62 66 Z';

export const HAIR = Object.freeze({
  h_none: { back: [], front: [] },
  h_buzz: { back: [], front: [path('M64 58 C66 27 134 27 136 58 C122 45 78 45 64 58 Z', '@hair')] },
  h_short: { back: [], front: [path(HAIR_TOP, '@hair')] },
  h_spiky: {
    back: [],
    front: [path('M62 66 L60 40 L74 46 L76 26 L90 38 L100 18 L110 38 L124 26 L126 46 L140 40 L138 66 C126 48 74 48 62 66 Z', '@hair')],
  },
  h_long: {
    back: [path('M60 64 C56 20 144 20 140 64 L146 140 C130 148 70 148 54 140 Z', '@hair')],
    front: [path(HAIR_TOP, '@hair')],
  },
  h_bob: {
    back: [path('M58 62 C54 20 146 20 142 62 L144 104 C134 110 66 110 56 104 Z', '@hair')],
    front: [path('M62 66 C58 22 142 22 138 66 C120 50 100 46 84 50 C76 54 68 58 62 66 Z', '@hair')],
  },
  h_ponytail: {
    back: [path('M130 44 C172 38 178 104 150 124 C158 92 150 66 128 60 Z', '@hair')],
    front: [path(HAIR_TOP, '@hair')],
  },
  h_bun: {
    back: [shape('circle', { cx: 100, cy: 24, r: 16 }, '@hair')],
    front: [path(HAIR_TOP, '@hair')],
  },
  h_curly: {
    back: [],
    front: [[64, 62], [68, 46], [80, 34], [94, 28], [108, 28], [122, 34], [132, 46], [136, 62]]
      .map(([cx, cy]) => shape('circle', { cx, cy, r: 13 }, '@hair')),
  },
  h_mohawk: {
    back: [],
    front: [path('M90 58 C88 38 92 16 100 8 C108 16 112 38 110 58 C106 54 94 54 90 58 Z', '@hair')],
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

function tee(color) {
  return [
    ...limb(SLEEVE_L, color, 22), ...limb(SLEEVE_R, color, 22),
    shape('rect', { x: 64, y: 110, width: 72, height: 84, rx: 22 }, color),
    path('M86 111 Q100 124 114 111 Z', '@skin'),
  ];
}

function tank(color) {
  return [path('M72 112 L86 112 Q100 128 114 112 L128 112 Q137 150 134 194 L66 194 Q63 150 72 112 Z', color)];
}

function longSleeves(color, width = 22) {
  return [...limb(LONG_L, color, width), ...limb(LONG_R, color, width)];
}

export const TOPS = Object.freeze({
  t_tee: { parts: tee('#e0483a') },
  t_tank: { parts: tank('#2f80ed') },
  t_jersey: {
    parts: [
      ...tee('#ffffff'),
      ['rect', { x: 65.5, y: 138, width: 69, height: 9, fill: '#e0483a' }],
      ['rect', { x: 65.5, y: 160, width: 69, height: 9, fill: '#e0483a' }],
    ],
  },
  t_hoodie: {
    parts: [
      ...longSleeves('#3fae5a', 24),
      shape('rect', { x: 62, y: 108, width: 76, height: 90, rx: 22 }, '#3fae5a'),
      path('M80 162 H120 L124 188 H76 Z', '#36994e'),
      line('M80 110 Q100 132 120 110', OL),
      line('M94 120 V136', W, 2), line('M106 120 V136', W, 2),
    ],
  },
  t_jacket: {
    parts: [
      ...longSleeves('#7b4fd6'),
      shape('rect', { x: 63, y: 109, width: 74, height: 88, rx: 22 }, '#7b4fd6'),
      path('M86 110 L100 126 L114 110 Z', '@skin'),
      line('M100 126 V196', '#e5e5e5'),
    ],
  },
  t_singlet: {
    parts: [
      ...tank('#ffd23f'),
      shape('rect', { x: 84, y: 142, width: 32, height: 24, rx: 3 }, W),
      line('M92 150 H108', OL, 2.5), line('M92 158 H104', OL, 2.5),
    ],
  },
  t_tracksuit: {
    parts: [
      ...longSleeves('#1d3557'),
      line(LONG_L, W, 3), line(LONG_R, W, 3),
      shape('rect', { x: 63, y: 109, width: 74, height: 88, rx: 22 }, '#1d3557'),
      line('M71 124 V190', W, 3), line('M129 124 V190', W, 3),
      line('M100 112 V196', '#a8b4c8'),
    ],
  },
});

export const BOTTOMS = Object.freeze({
  b_shorts: { parts: [path('M66 186 H134 L138 226 H106 L100 208 L94 226 H62 Z', '#1d3557')] },
  b_runshorts: { parts: [path('M66 186 H134 L136 214 H104 L100 202 L96 214 H64 Z', '#e0483a')] },
  b_leggings: {
    parts: [...limb(LEG_L, '#2b2b2b', 22), ...limb(LEG_R, '#2b2b2b', 22), shape('rect', { x: 66, y: 184, width: 68, height: 20, rx: 8 }, '#2b2b2b')],
  },
  b_joggers: {
    parts: [
      ...limb(LEG_L, '#8d99ae', 26), ...limb(LEG_R, '#8d99ae', 26),
      shape('rect', { x: 64, y: 184, width: 72, height: 22, rx: 8 }, '#8d99ae'),
      line('M76 258 H96', OL, 2.5), line('M104 258 H124', OL, 2.5),
    ],
  },
  b_skirt: { parts: [path('M68 184 H132 L146 232 H54 Z', '#f07ab4')] },
});

function shoes(color, sole = W) {
  return [
    shape('ellipse', { cx: 82, cy: 270, rx: 16, ry: 9 }, color),
    shape('ellipse', { cx: 118, cy: 270, rx: 16, ry: 9 }, color),
    line('M69 274 H95', sole, 2.5), line('M105 274 H131', sole, 2.5),
  ];
}

export const SHOES = Object.freeze({
  s_none: { parts: [] },
  s_runner: { parts: shoes('#e0483a') },
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
    parts: [
      path('M62 58 C60 20 140 20 138 58 Z', '#2f80ed'),
      path('M100 58 C120 50 152 52 162 62 C140 67 118 65 100 62 Z', '#2f80ed'),
      ['circle', { cx: 100, cy: 27, r: 3, fill: W }],
    ],
  },
  a_headband: { parts: [path('M63 52 C80 40 120 40 137 52 L137 62 C120 50 80 50 63 62 Z', '#e0483a')] },
  a_sunglasses: {
    parts: [
      shape('rect', { x: 73, y: 60, width: 25, height: 15, rx: 7 }, '#222222'),
      shape('rect', { x: 102, y: 60, width: 25, height: 15, rx: 7 }, '#222222'),
      line('M98 65 L102 65', OL), line('M73 64 L63 62', OL), line('M127 64 L137 62', OL),
    ],
  },
  a_glasses: { parts: glasses(OL, 'none', 3) },
  a_headphones: {
    parts: [
      line('M60 70 C58 12 142 12 140 70', '#333333', 6),
      shape('rect', { x: 52, y: 58, width: 14, height: 26, rx: 6 }, '#e0483a'),
      shape('rect', { x: 134, y: 58, width: 14, height: 26, rx: 6 }, '#e0483a'),
    ],
  },
  a_scarf: {
    parts: [
      path('M76 104 C90 118 110 118 124 104 L126 118 C110 130 90 130 74 118 Z', '#e0483a'),
      path('M110 122 L118 150 L106 152 L102 124 Z', '#e0483a'),
    ],
  },
  a_medal: {
    parts: [
      line('M88 112 L100 138 L112 112', '#2f80ed', 6),
      shape('circle', { cx: 100, cy: 146, r: 10 }, '#f6c445'),
      line('M100 141 V151', '#c4901a', 2.5),
    ],
  },
  a_watch: {
    parts: [shape('rect', { x: 46, y: 172, width: 18, height: 11, rx: 3, transform: 'rotate(20 55 177)' }, '#222222')],
  },
});

// ---------------------------------------------------------------------------
// Golden set: LOCKED previews only. These IDs are NOT part of the avatar whitelist,
// so a stored avatar can never contain them. They are unlocked by rewards in Phase 5.
// ---------------------------------------------------------------------------

const GOLD = '#f4c430';

export const GOLDEN_SET = Object.freeze({
  g_glasses: { layer: 'acc', parts: glasses('#c4901a', '#ffe066', 4) },
  g_vest: {
    layer: 'top',
    parts: [
      path('M68 116 L94 116 L96 196 L72 196 C66 170 66 140 68 116 Z', GOLD),
      path('M132 116 L106 116 L104 196 L128 196 C134 170 134 140 132 116 Z', GOLD),
      ['circle', { cx: 80, cy: 140, r: 2.5, fill: W }],
    ],
  },
  g_boots: {
    layer: 'shoes',
    parts: [
      shape('rect', { x: 75, y: 244, width: 20, height: 26, rx: 5 }, GOLD),
      shape('rect', { x: 105, y: 244, width: 20, height: 26, rx: 5 }, GOLD),
      ...shoes(GOLD, '#c4901a'),
    ],
  },
  g_crown: {
    layer: 'acc',
    parts: [
      path('M70 34 L72 8 L87 22 L100 2 L113 22 L128 8 L130 34 Z', GOLD),
      ['circle', { cx: 100, cy: 24, r: 3.5, fill: '#e0483a' }],
      ['circle', { cx: 82, cy: 28, r: 2.5, fill: '#2f80ed' }],
      ['circle', { cx: 118, cy: 28, r: 2.5, fill: '#2f80ed' }],
    ],
  },
  g_color: { layer: 'skin', skin: '#e6b422', parts: [] },
});
