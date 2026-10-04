# runsesh design spec (v2, "night stompers" direction)

Reference: the four screenshots in `inspo/` (local only, not part of the app). We borrow the
*language* (night scenery, sticker typography, faceless figures, dark sheets),
never the other app's artwork, name or branding. All art in `img/` is drawn for runsesh.

---

## 1. Analysis of the references

| Reference | What it shows | Key traits |
|---|---|---|
| **runners slider** | Home screen. A side-view night world where one runner stands large on a path with a white step bubble ("2,839") plus a rank sticker above the head and a name tag under the feet. Huge outlined step number over the sky. At the bottom, a condensed pill-shaped bar with a dashed line, round avatars placed by progress, an orange ring on the focused runner, and distance markers ("6k", "12k"). | Full-bleed scene behind the UI; layered parallax depth (stars → hills → trees → path); white "sticker" labels with dark outline; one hero number; condensed overview below the detailed view. |
| **daily ranking** | "Rankings" list on near-black. Round avatar (head + shoulders crop) with a starburst "1st / 2nd / 3rd" sticker overlapping its top-left; bold name; muted second line; right-aligned bold grey "7436 steps". | No card chrome, no bars: hierarchy comes from size and weight only. Generous row spacing (~24px). |
| **profile edition menu** | Night banner with the figure on the path, large round avatar overlapping the banner edge, big name, muted subtitle, pill "Edit profile" + round hanger button, teal call-out card (icon circle, bold title, teal subtitle, chevron, teal bottom glow), bottom sheet with stacked rows and a separate "Cancel" sheet. | Rows on a raised grey-blue sheet (#2f2f3a), 24px radii, big tap targets (~64px), centered identity block. |
| **avatar customization menu** | Back arrow over a full-width night scene with the figure in the middle; a raised panel with text tabs (active = filled pill); 3-column grid of dark rounded tiles; selected tile = orange border + orange check badge; a floating orange gradient "Save" pill with dark outline. | Preview and controls split ~45/55; the primary action floats; tiles are square and roomy. |

### Shared visual language
- **Color:** near-black blue-grey base, deep-blue night sky with a brighter band on the horizon, a single
  hot accent (orange) for primary actions and focus, yellow for promotional CTAs, teal for informational call-outs, white stickers.
- **Type:** a rounded geometric sans. Display text (numbers, logo, primary buttons) is heavy and white
  with a dark outline, like a sticker. Body text is medium weight, and secondary text is grey, never thin.
- **Shape:** everything is rounded. Pills for buttons and tabs, 20–24px radii for tiles and sheets, circles for avatars.
- **Depth:** created by the scenery and by stacking (sticker over avatar, avatar over banner), not by drop shadows.
- **Characters:** faceless matte mannequins in side profile, mid-run, softly lit (see section 7).

---

## 2. Mapping references to runsesh

| runsesh element (spec) | Reference it maps to |
|---|---|
| Race → member-position slider | runners slider: side-view world + condensed bar |
| Race → "your steps" emphasis | runners slider: hero number over the sky |
| Race → daily ranking | daily ranking |
| Race → competition (circus) | (no reference) keep circus art, restyle as dark card |
| Race → "Create a party" + member icons | runners slider: top controls (round button, compact) |
| Profile → avatar depiction + open editor | profile edition menu: banner + overlapping avatar + pill |
| Profile → PARTY / SETTINGS lists | profile edition menu: bottom-sheet rows |
| "Not connected yet" notices | profile edition menu: teal call-out card |
| Avatar editor | avatar customization menu |
| Bottom navigation | runners slider: tab bar with active pill + label |

---

## 3. Design system

### Color tokens (dark = default)
| Token | Dark | Light (warm, original) | Use |
|---|---|---|---|
| `--bg` | `#16161b` | `#fff7ef` | page |
| `--surface` | `#202027` | `#ffffff` | cards, panels |
| `--surface-2` | `#2c2c36` | `#f4efe9` | sheet rows, active tab, pills |
| `--line` | `#30303b` | `#eadfd3` | hairlines |
| `--ink` | `#f5f5f7` | `#3a2a20` | primary text |
| `--ink-soft` | `#a3a3ae` | `#6f5f55` | secondary text, step counts |
| `--orange` | `#ff8a1f` (gradient `#ffab45 → #f07400`) | same | primary action, focus ring, "me" |
| `--yellow` | `#ffc928` | same | promo CTA (Create a party) |
| `--teal` | `#22c3b3` | `#0f9e90` | call-outs / info |
| `--outline` | `#0c0c10` | `#3a2a20` | sticker outlines, button borders |
| Sky | `#0b1626 → #143657 → #2457a5` | `#bfe3ff → #e9f6ff` | scenes |

### Typography (Fredoka, OFL, self-hosted)
| Role | Size (phone → desktop) | Weight | Notes |
|---|---|---|---|
| Display (hero steps) | `clamp(3.25rem, 13vw, 5rem)` | 700 | white + 3px dark outline, tabular numbers |
| Title (screen, name) | 1.6rem | 700 | |
| Section ("Rankings") | 1.45rem | 700 | |
| Body / row label | 1.06rem | 500–600 | |
| Secondary | 0.92rem | 500 | `--ink-soft` |
| Micro (ticks, tags) | 0.75rem | 600 | |
Primary buttons use 1.1–1.3rem, weight 700, white with dark outline.

### Spacing, radius, size
- 4-pt grid: 4, 8, 12, 16, 20, 24, 32, 48. Screen gutter: 16 (phone), 24 (tablet), 32 (desktop).
- Section gap 28; row gap 20; tile gap 10–12.
- Radius: pill 999, sheet/panel 24, tile 20, chip 14.
- Tap targets ≥ 48px; list rows 60px; nav items 56px.
- Avatars: 36 (minimap), 44 (party row), 58 (ranking), 112 (profile).

### Components
- **Button / primary:** orange gradient pill, 3px dark outline, inner top highlight, outlined white label.
- **Button / promo:** yellow gradient variant (Create a party).
- **Button / pill secondary:** `--surface-2`, 2px hairline border. **Icon button:** 48px circle.
- **Sticker label:** white rounded rectangle, 2px dark outline, tail (step bubble, name tag).
- **Rank sticker:** 28-point starburst, gold/silver/copper gradient, "1st/2nd/3rd" in outlined white; overlaps the avatar's top-left corner, rotated −12°. Rank 4+ gets a small grey number chip.
- **Sheet list:** grouped rows on `--surface-2`, 24px radius, hairline separators, chevrons.
- **Call-out:** teal icon circle + bold title + teal subtitle, teal bottom edge.
- **Tabs (editor):** text tabs; active = filled `--surface-2` pill.
- **Tile:** square, `--tile` background, 20px radius; selected = 3px orange border + orange check badge.
- **Nav bar:** active item = orange-tinted pill + label; inactive = grey line icon only.

### Motion (all disabled under `prefers-reduced-motion`)
| Where | Animation | Timing |
|---|---|---|
| Screen change | fade + 8px rise | 220ms ease-out |
| Hero number | count up from 0 | 700ms ease-out |
| Runners | idle "stomp" bob, staggered | 1.1s loop, 2–3px |
| Step bubbles | pop in | 260ms, slight overshoot |
| Scenery | parallax while scrolling (stars 5%, hills 15%, trees 40%, ground 100%) | scroll-linked |
| Minimap | focus ring and viewport window glide | 200ms |
| Buttons/tiles | press scale 0.96 | 120ms |
| Rank stickers | wobble on hover (pointer devices) | 400ms |

### Visual hierarchy (Race, top to bottom)
1. **Your steps** (display number): the one thing to read at a glance.
2. **The world**: where everybody is, emotional and playful.
3. **Minimap**: where everybody is, precise and compact.
4. **Rankings**: exact numbers.
5. **Competition**: longer-term context.
6. Party controls are compact utilities at the top, not the hero.

---

## 4. Sketches and section structures

### Race
```
┌──────────────────────────────┐
│ [+ Create a party] (o)(o)(o)…│  compact row, scrolls sideways
├──────────────────────────────┤
│ ☾  ·    ·     ·   ·    ·     │  night sky (stars, parallax)
│          11,881              │  hero number (outlined white)
│      Your steps today        │
│         ~~~~~~~~~            │
│   /\/\    /\/\/\    /\  ⛰    │  hills (parallax)
│ 🌲  ┌2,839┐★    ┌You 11,881┐ │  sticker bubbles + rank stickers
│ 🌳   (o)          (o)    🌳  │  full-body runners, 3 depth lanes
│      /|\          /|\        │
│ ═════[Bea]═══1k═══[You]════  │  continuous path: dirt → grass, rocks, flowers
├──────────────────────────────┤
│ (- -(o)- - -(O)- -(o)(o)- -) │  minimap pill: avatars by steps,
│      5k        10k     15k   │  orange ring = focused runner, window = visible part
├──────────────────────────────┤
│ Rankings                     │
│ ★(o) Alex          12,810 st │  sticker over avatar, no bars
│      Leader                  │
│ ★(o) You            8,867 st │
│      3,943 behind Alex       │
├──────────────────────────────┤
│ [ circus art / COMPETITION ] │
│ Autumn Sprint · tags         │
│ standings (same row design)  │
└──────────────────────────────┘
```
**Slider behavior:** the world is one continuous path (2,400 units wide). A runner's x position comes only
from their step count (`x = pad + steps / scaleMax × usable width`); there is no daily goal.
Drag or swipe left/right to travel along it. Tapping a runner or a minimap avatar glides the world to center
that runner and marks it with the orange ring. The minimap shows the visible window and can be dragged.

### Profile
```
┌──────────────────────────────┐
│  ☾   night banner   ·   ·    │
│        (figure)              │  tap = customize
│ ═══════════(O)═══════════    │  big avatar overlaps banner edge
│        Sam Runner            │
│    Lunch Break Runners       │  muted subtitle
│   [⌂ Customize avatar]       │
├──────────────────────────────┤
│ PARTY                        │  sheet group
│  Party settings          +   │
│  Competition             ›   │
│ SETTINGS                     │
│  Dark theme             [●]  │
│  Login / Log out         ›   │ …
└──────────────────────────────┘
```

### Avatar editor
```
┌──────────────────────────────┐
│ ‹                            │  back button over the scene
│        night scene           │
│          (figure)            │
├──────────────────────────────┤
│ [Body color] Hair  Hair color│  text tabs, active pill
│ ┌───┐ ┌───┐ ┌───┐            │
│ │ ✓ │ │   │ │   │            │  3-col tiles
│ └───┘ └───┘ └───┘            │
│      ( Save avatar )         │  floating orange pill
└──────────────────────────────┘
```
"Body color" is the first tab: the native RGB picker plus quick swatches (all values validated as #RRGGBB).

### Sub-screens (placeholders)
Header with round back button + title, teal "Not connected yet" call-out, then content cards.

---

## 5. Responsive review

| | Phone (< 600px) | Tablet (600–1023px) | Desktop (≥ 1024px) |
|---|---|---|---|
| Navigation | bottom bar, labels on active | bottom bar | left side rail (96px), labels under icons |
| Gutter / max width | 16px / 100% | 24px / 760px | 32px / 1120px |
| Race stage | full-bleed, 400px tall | rounded, 440px | rounded, 480px, full content width |
| Rankings + competition | stacked | stacked | two columns |
| Profile | stacked | stacked, centered 640 | two columns: identity (sticky) · lists |
| Editor | scene on top, panel below, grid 3 col | grid 4 col | two columns: scene (sticky) · panel, grid 4 col |
| Hero number | 13vw clamp | up to 4.5rem | 5rem |
Touch targets stay ≥ 48px everywhere; hover effects only for `(hover: hover)` devices.
Safe-area insets are respected by the top bar, the bottom bar and the side rail.

## 6. Accessibility
- Contrast: body text ≥ 4.5:1 on its background in both themes; stickers use dark text on white.
- The world is a focusable scroll region with an aria-label; the minimap avatars are buttons with names and steps.
- Animations respect `prefers-reduced-motion`.

---

## 7. Avatar ("mannequin runner") concept, v3

Reference: `inspo/dummy concept image.jpg`, a matte charcoal running mannequin in a studio. We
take its **form language** (realistic athletic proportions, a smooth faceless egg head, one matte
material, soft studio light, a mid-stride running pose) and redraw it from scratch as layered SVG.
It replaces the v2 "stomper" (cartoon, seen from behind). The stored avatar format does **not**
change: same 8 fields, same part IDs (`docs/avatar-schema.md`), so no database change.

### Character brief (read as a 3D artist would brief a model)
| Trait | Spec |
|---|---|
| Read | A posable studio mannequin caught mid-run. Clean, premium, sporty; never cute or cartoon. |
| View | **Side profile, facing right** (the direction of travel on the race track), slight forward lean (~8°). |
| Proportions | Athletic adult, about **7.5 heads** tall. Long neck, narrow waist, long legs. Head ≈ 23 × 29 units in a 250-unit-tall frame. |
| Head | Smooth **egg (ovoid)**, tilted forward with the lean. Fuller at the back of the skull, narrowing to a soft chin. **No face, no ears, no features.** |
| Pose | Running contact phase, as in the reference, mirrored: **near leg** planted under the body with a soft knee, foot flat; **far leg** trailing behind in toe-off, knee bent, heel raised and toes on the ground. Arms opposite to the legs: **far arm** forward with the elbow at ~90° and the fist at chest height; **near arm** swung back, elbow behind the body, forearm hanging, hand at hip height. |
| Limbs | Tapered "tubes": thigh 19 → calf 13, upper arm 11 → forearm 9, neck 10 units (about the head width at the thigh, as in the reference). Rounded joints, closed fists. |
| Material | One matte colour for the whole body: the user's **body colour** (`skin`). Default **graphite `#5b5e69`** (the reference's charcoal, lifted a little so it reads on the night scenes). |
| Seams | Mannequin joint seams as thin darker lines: neck base, waist, wrists. |
| Lighting | One soft **key light from the upper left/back**: lighter on top and back, darker towards the front and feet. Each limb gets a narrow soft **highlight** along its upper edge so it reads as a cylinder. |
| Depth | **Far-side** arm and leg are drawn in a darker value (as if in the body's shadow). This is the main cue that sells 3D on a flat figure. |
| Edge | No cartoon outline. A thin, half-transparent dark edge (1.2 units) keeps the figure readable on dark and light backgrounds and at 36 px. |
| Ground | A soft contact shadow under the planted foot and a smaller one under the trailing toes. No stand or base plate. |
| Hems | Shorts and short sleeves end in straight cuts (butt caps), never round bulbs. |
| Profile picture | Close-up of the head and neck in profile, shoulder line at the bottom of the circle. |

### Wardrobe (same IDs, redrawn for the side view)
Clothes are athletic and fitted (a mannequin "wears" them): each garment follows the limb tubes a
little wider, gets the same lighting, and has one or two construction details, nothing more.

- **Tops:** fitted tee with crew neck (`t_tee`), racer tank (`t_tank`), knit sweater with ribbed
  hem, cuffs and a zigzag band (`t_jersey`), hoodie with the hood resting on the back and a
  front pouch pocket (`t_hoodie`), shirt-jacket with collar, front placket and rolled sleeves
  (`t_jacket`), race singlet with a number bib on the side (`t_singlet`), track jacket with
  white stripes along the arms and side seam and a front zip (`t_tracksuit`).
- **Bottoms:** loose shorts to the knee (`b_shorts`), split running shorts (`b_runshorts`),
  leggings (`b_leggings`), tapered joggers with cuffs (`b_joggers`), pleated skirt (`b_skirt`).
- **Shoes:** low-profile running shoes in side view with a contrast sole and a swoosh-free stripe
  (green, white, blue, pink); barefoot shows the mannequin foot (`s_none`).
- **Hair** (drawn on the egg head in profile): buzz shadow, short crop, spikes, long hair falling
  down the back, bob, ponytail swinging back, bun at the back of the crown, curl cloud, mohawk
  crest. Bald is the pure mannequin head (`h_none`, default).
- **Accessories:** cap with the brim forward, headband, wrap sunglasses and thin glasses on the
  front of the head, headphones (band over the crown, cup on the side), scarf with a tail
  flowing back, medal on a ribbon at the chest, sports watch on the near wrist.
- **Golden set** (locked previews, unchanged rules): gold glasses, gold vest, gold boots, crown,
  gold body.

### Palette and values
| Role | Value |
|---|---|
| Default body | `#5b5e69` graphite |
| Edge | `#15151b` at 55 % opacity |
| Key light overlay | white 22 % (top/back) → clear |
| Shade overlay | clear → black 30 % (front/feet) |
| Far side | extra black ~22 % |
| Limb highlight | white 14 %, a third of the limb width, offset up-left |

### Technical notes
- Pure SVG built with `createElementNS`/`setAttribute`, no `innerHTML`. The only avatar values
  that reach attributes are still the validated `skin` hex and whitelisted colours.
- Lighting is one `linearGradient` per drawing (unique `id` per SVG, `userSpaceOnUse`), laid over
  every surface as a second copy of that surface. Gradients use no user data.
- The frame (`viewBox 26 4 158 250`) and the head crop keep their sizes, so the race track,
  profile, rankings and editor layouts do not move.

## 8. Slider overlay (v2.1)

The minimap is a slim (34px) translucent bar laid over the bottom of the world. The ground path is
drawn taller so it continues underneath the bar and shows through it. Avatars stay 36px and
overhang the bar. Step markers are teal notches with small labels above the bar.

## 9. Custom profile photo (placeholder)

An orange camera badge sits on the profile picture. In Phase 1 it only explains that photos are
coming later; there is no file input and no file is read. Upload, validation and storage arrive in Phase 3.

## 10. Competition tab and themes (v2.2)

Navigation is now Race · **Competition** · Profile (trophy icon in the middle). The Competition tab holds
everything that used to sit under the Race rankings: themed header with the red COMPETITION label,
name, dates, tags, standings and the mock-rules note, plus a "Competition settings" button.

Competition settings (Profile → Competition) has a **theme picker**. Themes are stored per competition,
validated against a fixed list (`COMPETITION_THEMES` in `js/state/competition.js`):

| Theme | Art | Label colour |
|---|---|---|
| Classic circus (default) | `img/circus.svg`: striped big top, bunting, stars | red |
| Spring | `img/comp-spring.svg`: blossom tree, petals, tulips, butterflies, pastel bunting | pink |
| Summer | `img/comp-summer.svg`: sun, sea, beach, palm tree, umbrella, ball, gulls | turquoise |
| Fall (spooky) | `img/comp-fall.svg`: purple night, big moon, bats, haunted tree, ghost, gravestones, jack-o'-lanterns, spider | orange |
| Winter | `img/comp-winter.svg`: icicles, snowflakes, snowy pines, snowman, sled tracks | icy blue |
