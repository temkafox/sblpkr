# NEONPOKER — States Map

## 1. Seat status tokens

Single enum, used for both opponent seats and hero. See `states-seats.jsx` for the design catalog and `components.jsx` for the implementation.

| `status` | Status text shown | Status text color | Body border / glow | Avatar effect | Notes |
|---|---|---|---|---|---|
| `idle` | (empty) | `--text-lo` | default violet hairline | — | Default state. No status pill rendered. |
| `turn` | `YOUR TURN` | `--neon-cyan` | cyan border + animated pulse (`pulse-active-body` 1.6 s) | — | Timer bar visible and animating (15 s deplete). Hero variant uses `pulse-hero-body` 1.8 s. |
| `check` | `CHECK` | `--neon-green` | default | — | |
| `call` | `CALL $<bet>` (omits amount if `bet === 0`) | `--neon-cyan` | default | — | `bet` chip rendered toward felt if `bet > 0`. |
| `raise` | `RAISE TO $<bet>` | `--neon-magenta` | default | — | Chip rendered. |
| `fold` | `FOLD` | `--neon-pink` | pink-tinted faded border (`rgba(255,46,107,.38)`) | grayscale 0.65, brightness 0.78 | Opacity 0.88. Opponent hole-cards (if shown) are muted (opacity 0.35, grayscale). Card display is the design's choice — fold doesn't auto-hide opp holes; they fade. |
| `allin` | `ALL-IN` | `--neon-amber` (text), magenta body | magenta border + heavy magenta glow | magenta ring | Chip pill shown for full stack. |
| `winner` | `WINNER` | `--neon-amber` | amber border + heavy amber glow | amber ring | A separate `winner-tag` chip ("WINNER" / "HAND WINNER" for hero) floats above the seat. |
| `sitout` | `SITTING OUT` | `--text-lo` | default, faded | — | Opacity 0.55, saturate 0.45. `OppHoles` not rendered. |

The status pill is rendered as a tiny uppercase Orbitron label inside the seat body (`.status`, 11 px, letter-spacing 0.22em). Hero uses 13 px / 0.26em.

## 2. Hero vs opponent visual differences

| Aspect | Opponent (`PlayerSeat`) | Hero (`HeroSeat`) |
|---|---|---|
| Box | 244 × 84 | 320 × 110 |
| Body radius | 22 px | 28 px |
| Avatar | 78 × 78, 2 px border | 102 × 102, 2.5 px border, cyan ring locked |
| Name size | 14 px | 18 px |
| Stack size | 17 px | 22 px |
| Status pill | 11 px / 0.22em | 13 px / 0.26em |
| Active pulse | `pulse-active-body` 1.6 s | `pulse-hero-body` 1.8 s |
| Hole cards | `OppHoles` (two face-down `mini-back`, anchored above seat) | `HeroHoleCards` (two face-up `CardFace`, anchored above seat) |
| `sitout` allowed? | yes | no (hero never sits out in this UI) |

## 3. Board card states

5 fixed slots, always present in DOM. Slots are filled from `cards[0..4]`. `reveal` is the count of revealed cards.

| Street | `reveal` | Slot 0 | Slot 1 | Slot 2 | Slot 3 | Slot 4 |
|---|---:|---|---|---|---|---|
| **Pre-flop** | `0` | back | back | back | back | back |
| **Flop** | `3` | face | face | face | back | back |
| **Turn** | `4` | face | face | face | face | back |
| **River** | `5` | face | face | face | face | face |

Rules:

- Backs use `backcard.png` (`.card-back.board-back`, 88 × 124).
- Faces use `CardFace` (rank + suit char, red for ♥/♦, large background suit bottom-right).
- Both have a violet outline + glow + drop shadow.
- Deal animation: `card-deal` 0.35 s ease-out (Y translate + fade) applied to backs.
- Reveal animation: `flip-in` 0.35 s ease-out (`rotateY 90→0`) applied to faces (class `.card-face.flipped`).
- The number of slots is constant; only the back→face transition advances. **A card never disappears.**

The `Pot` chip stack is also street-gated: it is shown only when `reveal >= 3` (i.e., from the flop onward).

## 4. Hole-card placement rules

**Hard rule:** hole cards always stack visually **above** the player container, on top of all status indicators. Never under, never inside, never overlapping the badge or bet chip.

### Opponent (`OppHoles`)

- Two `.mini-back` rectangles (50 × 70), fanned: first card rotated `-9°`, second rotated `+9°` with `margin-left: -22px` (creating a small overlap).
- Anchored via `position: absolute; left: 50%; bottom: 100%; transform: translateX(-50%); margin-bottom: -28px;` — centered on seat width, sticking out the **top** of the seat, with 28 px overlapping the seat body so they read as "held" cards.
- `z-index: 1` inside seat (under the body `z-index: 2`) so the body's top edge cuts across them slightly. Good.
- Always face-down. Even at showdown, **opponent cards are never replaced by `CardFace`** in this UI version — showdown reveal handling is out of scope for v1.
- When `state.status === 'fold'`, the cards stay rendered but fade (opacity 0.35, grayscale).
- Hidden entirely when `state.status === 'sitout'` (the design helper does this by passing `holes={false}`; in production, `SeatLayer` enforces it).

**Side selection.** In the source data each non-hero seat has a `dir` token derived from its angle. The `holesSide` helper currently returns `'top'` unconditionally. **Production: ignore `dir` for hole-card placement.** Cards always sit above the seat, regardless of which side of the table the seat is on. This is the explicit design rule.

### Hero (`HeroHoleCards`)

- Two `CardFace` elements rendered face-up.
- Placed by absolute coordinates at the global scope (not a child of the hero seat): `left: 760, top: 568, width: 200, height: 130`.
- The two cards are tilted: first `-6°`, second `+6°`, both translated `+2px` Y.
- Cyan glow + heavy drop shadow.
- `z-index: 12`, sitting above the hero seat (`z-index: 18` for the seat body, but the `.hero-holes` element is positioned to overlap its top edge cleanly).
- `pointer-events: none` — purely decorative; clicks pass through.

## 5. Overlay rules

Three overlays can be attached to a seat. They are positioned relative to the seat by absolute pixel offsets computed at render time:

| Overlay | Render condition | Offset helper | Notes |
|---|---|---|---|
| Hole cards (opponent) | `!hero && state.status !== 'sitout' && showOppHoles` | `holesSide()` → always `'top'` | Always above seat. |
| `BetChip` | `state.bet > 0 && showBets` | `betOffset(dir, w, h)` | Pushed **toward** the felt center. |
| `SeatBadge` | seat is `D`, `SB`, or `BB` && `showBadges` | `badgeOffset(dir, w, h)` | Pushed to the seat edge opposite the avatar so it doesn't cover the portrait. |
| `winner-tag` | `state.status === 'winner'` | (CSS) `top: -10px; left: 50%; translateX(-50%)` | Amber medal pill above the seat. |

In production both `showBets` and `showBadges` are always true; the toggles are debug only.

**Important — D / SB / BB / active are driven by GameState, not by layout index.** The badges and the `turn`-state pulse must read `gameState.dealerSeatIndex`, `smallBlindSeatIndex`, `bigBlindSeatIndex`, and `activeSeatIndex`. These rotate after each hand on the server. The "D=0, SB=1, BB=2 (or D=SB=0, BB=1 in heads-up)" arrangement seen in `app.jsx` is mock-only — acceptable for `/design/exports/*.png` parity and Storybook fixtures, not for real play.

## 6. Animation inventory

| Animation | Trigger | Duration | Easing |
|---|---|---:|---|
| `card-deal` | Board back appears | 0.35 s | ease-out |
| `flip-in` | Board face revealed (class `.flipped`) | 0.35 s | ease-out |
| `pulse-active-body` | Opponent seat `status === 'turn'` | 1.6 s | ease-in-out, infinite |
| `pulse-hero-body` | Hero seat `status === 'turn'` | 1.8 s | ease-in-out, infinite |
| `timer-deplete` | Active seat's timer bar | 15 s | linear, forwards |

All animations are CSS keyframes — no JS animation libraries required.

## 7. Streets used by hand history

The hand-history panel groups rows by street. Same enum as board state:

`PRE-FLOP` → `FLOP` → `TURN` → `RIVER` → (optionally `SHOWDOWN`, not yet styled).

Player-name colors in the panel use semantic classes: `n-c` (cyan), `n-m` (magenta), `n-p` (pink), `n-v` (violet), `n-g` (green), `n-a` (amber), `n-h` (white). The mapping from `player → class` should be derived from the player's `ring` color so the panel matches their seat.
