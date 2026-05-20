# NEONPOKER — Design Specification

## 1. Target platform

- **Desktop only.** No responsive / mobile / tablet behavior in v1.
- **Reference resolution: 1920 × 1080** (16:9).
- **Rendering model:** fixed 1920 × 1080 "stage" letterboxed into the viewport via a single `transform: scale(s)` where `s = min(vw / 1920, vh / 1080)`. All coordinates inside the stage are absolute pixels. See `app.jsx::useStageScale` and `styles.css` (`.stage-wrap`, `.stage-scaler`, `.stage`).
- **Game:** No-Limit Texas Hold'em, single table, 2 / 4 / 6 / 9 seats.

## 2. Visual language

- **Theme:** dark neon cyberpunk.
- **Surfaces:** translucent glass panels (`rgba(10,6,26,0.72)` + `backdrop-filter: blur(14px)`) over a fixed background image (`assets/bg.png`).
- **Neon palette** (from `styles.css :root`):
  - `--neon-cyan: #22d3ff` — primary, active turn, call
  - `--neon-blue: #2a6fff`
  - `--neon-violet: #8b5cff` — borders, hairlines
  - `--neon-magenta: #ff3df0` — raise, all-in
  - `--neon-pink: #ff4d8a` — fold, danger
  - `--neon-green: #2bff9b` — check, ok
  - `--neon-amber: #ffb43d` — winner
- **Text:**
  - `--text-hi: #f3eaff` primary
  - `--text-md: #c6b9e3` secondary
  - `--text-lo: #7a6fa3` labels
  - `--text-mute: #4a4566` disabled
- **Typography:**
  - Display: `Orbitron` (logo, headings, status pills, button labels)
  - UI: `Rajdhani` (body)
  - Numbers: `JetBrains Mono` (stacks, pot, amounts)
- **Radii:** 4 / 6 / 10 / 14 / 20 px + `999px` pill.
- **Spacing scale:** 4 px grid (4 / 8 / 12 / 16 / 20 / 24 / 32 / 40).
- **Glows:** every neon color has a paired `--glow-*` token (inner + outer drop-shadow). Used on active seat, badges, buttons, hero hole-cards.
- **Background:** `assets/bg.png` covered, with a radial darkening vignette over the bottom 65%.

## 3. Production UI vs design helpers

| File | Role | Ship in app? |
|---|---|---|
| `data.jsx` | Mock player / hand-history / chat data + layout math | **Production** (data shape is canonical; mock content gets replaced with real data) |
| `components.jsx` | `Avatar`, `CardFace`, `CardBack`, `OppHoles`, `SeatBadge`, `BetChip`, `PlayerSeat`, `HeroSeat`, `Pot`, `BoardCards`, `HoleCards` | **Production** |
| `panels.jsx` | `HandHistoryPanel`, `ChatPanel`, `GameInfoPanel`, `RightSidebar`, `ActionBar` | **Production** |
| `app.jsx` | Main composition + stage scaling | **Production** (composition only — the `TweaksPanel` block + `TWEAK_DEFAULTS` editmode markers must be stripped) |
| `styles.css` | All production styling | **Production** |
| `tweaks-panel.jsx` | Live design knob panel | **DO NOT SHIP.** Design helper only. |
| `kit.jsx` / `kit.css` / `NEONPOKER UI Kit.html` | Component catalog page | Design helper only. |
| `states-seats.jsx` / `states-board.jsx` / `states.css` / `NEONPOKER Player Seat States.html` / `NEONPOKER Board Card States.html` | State showcase pages | Design helper only. |
| `assets/` | Image assets | **Production** |
| `exports/`, `screenshots/`, `uploads/` | Reference imagery | Not bundled. |

**Critical rule:** the production React app must never import `tweaks-panel.jsx`, `kit.jsx`, `states-*.jsx`, `kit.css`, or `states.css`. The `EDITMODE-BEGIN` / `EDITMODE-END` block and `urlOverrides()` in `app.jsx` are design-iteration scaffolding and are removed in production.

## 4. Data flow (production)

All visible text and numbers come from data, never baked into images:

- **Player record:** `{ id, name, stack, ring, init, avatar }`
- **Player state:** `{ status, bet, amount }` where `status ∈ {turn, fold, check, call, raise, allin, winner, sitout, idle}`
- **Board:** `cards[5]` of `{ r, s }` + `reveal ∈ {0, 3, 4, 5}`
- **Hero hole cards:** `cards[2]` of `{ r, s }`
- **Pot:** numeric amount
- **Hand history:** ordered streets, each with rows of `{ name, cls, act }`
- **Chat:** ordered list of `{ who, cls, msg }`
- **Game info:** game type, stakes, buy-in, player count, next break

## 5. Image vs component split

| Image asset (PNG, never re-drawn) | React/CSS component (no image) |
|---|---|
| `bg.png` — page background | Stage, layout containers, vignette overlay |
| `table.png` — felt oval | Pot label & amount, `felt-mark` watermark text |
| `backcard.png` — card back artwork | Card frame, glow, layout (`.card-back`, `.opp-holes .mini-back`) |
| `blue-chip.png`, `green-chip.png`, `purple-chip.png`, `pink-chip.png`, `bw-chip.png` — chip face textures | Chip stack layout, bet-chip pill text, pot chip row |
| `avatar-1/2/3.png` — sample portraits | Avatar ring, glow, initial fallback (`.avatar .placeholder`) |
| `player-border.png` — unused decorative | — (currently unused; leave out of build) |

**Hard rules:**
- The UI is **never** a single composite screenshot.
- All text (names, stacks, status, pot, chat, hand-history, action-bar amounts, badges, game-info values) is rendered as DOM and bound to data.
- Player cards (both hero face-up and opponent face-down) **stack visually above** the seat container — `z-index` and `bottom: 100%` positioning, never under it.
- Opponent cards are always rendered with `backcard.png` (rubashkoy vverkh). Their ranks/suits never appear, even if known.
- Hero cards are rendered as `CardFace` (rank + suit on white face).
- Card backs and chip PNGs are tiled/positioned via CSS — no per-card rasters.

## 6. Source-of-truth tokens

When porting to a build pipeline (Vite/Next/etc.), copy the CSS custom-property block from `styles.css :root` verbatim as the design-token layer. Component CSS should reference variables only — no hard-coded hex.
