// Avatar parts: a faceless "stomper" seen from behind (three-quarter back view), mid high-knee
// stomp. Small round head sitting straight on the collar, boxy oversized clothes, flat fills
// with a thin dark edge. All shapes are hard-coded data: [tagName, attributes].
// Attribute values that start with '@' are resolved at build time:
//   '@skin' -> the validated skin hex color, '@hair' -> the hair color for a whitelisted id.
// The keys of each map below ARE the whitelist of part IDs (see docs/avatar-schema.md).
// Display labels live in js/strings.js. Concept notes: docs/design.md, "Avatar".

const EDGE = '#1b1820'; // thin dark edge
const EDGE_W = 1.8;
const W = '#ffffff';

// --- Skeleton (viewBox units) ----------------------------------------------------
// Head
const HEAD = { cx: 106, cy: 40, r: 18 };
// Arms: shoulder -> elbow -> wrist
const ARM_BACK = 'M76 70 L52 84 L42 98';
const ARM_FRONT = 'M134 68 L157 81 L165 97';
const UPPER_BACK = 'M76 70 L56 82';
const UPPER_FRONT = 'M134 68 L153 79';
const SLEEVE_BACK = 'M76 70 L52 84 L45 94';
const SLEEVE_FRONT = 'M134 68 L157 81 L162 91';
const HAND_BACK = { cx: 40, cy: 101 };
const HAND_FRONT = { cx: 166, cy: 100 };
// Legs: hip -> knee -> ankle. Front (raised) thigh is almost horizontal.
const LEG_BACK = 'M94 128 L92 186 L90 230';
const LEG_FRONT = 'M120 126 L158 136 L154 182';
const THIGH_BACK = 'M94 128 L92.5 172';
const THIGH_FRONT = 'M120 126 L152 134.4';
const PANTS_BACK = 'M94 128 L92 186 L90.8 208';
const PANTS_FRONT = 'M120 126 L158 136 L156 160';
const SOCK_BACK = 'M90.9 206 L90 230';
const SOCK_FRONT = 'M156.2 158 L154 182';
const ANKLE_BACK = { x: 90, y: 230 };
const ANKLE_FRONT = { x: 154, y: 182 };
// Torso
const TORSO = 'M70 70 C72 60 88 56 106 56 C124 56 138 60 140 70 L141 124 C124 132 86 132 70 124 Z';
const SWEATER = 'M66 70 C68 58 86 54 106 54 C126 54 142 58 144 70 L145 122 C126 131 84 131 66 122 Z';
const HEM = 'M66 113 C84 122 126 122 145 113 L145 124 C126 133 84 133 66 124 Z';
const VEST = 'M78 62 L92 57 C96 64 116 64 120 56 L132 60 C138 84 141 104 142 124 C124 132 86 132 69 124 C70 104 72 84 78 62 Z';
const HIPS = 'M74 116 L138 114 L139 136 C122 142 90 142 75 138 Z';

function limb(d, color, width) {
  const base = { d, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  return [
    ['path', { ...base, stroke: EDGE, 'stroke-width': width + EDGE_W * 2 }],
    ['path', { ...base, stroke: color, 'stroke-width': width }],
  ];
}

function shape(tag, attrs, fill) {
  return [tag, { ...attrs, fill, stroke: EDGE, 'stroke-width': EDGE_W, 'stroke-linejoin': 'round' }];
}

const path = (d, fill) => shape('path', { d }, fill);
const line = (d, color, width = 2) => ['path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }];
const circle = (cx, cy, r, fill) => shape('circle', { cx, cy, r }, fill);

// --- Feet -------------------------------------------------------------------------
/** Foot (or sock-covered foot) shape, toes pointing right, ankle at (x, y). */
const footShape = ({ x, y }) => `M${x - 8} ${y - 2} C${x - 10} ${y + 6} ${x - 7} ${y + 10} ${x} ${y + 10} L${x + 15} ${y + 10} C${x + 19} ${y + 9} ${x + 17} ${y + 3} ${x + 10} ${y + 1} L${x + 5} ${y - 3} Z`;
/** Chunky slide sole. */
const soleShape = ({ x, y }) => `M${x - 12} ${y + 8} C${x - 13} ${y + 14} ${x - 9} ${y + 15} ${x - 4} ${y + 15} L${x + 18} ${y + 15} C${x + 24} ${y + 15} ${x + 24} ${y + 8} ${x + 18} ${y + 8} Z`;
/** Slide strap over the foot. */
const strapShape = ({ x, y }) => `M${x - 8} ${y + 9} C${x - 6} ${y + 1} ${x + 8} ${y} ${x + 11} ${y + 9} Z`;
/** Closed sneaker. */
const sneakerShape = ({ x, y }) => `M${x - 9} ${y - 4} C${x - 12} ${y + 8} ${x - 9} ${y + 14} ${x - 2} ${y + 14} L${x + 18} ${y + 14} C${x + 24} ${y + 14} ${x + 23} ${y + 5} ${x + 13} ${y + 3} L${x + 7} ${y - 4} Z`;

// ---------------------------------------------------------------------------------
// Base body (faceless)
// ---------------------------------------------------------------------------------

export const BODY = Object.freeze({
  shadow: [['ellipse', { cx: 93, cy: 246, rx: 26, ry: 4, fill: '#000000', opacity: 0.5 }]],
  legs: [...limb(LEG_BACK, '@skin', 14), ...limb(LEG_FRONT, '@skin', 14)],
  feet: [path(footShape(ANKLE_BACK), '@skin'), path(footShape(ANKLE_FRONT), '@skin')],
  arms: [
    ...limb(ARM_BACK, '@skin', 10), ...limb(ARM_FRONT, '@skin', 10),
    circle(HAND_BACK.cx, HAND_BACK.cy, 6.5, '@skin'),
    circle(HAND_FRONT.cx, HAND_FRONT.cy, 6.5, '@skin'),
  ],
  hips: [path(HIPS, '@skin')],
  neck: [],
  torso: [path(TORSO, '@skin')],
  head: [circle(HEAD.cx, HEAD.cy, HEAD.r, '@skin')],
});

// ---------------------------------------------------------------------------------
// Hair, seen from behind: it covers the top and back of the head.
// ---------------------------------------------------------------------------------

const CAP = 'M88 44 C86 30 94 21 106 21 C119 21 126 30 124 42 C119 36 112 34 106 35 C99 35 92 38 88 44 Z';

export const HAIR = Object.freeze({
  h_none: { back: [], front: [] },
  h_buzz: { back: [], front: [path('M89 38 C91 26 98 22 106 22 C115 22 122 27 123 37 C117 32 96 31 89 38 Z', '@hair')] },
  // Shaggy mop with a jagged edge.
  h_short: {
    back: [],
    front: [path('M87 47 C84 31 93 21 106 21 C120 21 127 31 125 45 L121 40 L119 46 L115 39 L111 45 L107 38 L102 44 L98 38 L94 45 L91 40 Z', '@hair')],
  },
  h_spiky: {
    back: [],
    front: [path('M88 44 L84 30 L93 33 L94 21 L101 28 L106 16 L111 27 L119 20 L119 31 L128 29 L124 42 C118 36 96 36 88 44 Z', '@hair')],
  },
  h_long: {
    back: [path('M87 40 C86 24 96 20 106 20 C117 20 126 25 125 40 L128 76 C116 82 96 82 84 76 Z', '@hair')],
    front: [path(CAP, '@hair')],
  },
  h_bob: {
    back: [path('M86 42 C85 25 95 20 106 20 C118 20 127 26 126 42 L127 60 C118 66 94 66 85 60 Z', '@hair')],
    front: [path(CAP, '@hair')],
  },
  h_ponytail: {
    back: [path('M89 36 C74 36 68 52 72 70 C76 60 80 52 90 48 Z', '@hair')],
    front: [path(CAP, '@hair'), circle(89, 41, 3.2, '#e0483a')],
  },
  h_bun: {
    back: [circle(99, 20, 9, '@hair')],
    front: [path(CAP, '@hair')],
  },
  // Round cloud of curls.
  h_curly: {
    back: [],
    front: [[90, 36, 8], [95, 27, 8], [105, 23, 8.5], [115, 26, 8], [122, 34, 7.5], [88, 45, 6.5], [124, 43, 6]]
      .map(([cx, cy, r]) => circle(cx, cy, r, '@hair')),
  },
  h_mohawk: {
    back: [],
    front: [path('M98 24 C99 12 112 9 119 18 L117 26 C113 22 104 22 100 27 Z', '@hair')],
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

// ---------------------------------------------------------------------------------
// Tops: boxy and oversized, with knit / sewn details
// ---------------------------------------------------------------------------------

const longSleeves = (color, cuff) => [
  ...limb(SLEEVE_BACK, color, 17), ...limb(SLEEVE_FRONT, color, 17),
  ...(cuff ? [line('M42 89 L51 97', cuff, 4), line('M156 91 L167 88', cuff, 4)] : []),
];
const shortSleeves = (color) => [...limb(UPPER_BACK, color, 20), ...limb(UPPER_FRONT, color, 20)];
const collarRib = (color) => line('M93 56 C99 62 113 62 119 56', color, 4);

export const TOPS = Object.freeze({
  // Oversized tee with wide short sleeves.
  t_tee: { parts: [...shortSleeves('#e0483a'), path(SWEATER, '#e0483a'), collarRib('#b8352a')] },
  t_tank: { parts: [path(VEST, '#2f80ed'), line('M80 116 C96 122 118 122 140 116', '#2568c2', 2)] },
  // Knit sweater: diamond band, ribbed hem and cuffs (the default look).
  t_jersey: {
    parts: [
      ...longSleeves('#8a4fb0', '#6c3a8c'),
      path(SWEATER, '#8a4fb0'),
      line('M78 84 L85 92 L92 84 L99 92 L106 84 L113 92 L120 84 L127 92 L134 84', '#6c3a8c'),
      line('M78 92 L85 84 L92 92 L99 84 L106 92 L113 84 L120 92 L127 84 L134 92', '#6c3a8c'),
      line('M76 78 C96 82 116 82 136 78', '#6c3a8c', 1.6),
      path(HEM, '#6c3a8c'),
      line('M78 117 V127 M88 119 V129 M98 120 V130 M108 120 V130 M118 120 V130 M128 119 V129 M137 117 V127', '#5a2f76', 1.4),
      collarRib('#6c3a8c'),
    ],
  },
  // Hoodie: hood bunched behind the neck, front pocket.
  t_hoodie: {
    parts: [
      ...longSleeves('#3fae5a', '#2f8a46'),
      path(SWEATER, '#3fae5a'),
      path('M86 60 C86 46 126 46 126 60 L118 66 L94 66 Z', '#2f8a46'),
      path('M84 96 L128 95 L131 113 L81 114 Z', '#36994e'),
      path(HEM, '#2f8a46'),
    ],
  },
  // Button-up shirt with collar and sleeves rolled to the elbow.
  t_jacket: {
    parts: [
      ...limb('M76 70 L54 83', '#e0483a', 19), ...limb('M134 68 L155 80', '#e0483a', 19),
      line('M51 80 L59 88', '#b8352a', 5), line('M151 76 L157 85', '#b8352a', 5),
      path(SWEATER, '#e0483a'),
      path('M92 54 L106 63 L100 70 Z', '#c43c30'), path('M120 54 L106 63 L113 70 Z', '#c43c30'),
      line('M106 64 L107 126', '#b8352a', 1.6),
      ['circle', { cx: 106.3, cy: 80, r: 1.6, fill: W }], ['circle', { cx: 106.6, cy: 96, r: 1.6, fill: W }], ['circle', { cx: 106.9, cy: 112, r: 1.6, fill: W }],
      line('M120 92 L130 92', '#b8352a', 1.6),
    ],
  },
  // Race singlet with a number bib on the back.
  t_singlet: {
    parts: [
      path(VEST, '#ffd23f'),
      shape('rect', { x: 92, y: 80, width: 28, height: 22, rx: 3 }, W),
      line('M98 88 H114', EDGE, 2.2), line('M98 95 H110', EDGE, 2.2),
    ],
  },
  // Track jacket: stripes down sleeves and sides.
  t_tracksuit: {
    parts: [
      ...longSleeves('#1d3557', '#13263f'),
      line(SLEEVE_BACK, W, 2.2), line(SLEEVE_FRONT, W, 2.2),
      path(SWEATER, '#1d3557'),
      line('M70 76 L70 120', W, 2.4), line('M141 76 L141 120', W, 2.4),
      path(HEM, '#13263f'),
      collarRib('#13263f'),
    ],
  },
});

// ---------------------------------------------------------------------------------
// Bottoms: baggy cuts
// ---------------------------------------------------------------------------------

const hips = (color) => path(HIPS, color);

export const BOTTOMS = Object.freeze({
  // Baggy shorts to the knee.
  b_shorts: { parts: [...limb(THIGH_BACK, '#1d3557', 27), ...limb(THIGH_FRONT, '#1d3557', 27), hips('#1d3557'), line('M110 120 L111 138', '#13263f', 1.6)] },
  b_runshorts: { parts: [...limb('M94 128 L93.4 152', '#e0483a', 25), ...limb('M120 126 L140 131', '#e0483a', 25), hips('#e0483a'), line('M84 146 L102 146', W, 2)] },
  b_leggings: { parts: [...limb(LEG_BACK, '#2b2b33', 16), ...limb(LEG_FRONT, '#2b2b33', 16), hips('#2b2b33')] },
  // Baggy joggers that taper into the socks (the default look).
  b_joggers: {
    parts: [
      ...limb('M94 128 L92 186', '#f5821f', 27), ...limb('M92 186 L90.8 208', '#f5821f', 22),
      ...limb('M120 126 L158 136', '#f5821f', 27), ...limb('M158 136 L156 160', '#f5821f', 22),
      hips('#f5821f'),
      line('M86 156 C90 162 96 164 100 162', '#c9650f', 1.6),
      line('M132 124 C140 130 148 130 154 128', '#c9650f', 1.6),
    ],
  },
  // Pleated skirt.
  b_skirt: {
    parts: [
      path('M74 116 L138 114 L150 152 L66 154 Z', '#f07ab4'),
      line('M88 118 L84 152 M102 118 L101 153 M116 117 L118 153 M128 116 L134 152', '#c95c91', 1.6),
    ],
  },
});

// ---------------------------------------------------------------------------------
// Shoes (with long socks, like the reference look)
// ---------------------------------------------------------------------------------

function slides(sole, sock = '#f7b8c8', band = '#7ccc3a') {
  return [
    ...limb(SOCK_BACK, sock, 16), ...limb(SOCK_FRONT, sock, 16),
    line('M82 211 L99 211', band, 3), line('M147 164 L164 165', band, 3),
    path(footShape(ANKLE_BACK), sock), path(footShape(ANKLE_FRONT), sock),
    path(soleShape(ANKLE_BACK), sole), path(soleShape(ANKLE_FRONT), sole),
    path(strapShape(ANKLE_BACK), sole), path(strapShape(ANKLE_FRONT), sole),
  ];
}

function sneakers(color, sole, sock = '#ffffff') {
  return [
    ...limb(SOCK_BACK, sock, 16), ...limb(SOCK_FRONT, sock, 16),
    path(sneakerShape(ANKLE_BACK), color), path(sneakerShape(ANKLE_FRONT), color),
    line(`M${ANKLE_BACK.x - 10} ${ANKLE_BACK.y + 12} L${ANKLE_BACK.x + 21} ${ANKLE_BACK.y + 12}`, sole, 3),
    line(`M${ANKLE_FRONT.x - 10} ${ANKLE_FRONT.y + 12} L${ANKLE_FRONT.x + 21} ${ANKLE_FRONT.y + 12}`, sole, 3),
  ];
}

export const SHOES = Object.freeze({
  s_none: { parts: [] },
  s_runner: { parts: slides('#7ccc3a') },
  s_white: { parts: sneakers('#f4f4f4', '#b5b5b5') },
  s_blue: { parts: sneakers('#2f80ed', '#ffffff', '#dfe8f5') },
  s_pink: { parts: slides('#f07ab4', '#ffffff', '#f07ab4') },
});

// ---------------------------------------------------------------------------------
// Accessories (one at a time). Seen from behind: glasses show as arms + the lens edge.
// ---------------------------------------------------------------------------------

function sideGlasses(frame, lens, width) {
  return [
    line('M95 39 L121 37', frame, width),
    shape('ellipse', { cx: 123.5, cy: 39, rx: 3.2, ry: 5 }, lens),
    ['ellipse', { cx: 123.5, cy: 39, rx: 3.2, ry: 5, fill: 'none', stroke: frame, 'stroke-width': width }],
  ];
}

export const ACCESSORIES = Object.freeze({
  a_none: { parts: [] },
  // Cap with the brim pointing forward (to the right).
  a_cap: {
    parts: [
      path('M87 38 C86 23 96 19 106 19 C117 19 126 24 125 37 Z', '#2f80ed'),
      path('M119 34 C128 32 139 33 143 37 C136 40 127 39 120 38 Z', '#2568c2'),
      line('M97 37 C102 34 110 34 115 36', '#2568c2', 1.4),
    ],
  },
  a_headband: { parts: [path('M88 33 C96 27 116 27 124 33 L124 39 C116 33 96 33 88 39 Z', '#e0483a')] },
  a_sunglasses: { parts: sideGlasses('#222222', '#222222', 2.2) },
  a_glasses: { parts: sideGlasses(EDGE, 'none', 1.8) },
  a_headphones: {
    parts: [
      line('M89 42 C88 16 124 16 123 42', '#333333', 3.5),
      shape('rect', { x: 84, y: 36, width: 8, height: 14, rx: 3 }, '#e0483a'),
    ],
  },
  a_scarf: {
    parts: [
      path('M88 52 C96 62 116 62 124 52 L126 61 C116 71 96 71 86 61 Z', '#e0483a'),
      path('M92 62 L82 86 L91 88 L98 66 Z', '#e0483a'),
      line('M84 80 L92 82', '#b8352a', 1.4),
    ],
  },
  a_medal: {
    parts: [
      line('M96 58 L106 80 L118 58', '#2f80ed', 3.5),
      circle(106, 86, 6.5, '#f6c445'),
      line('M106 82.5 V89.5', '#c4901a', 1.6),
    ],
  },
  a_watch: {
    parts: [shape('rect', { x: 42, y: 89, width: 11, height: 7, rx: 2, transform: 'rotate(-55 47.5 92.5)' }, '#222222')],
  },
});

// ---------------------------------------------------------------------------------
// Golden set: LOCKED previews only. These IDs are NOT part of the avatar whitelist,
// so a stored avatar can never contain them. They are unlocked by rewards in Phase 5.
// ---------------------------------------------------------------------------------

const GOLD = '#f4c430';
const GOLD_DARK = '#c4901a';

export const GOLDEN_SET = Object.freeze({
  g_glasses: { layer: 'acc', parts: sideGlasses(GOLD_DARK, '#ffe066', 2.6) },
  // Puffer vest panels over the top.
  g_vest: {
    layer: 'top',
    parts: [
      path('M70 66 L100 58 L102 128 L71 124 C70 104 70 84 70 66 Z', GOLD),
      path('M142 66 L112 58 L110 128 L141 124 C142 104 142 84 142 66 Z', GOLD),
      line('M72 86 L100 84 M72 104 L101 103 M140 86 L112 84 M140 104 L111 103', GOLD_DARK, 1.6),
    ],
  },
  g_boots: {
    layer: 'shoes',
    parts: [
      ...limb('M91.2 198 L90 230', GOLD, 18), ...limb('M156.8 152 L154 182', GOLD, 18),
      path(sneakerShape(ANKLE_BACK), GOLD), path(sneakerShape(ANKLE_FRONT), GOLD),
      line(`M${ANKLE_BACK.x - 10} ${ANKLE_BACK.y + 12} L${ANKLE_BACK.x + 21} ${ANKLE_BACK.y + 12}`, GOLD_DARK, 3),
      line(`M${ANKLE_FRONT.x - 10} ${ANKLE_FRONT.y + 12} L${ANKLE_FRONT.x + 21} ${ANKLE_FRONT.y + 12}`, GOLD_DARK, 3),
    ],
  },
  g_crown: {
    layer: 'acc',
    parts: [
      path('M92 26 L91 10 L99 17 L106 6 L113 17 L121 10 L120 26 Z', GOLD),
      circle(106, 19, 2.2, '#e0483a'),
    ],
  },
  g_color: { layer: 'skin', skin: '#e6b422', parts: [] },
});
