# runsesh design spec (v2, "night stompers" direction)

Reference: the four screenshots in `inspo/` (local only, not part of the app). We borrow the
*language* (night scenery, sticker typography, faceless round-headed figures, dark sheets),
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
- **Characters:** faceless, round head, flat fill, thin dark outline, mid-stomp pose.

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

## 7. Avatar ("stomper") concept

Studied from the references: the character is always seen **from behind, three-quarter**, so the
face never shows: the head is a plain disc. Our figure is drawn from scratch to the same brief:

| Trait | Spec |
|---|---|
| Head | Small circle (≈ half the sweater width), sits straight on the collar, no neck |
| Torso | Boxy, oversized top with drop shoulders; ribbed hem and cuffs on knitwear |
| Pose | High-knee stomp: front thigh almost horizontal, shin straight down; standing leg straight. Back arm swings out left with the elbow bent down, front arm out right with the forearm hanging |
| Legs | Long and baggy; trousers taper into long socks |
| Feet | Long socks with a coloured band + chunky slides (or sneakers) |
| Line | Flat fills, thin dark edge (1.8 units), one soft shadow under the standing foot |
| Profile picture | Close-up crop: head fills the upper circle, shoulders/collar show at the bottom |

Wardrobe redesign (same IDs, new drawings): knit sweater with diamond band (default), oversized tee,
tank, hoodie with bunched hood and pocket, button shirt with rolled sleeves (`t_jacket`),
race singlet with back bib, track jacket. Baggy joggers (default), baggy shorts, running shorts,
leggings, pleated skirt. Slides with long socks (default), sneakers. Hair is drawn from behind
(covering the top and back of the head): mop, buzz, spikes, long, bob, ponytail with tie, bun,
curl cloud, mohawk. Glasses show as an arm plus the lens edge at the side of the head.

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
