// Avatar parts: the "mannequin runner" (docs/design.md, section 7). A faceless studio mannequin
// in side profile, facing right, mid-stride: near leg planted, far leg trailing, arms opposite.
// All shapes are hard-coded data: [tagName, attributes, kind?]. kind 'surf' marks a surface
// that receives the studio lighting overlay in avatar.js; lines and details have no kind.
// Attribute values that start with '@' are resolved at build time:
//   '@skin' -> the validated body colour, '@hair' -> the hair colour for a whitelisted id.
// Each part is split into drawing slots so it can sit at the right depth:
//   back (behind everything), far (far-side limbs), main (torso), near (near-side limbs),
//   head (on the head). avatar.js decides the order.
// The keys of each map below ARE the whitelist of part IDs (see docs/avatar-schema.md).
// Display labels live in js/strings.js.

const EDGE = '#15151b';
const EDGE_OPACITY = 0.55;
const EDGE_W = 1.2;
const W = '#ffffff';

// --- Skeleton (viewBox units, frame 26 4 158 250) -------------------------------------
const P = Object.freeze({
  // Near leg: planted under the body, soft knee, foot flat.
  nearHip: [101, 126], nearKnee: [114, 176], nearAnkle: [108, 224],
  // Far leg: trailing behind, foot pointing down and back off the toes.
  farHip: [97, 124], farKnee: [82, 174], farAnkle: [54, 214],
  // Far arm: forward, elbow ~90 degrees, fist at chest height.
  farShoulder: [106, 62], farElbow: [116, 96], farWrist: [138, 78], farFist: [141, 76],
  // Near arm: swung back, forearm hanging, hand at hip height.
  nearShoulder: [101, 62], nearElbow: [81, 90], nearWrist: [85, 116], nearFist: [85.5, 120.5],
  neckBase: [104, 57], neckTop: [109, 41],
});
const LIMB = Object.freeze({ thigh: 19, calf: 13, upperArm: 11, forearm: 9, neck: 10 });

/** Head: an egg tilted forward with the lean. Hair and head accessories are drawn in its frame. */
const HEAD = Object.freeze({ cx: 114, cy: 29, rx: 11.5, ry: 14.5 });
const HEAD_T = `rotate(14 ${HEAD.cx} ${HEAD.cy})`;
/** Feet are drawn in a local frame: ankle at 0,0, toes towards +x, sole towards +y. */
const FOOT_NEAR_T = `translate(${P.nearAnkle[0]} ${P.nearAnkle[1]}) scale(0.88)`;
const FOOT_FAR_T = `translate(${P.farAnkle[0]} ${P.farAnkle[1]}) rotate(60) scale(0.88)`;

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const pt = ([x, y]) => `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`;
const seg = (...points) => `M${points.map(pt).join(' L')}`;

// --- Drawing helpers -------------------------------------------------------------------

/** Filled surface with the thin translucent edge. */
function shape(tag, attrs, fill) {
  return [tag, { ...attrs, fill, stroke: EDGE, 'stroke-opacity': EDGE_OPACITY, 'stroke-width': EDGE_W, 'stroke-linejoin': 'round' }, 'surf'];
}
const path = (d, fill, transform) => shape('path', transform ? { d, transform } : { d }, fill);
const circle = (cx, cy, r, fill, transform) => shape('circle', transform ? { cx, cy, r, transform } : { cx, cy, r }, fill);
/** Detail line (seam, stripe, stitch). No lighting. */
const line = (d, color, width = 1.4, transform, opacity) => ['path', {
  d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  ...(transform ? { transform } : {}), ...(opacity ? { 'stroke-opacity': opacity } : {}),
}];

/**
 * A tapered tube along a chain of segments: [[d, width], ...]. All edges first, then all colours,
 * so the joints stay clean; then a soft highlight along the upper-left of each segment.
 * cap 'butt' cuts the ends straight (hems of shorts and short sleeves).
 */
function tube(segments, color, highlight = true, cap = 'round') {
  const base = { fill: 'none', 'stroke-linecap': cap, 'stroke-linejoin': 'round' };
  return [
    ...segments.map(([d, w]) => ['path', { ...base, d, stroke: EDGE, 'stroke-opacity': EDGE_OPACITY, 'stroke-width': w + EDGE_W * 2 }]),
    ...segments.map(([d, w]) => ['path', { ...base, d, stroke: color, 'stroke-width': w }, 'surf']),
    ...(highlight ? segments.map(([d, w]) => ['path', { ...base, d, stroke: W, 'stroke-opacity': 0.14, 'stroke-width': Math.max(1.5, w * 0.34), transform: 'translate(-1.1 -1.3)' }]) : []),
  ];
}

// Limb chains (start → joint → end) with an optional start/end fraction, for sleeves and legs.
const nearLegSegs = (w1 = LIMB.thigh, w2 = LIMB.calf, until = 1) => until <= 0.5
  ? [[seg(P.nearHip, lerp(P.nearHip, P.nearKnee, until * 2)), w1]]
  : [[seg(P.nearHip, P.nearKnee), w1], [seg(P.nearKnee, lerp(P.nearKnee, P.nearAnkle, (until - 0.5) * 2)), w2]];
const farLegSegs = (w1 = LIMB.thigh, w2 = LIMB.calf, until = 1) => until <= 0.5
  ? [[seg(P.farHip, lerp(P.farHip, P.farKnee, until * 2)), w1]]
  : [[seg(P.farHip, P.farKnee), w1], [seg(P.farKnee, lerp(P.farKnee, P.farAnkle, (until - 0.5) * 2)), w2]];
const nearArmSegs = (w1 = LIMB.upperArm, w2 = LIMB.forearm, until = 1) => until <= 0.5
  ? [[seg(P.nearShoulder, lerp(P.nearShoulder, P.nearElbow, until * 2)), w1]]
  : [[seg(P.nearShoulder, P.nearElbow), w1], [seg(P.nearElbow, lerp(P.nearElbow, P.nearWrist, (until - 0.5) * 2)), w2]];
const farArmSegs = (w1 = LIMB.upperArm, w2 = LIMB.forearm, until = 1) => until <= 0.5
  ? [[seg(P.farShoulder, lerp(P.farShoulder, P.farElbow, until * 2)), w1]]
  : [[seg(P.farShoulder, P.farElbow), w1], [seg(P.farElbow, lerp(P.farElbow, P.farWrist, (until - 0.5) * 2)), w2]];

// --- Feet (local frame) ---------------------------------------------------------------
const FOOT = 'M-6 -3 C-10 1 -9.5 9 -3.5 9 L17 9 C22 9 23 4.5 18.5 2.5 L6.5 -2.5 Z';
const SHOE = 'M-7.5 -5 C-11.5 1 -11.5 10.5 -5 10.5 L19.5 10.5 C25 10.5 25.5 4 20 2 L9 -4 C5 -6 -2 -7 -7.5 -5 Z';
const SHOE_SOLE = 'M-10 8.6 L23.5 8.6';
const SHOE_STRIPE = 'M-3 4 L6 -0.5 M1 6 L11 1';

// --- Torso and garments (world frame) -------------------------------------------------
const TORSO = 'M99 50 C92 54 88 63 88 76 C88 90 93 99 92 108 C88 116 86 125 88 134 C95 140 106 141 113 137 C115 128 114 117 112 106 C113 96 119 89 119 76 C119 64 115 55 111 50 Z';
const TOP_BODY = 'M97 47 C89 52 85 62 85 76 C85 90 90 99 89 109 C87 117 86 125 87 133 C95 138 106 139 115 135 C116 126 116 116 114 106 C115 96 122 89 122 76 C122 63 118 54 113 47 C108 52 102 52 97 47 Z';
const TANK_BODY = 'M99 51 C95 59 89 64 88 76 C87 90 91 99 90 109 C88 117 87 125 88 133 C95 138 106 139 115 135 C116 126 116 116 114 106 C115 96 121 89 121 77 C121 67 117 59 112 51 C108 56 103 56 99 51 Z';
const TOP_HEM = 'M87 127 C95 131 106 132 115.5 129 L115 135 C106 139 95 138 87 133 Z';
const PELVIS = 'M89 111 C96 115 106 115 113 111 C114 118 115 126 114 133 C112 139 108 142 103 143 C96 144 90 142 87 137 C86 128 87 119 89 111 Z';

// ---------------------------------------------------------------------------------------
// Base body (faceless mannequin)
// ---------------------------------------------------------------------------------------

export const BODY = Object.freeze({
  shadow: [
    ['ellipse', { cx: 113, cy: 235, rx: 21, ry: 3.2, fill: '#000000', opacity: 0.45 }],
    ['ellipse', { cx: 62, cy: 235, rx: 9, ry: 2.2, fill: '#000000', opacity: 0.3 }],
  ],
  farLeg: [...tube(farLegSegs(), '@skin'), path(FOOT, '@skin', FOOT_FAR_T)],
  farArm: [...tube(farArmSegs(), '@skin'), circle(P.farFist[0], P.farFist[1], 5.6, '@skin')],
  torso: [
    path(TORSO, '@skin'),
    line('M93 108 C99 111 105 111 110 107', EDGE, 1, undefined, 0.45), // waist seam
  ],
  neck: [...tube([[seg(P.neckBase, P.neckTop), LIMB.neck]], '@skin', false), line('M100 54 C103 57 107 57 110 53', EDGE, 1, undefined, 0.4)],
  nearLeg: [...tube(nearLegSegs(), '@skin'), path(FOOT, '@skin', FOOT_NEAR_T)],
  head: [shape('ellipse', { cx: HEAD.cx, cy: HEAD.cy, rx: HEAD.rx, ry: HEAD.ry, transform: HEAD_T }, '@skin')],
  nearArm: [
    ...tube(nearArmSegs(), '@skin'),
    circle(P.nearFist[0], P.nearFist[1], 5.6, '@skin'),
    line('M81 114 L89 114.6', EDGE, 1, undefined, 0.4), // wrist seam
  ],
});

// ---------------------------------------------------------------------------------------
// Hair, in the head's frame (profile, facing right: back of the head is at x ≈ 102.5).
// ---------------------------------------------------------------------------------------

const hairPath = (d) => path(d, '@hair', HEAD_T);
const CAP = 'M101.5 33 C99.5 18 106 12.5 114 12.5 C121.5 12.5 127 18 126.5 25 C120 20.5 112 21 107 25 C104 28 103 31 103.5 36 Z';

export const HAIR = Object.freeze({
  h_none: { back: [], front: [] },
  h_buzz: { back: [], front: [hairPath('M102.6 31 C101.5 20 107 14.3 114 14.3 C120 14.3 124 18 125 22 C120 19 114 19 110 22 C106 25 104 28 104.5 33 Z')] },
  h_short: { back: [], front: [hairPath('M101.5 33 C99.5 19 106 12.5 114 12.5 C121 12.5 126.5 17 127 23 C124 21 121 21.5 119 23 C116 20.5 111 21 108 24 C105.5 27 104.5 31 105 35 Z')] },
  h_spiky: { back: [], front: [hairPath('M102 33 L97.5 26.5 L103 24 L99.5 16 L107 17.5 L107 9 L113 14 L117.5 7 L119.5 14 L126.5 12 L124.5 19 L128.5 22.5 C122 20 114 21 109 24 C106 27 104.5 30 105 35 Z')] },
  h_long: {
    back: [path('M103 21 C95 29 94 50 95 72 C99 76 104 76 106.5 71 C104.5 58 105 46 109 37 Z', '@hair')],
    front: [hairPath(CAP)],
  },
  h_bob: {
    back: [path('M102 21 C95.5 29 95.5 42 97.5 49 C101.5 52 108 51 110.5 46.5 C108.5 40 108.5 34 110 27 Z', '@hair')],
    front: [hairPath(CAP)],
  },
  h_ponytail: {
    back: [path('M104 21 C95 18 84 23 79 36 C82 40 85 39 87 36 C90 31 95 29 101 30 Z', '@hair')],
    front: [hairPath(CAP), circle(102.5, 25.5, 2.6, '#e0483a', HEAD_T)],
  },
  h_bun: { back: [], front: [hairPath(CAP), circle(103, 17.5, 6.5, '@hair', HEAD_T)] },
  h_curly: {
    back: [],
    front: [[105, 27, 6.5], [104, 19, 6.5], [110, 14, 6.5], [117.5, 13, 6], [123.5, 17, 5.5], [101.5, 33, 5]]
      .map(([cx, cy, r]) => circle(cx, cy, r, '@hair', HEAD_T)),
  },
  // Crest from the nape over the crown to the forehead.
  h_mohawk: { back: [], front: [hairPath('M102.7 32 C98.5 22 100.5 11.5 108 7.5 C115 3.8 123.5 6 126.8 12 L124.6 17.3 C121.5 15.3 118 14.5 114 14.5 C107.5 14.5 103.5 19.5 102.7 26 Z')] },
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

// ---------------------------------------------------------------------------------------
// Tops: fitted sportswear following the tubes a little wider
// ---------------------------------------------------------------------------------------

const SLEEVE_W = [LIMB.upperArm + 5, LIMB.forearm + 4];
const shortSleeves = (color) => ({
  far: tube(farArmSegs(SLEEVE_W[0] + 1, SLEEVE_W[1], 0.3), color, false, 'butt'),
  near: tube(nearArmSegs(SLEEVE_W[0] + 1, SLEEVE_W[1], 0.3), color, false, 'butt'),
});
const longSleeves = (color) => ({
  far: tube(farArmSegs(SLEEVE_W[0], SLEEVE_W[1], 0.94), color),
  near: tube(nearArmSegs(SLEEVE_W[0], SLEEVE_W[1], 0.94), color),
});
const cuff = (arm, color) => {
  const [elbow, wrist] = arm === 'far' ? [P.farElbow, P.farWrist] : [P.nearElbow, P.nearWrist];
  return tube([[seg(lerp(elbow, wrist, 0.76), lerp(elbow, wrist, 0.88)), SLEEVE_W[1] + 0.6]], color, false);
};

export const TOPS = Object.freeze({
  // Fitted tee with crew neck.
  t_tee: {
    ...shortSleeves('#e0483a'),
    main: [path(TOP_BODY, '#e0483a'), line('M98 48.5 C102 53 108 53 112 48.5', '#b8352a', 2.2)],
  },
  // Racer tank: bare shoulders, deep armhole.
  t_tank: {
    far: [], near: [],
    main: [path(TANK_BODY, '#2f80ed'), line('M100 52.5 C103 57 107 57 110 52.5', '#2568c2', 1.8), line('M96 64 C98 76 104 82 111 80', '#2568c2', 1.2)],
  },
  // Knit sweater: ribbed hem and cuffs, zigzag band.
  t_jersey: {
    far: [...longSleeves('#8a4fb0').far, ...cuff('far', '#6c3a8c')],
    near: [...longSleeves('#8a4fb0').near, ...cuff('near', '#6c3a8c')],
    main: [
      path(TOP_BODY, '#8a4fb0'),
      line('M87 86 L91 81 L95 86 L99 81 L103 86 L107 81 L111 86 L115 81 L119 86', '#6c3a8c', 1.4),
      line('M87 92 L91 87 L95 92 L99 87 L103 92 L107 87 L111 92 L115 87 L119 92', '#6c3a8c', 1.4),
      path(TOP_HEM, '#6c3a8c'),
      line('M92 128 V134 M97 129 V135 M102 129.5 V135.5 M107 129 V135', '#5a2f76', 1),
      line('M98 48.5 C102 53 108 53 112 48.5', '#6c3a8c', 2.6),
    ],
  },
  // Hoodie: hood resting on the back, front pouch pocket.
  t_hoodie: {
    ...longSleeves('#3fae5a'),
    main: [
      path(TOP_BODY, '#3fae5a'),
      path('M99 47 C92 46 87 52 87 60 C90 64 95 64 99 60 C99 56 101 52 104 50 Z', '#2f8a46'),
      path('M101 104 L115.5 103 C116 110 116 116 115.5 122 L100 122 C101 115 101.5 110 101 104 Z', '#36994e'),
      line('M108 50 L109 62 M111 50 L112.5 61', W, 1.1),
      path(TOP_HEM, '#2f8a46'),
    ],
  },
  // Shirt-jacket: collar, front placket, sleeves rolled to the elbow.
  t_jacket: {
    far: [...tube(farArmSegs(SLEEVE_W[0], SLEEVE_W[1], 0.5), '#e0483a', false, 'butt'), ...tube([[seg(lerp(P.farShoulder, P.farElbow, 0.8), lerp(P.farShoulder, P.farElbow, 0.98)), SLEEVE_W[0] + 2]], '#b8352a', false, 'butt')],
    near: [...tube(nearArmSegs(SLEEVE_W[0], SLEEVE_W[1], 0.5), '#e0483a', false, 'butt'), ...tube([[seg(lerp(P.nearShoulder, P.nearElbow, 0.8), lerp(P.nearShoulder, P.nearElbow, 0.98)), SLEEVE_W[0] + 2]], '#b8352a', false, 'butt')],
    main: [
      path(TOP_BODY, '#e0483a'),
      path('M98 47 L104 55 L99 59 L95 51 Z', '#c43c30'),
      path('M112 47 L109 56 L114 58 L116 52 Z', '#c43c30'),
      line('M118 60 C119.5 72 119 86 116 98 C114.5 108 115 120 114.5 132', '#b8352a', 1.4),
      ['circle', { cx: 119.2, cy: 72, r: 1.3, fill: W }], ['circle', { cx: 117.6, cy: 90, r: 1.3, fill: W }], ['circle', { cx: 115, cy: 108, r: 1.3, fill: W }],
      line('M93 96 L100 96', '#b8352a', 1.2),
    ],
  },
  // Race singlet with a number bib on the side.
  t_singlet: {
    far: [], near: [],
    main: [
      path(TANK_BODY, '#ffd23f'),
      line('M100 52.5 C103 57 107 57 110 52.5', '#d9ad1f', 1.8),
      shape('rect', { x: 97, y: 84, width: 15, height: 13, rx: 2, transform: 'rotate(-4 104.5 90.5)' }, W),
      line('M100 89 H109 M100 93 H106', EDGE, 1.6, 'rotate(-4 104.5 90.5)'),
    ],
  },
  // Track jacket: stripes along the arms and the side seam, front zip.
  t_tracksuit: {
    far: [...longSleeves('#1d3557').far, ...cuff('far', '#13263f'), line(seg(P.farShoulder, P.farElbow, lerp(P.farElbow, P.farWrist, 0.76)), W, 1.6)],
    near: [...longSleeves('#1d3557').near, ...cuff('near', '#13263f'), line(seg(P.nearShoulder, P.nearElbow, lerp(P.nearElbow, P.nearWrist, 0.76)), W, 1.6)],
    main: [
      path(TOP_BODY, '#1d3557'),
      line('M101 64 C99 80 101 100 99 130', W, 2),
      line('M120 58 C121 72 119.5 88 116 99 C114.5 110 115 122 114.5 134', '#a8b3c4', 1.1),
      path(TOP_HEM, '#13263f'),
      line('M98 48.5 C102 53 108 53 112 48.5', '#13263f', 2.6),
    ],
  },
});

// ---------------------------------------------------------------------------------------
// Bottoms
// ---------------------------------------------------------------------------------------

const pelvis = (color) => path(PELVIS, color);

export const BOTTOMS = Object.freeze({
  // Loose shorts to the knee.
  b_shorts: {
    far: tube(farLegSegs(LIMB.thigh + 7, 0, 0.42), '#1d3557', false, 'butt'),
    near: tube(nearLegSegs(LIMB.thigh + 7, 0, 0.42), '#1d3557', false, 'butt'),
    main: [pelvis('#1d3557'), line('M90 116 C96 119 105 119 111 116', '#13263f', 1.4)],
  },
  // Split running shorts, high on the thigh.
  b_runshorts: {
    far: tube(farLegSegs(LIMB.thigh + 4, 0, 0.24), '#e0483a', false, 'butt'),
    near: tube(nearLegSegs(LIMB.thigh + 4, 0, 0.24), '#e0483a', false, 'butt'),
    main: [pelvis('#e0483a'), line('M90 116 C96 119 105 119 111 116', '#b8352a', 1.4)],
  },
  b_leggings: {
    far: tube(farLegSegs(LIMB.thigh + 1.5, LIMB.calf + 1.5, 0.92), '#2b2b33'),
    near: tube(nearLegSegs(LIMB.thigh + 1.5, LIMB.calf + 1.5, 0.92), '#2b2b33'),
    main: [pelvis('#2b2b33'), line('M90 116 C96 119 105 119 111 116', '#45454f', 1.6)],
  },
  // Tapered joggers with cuffs.
  b_joggers: {
    far: [...tube(farLegSegs(LIMB.thigh + 6, LIMB.calf + 5, 0.9), '#f5821f'), ...tube([[seg(lerp(P.farKnee, P.farAnkle, 0.74), lerp(P.farKnee, P.farAnkle, 0.86)), LIMB.calf + 3]], '#c9650f', false)],
    near: [
      ...tube(nearLegSegs(LIMB.thigh + 6, LIMB.calf + 5, 0.9), '#f5821f'),
      ...tube([[seg(lerp(P.nearKnee, P.nearAnkle, 0.74), lerp(P.nearKnee, P.nearAnkle, 0.86)), LIMB.calf + 3]], '#c9650f', false),
      line('M108 154 C111 160 112 166 112 172', '#c9650f', 1.1),
    ],
    main: [pelvis('#f5821f'), line('M90 116 C96 119 105 119 111 116', '#c9650f', 1.6)],
  },
  // Pleated skirt flaring back with the stride.
  b_skirt: {
    far: [], near: [],
    main: [
      path('M89 112 C96 115 105 115 111 112 L122 148 C106 155 86 154 70 145 Z', '#f07ab4'),
      line('M94 115 L80 148 M100 116 L93 151 M106 115 L106 152 M110 114 L117 150', '#c95c91', 1.1),
    ],
  },
});

// ---------------------------------------------------------------------------------------
// Shoes: low running shoes in profile (local foot frame)
// ---------------------------------------------------------------------------------------

function runners(color, sole, stripe) {
  const pair = (t) => [path(SHOE, color, t), line(SHOE_SOLE, sole, 3, t), line(SHOE_STRIPE, stripe, 1.4, t)];
  return { far: pair(FOOT_FAR_T), near: pair(FOOT_NEAR_T) };
}

export const SHOES = Object.freeze({
  s_none: { far: [], near: [] },
  s_runner: runners('#7ccc3a', '#ffffff', '#3f7d1a'),
  s_white: runners('#f4f4f4', '#b5b5b5', '#9aa3b0'),
  s_blue: runners('#2f80ed', '#ffffff', '#dfe8f5'),
  s_pink: runners('#f07ab4', '#ffffff', '#ffffff'),
});

// ---------------------------------------------------------------------------------------
// Accessories (one at a time)
// ---------------------------------------------------------------------------------------

function glasses(frame, lens, width) {
  return [
    line('M118 26.5 L104.5 27.5', frame, width, HEAD_T),
    path('M118 24.5 L127 24 C127.6 27.5 126.8 30.3 124.5 30.8 L119 30.4 C117.6 28.6 117.4 26.4 118 24.5 Z', lens, HEAD_T),
    ...(lens === 'none' ? [line('M118 24.5 L127 24 C127.6 27.5 126.8 30.3 124.5 30.8 L119 30.4 C117.6 28.6 117.4 26.4 118 24.5 Z', frame, width, HEAD_T)] : []),
  ];
}

export const ACCESSORIES = Object.freeze({
  a_none: {},
  // Cap with the brim pointing forward.
  a_cap: {
    head: [
      path('M101.8 28 C101 17 107 12 114 12 C121 12 126.5 17 126.5 24 L102 28.5 Z', '#2f80ed', HEAD_T),
      path('M122.5 22 C130 20 137 21 140.5 24.5 C134 26.5 127.5 26.5 122 26 Z', '#2568c2', HEAD_T),
      circle(114, 12.3, 1.6, '#2568c2', HEAD_T),
    ],
  },
  a_headband: { head: [path('M102.5 25 C110 19 120 18 126.3 21 L126.6 26.5 C120 23.5 110 24 103 30.5 Z', '#e0483a', HEAD_T)] },
  a_sunglasses: { head: glasses('#222222', '#1c1c22', 1.8) },
  a_glasses: { head: glasses('#15151b', 'none', 1.3) },
  // Band over the crown, cup on the side of the head.
  a_headphones: {
    head: [
      line('M109 31 C105 13 121 10 122.5 24', '#333333', 3.2, HEAD_T),
      shape('ellipse', { cx: 111.5, cy: 31, rx: 4.2, ry: 5.8, transform: HEAD_T }, '#e0483a'),
    ],
  },
  // Wrapped round the neck, tail flowing back.
  a_scarf: {
    main: [
      path('M101 52 C94 54 86 60 79 64 L83.5 69.5 C90 65 96 61 102.5 59 Z', '#e0483a'),
      path('M100 46 C103 52.5 110 53 114 47 L115 54.5 C111 60 103 60 98.5 54.5 Z', '#e0483a'),
      line('M81 64.5 L84.5 69', '#b8352a', 1.2),
    ],
  },
  // Medal on a ribbon, resting on the chest.
  a_medal: {
    main: [
      line('M104 52 L114.5 71 M111 51 L116.5 71', '#2f80ed', 2.4),
      circle(116, 75.5, 4.6, '#f6c445'),
      line('M116 73 V78', '#c4901a', 1.2),
    ],
  },
  // Sports watch on the near wrist.
  a_watch: { near: [shape('rect', { x: 79.6, y: 108.6, width: 10.5, height: 5.6, rx: 1.6, transform: 'rotate(8 84.85 111.4)' }, '#222222'), line('M83.1 110.6 H86.6', '#7ccc3a', 1.2, 'rotate(8 84.85 111.4)')] },
});

// ---------------------------------------------------------------------------------------
// Golden set: LOCKED previews only. These IDs are NOT part of the avatar whitelist,
// so a stored avatar can never contain them. They are unlocked by rewards in Phase 5.
// `layer` tells the editor which tab shows them (acc = head close-up).
// ---------------------------------------------------------------------------------------

const GOLD = '#f4c430';
const GOLD_DARK = '#c4901a';

export const GOLDEN_SET = Object.freeze({
  g_glasses: { layer: 'acc', head: glasses(GOLD_DARK, '#ffe066', 2) },
  // Quilted puffer vest over the top.
  g_vest: {
    layer: 'top',
    main: [
      path('M96 49 C88 54 84 63 84 76 C84 90 89 99 88 109 C86 117 85 125 86 134 C95 139 106 140 116 136 C117 126 117 116 115 106 C116 96 123 89 123 76 C123 64 119 56 114 49 C109 54 101 54 96 49 Z', GOLD),
      line('M85 72 C96 74 110 74 122.5 71 M86 90 C97 92 110 92 121 89 M88 108 C97 110 107 110 115 107 M86.5 124 C96 126 106 126 116.3 123', GOLD_DARK, 1.2),
      line('M119 60 C120 76 117.5 92 115.5 104 C115 116 116 126 115.6 135', GOLD_DARK, 1.2),
    ],
  },
  g_boots: {
    layer: 'shoes',
    far: [...tube([[seg(lerp(P.farKnee, P.farAnkle, 0.55), P.farAnkle), LIMB.calf + 4]], GOLD), path(SHOE, GOLD, FOOT_FAR_T), line(SHOE_SOLE, GOLD_DARK, 3, FOOT_FAR_T)],
    near: [...tube([[seg(lerp(P.nearKnee, P.nearAnkle, 0.55), P.nearAnkle), LIMB.calf + 4]], GOLD), path(SHOE, GOLD, FOOT_NEAR_T), line(SHOE_SOLE, GOLD_DARK, 3, FOOT_NEAR_T)],
  },
  g_crown: {
    layer: 'acc',
    head: [
      path('M104 17 L102.5 3.5 L109 9 L114 0 L119 9 L125.5 3.5 L124 17 C118 15 110 15 104 17 Z', GOLD, HEAD_T),
      circle(114, 11, 1.9, '#e0483a', HEAD_T),
    ],
  },
  g_color: { layer: 'skin', skin: '#e6b422' },
});
