# NEONPOKER — Asset Map

All shipped raster assets live under `/design/assets/` and must be copied to the production app under `public/assets/` (or equivalent) preserving filenames. Paths in CSS/JSX are `assets/<file>.png` (relative).

## 1. Inventory

| File | Purpose | Used by | Type |
|---|---|---|---|
| `bg.png` | Full-screen background plate (cyberpunk room/cityscape under the table) | `.app-bg` in `styles.css` | Production |
| `table.png` | Felt + rail of the poker table (no text on it) | `.table-img` in `styles.css` | Production |
| `backcard.png` | Card-back artwork (deck pattern) | `.card-back`, `.opp-holes .mini-back` | Production |
| `blue-chip.png` | $5 chip face | `BetChip`, `Pot` chip row | Production |
| `green-chip.png` | $10–$24 chip face | `BetChip`, `Pot` chip row | Production |
| `purple-chip.png` | $25–$99 chip face | `BetChip`, `Pot` chip row | Production |
| `pink-chip.png` | $100+ chip face | `BetChip` | Production |
| `bw-chip.png` | $1–$4 small chip face | `BetChip` | Production |
| `avatar-1.png` | Sample player portrait | Mock `PLAYERS` data | Production (replaceable per real user) |
| `avatar-2.png` | Sample player portrait | Mock `PLAYERS` data | Production (replaceable) |
| `avatar-3.png` | Sample player portrait | Mock `PLAYERS` data | Production (replaceable) |
| `player-border.png` | Decorative seat frame | **Not referenced** by any production CSS/JSX | Drop from build |

`/design/uploads/` contains the same set plus `chips.png` and `reference.png` (raw inputs). `/design/exports/` and `/design/screenshots/` are reference snapshots — not shipped.

## 2. Asset usage rules

### bg.png
- Rendered via `background-image` on `.app-bg`, `cover`, centered.
- Vignette darkening overlay is added via `.app-bg::after` (radial gradient) — **not** baked into the PNG.
- Never use for anything other than the page backdrop.

### table.png
- Rendered via `background-image` on `.table-img`, sized to its container (1380 × 690), `no-repeat`.
- The felt watermark "NEONPOKER" is rendered as DOM text (`.felt-mark`) — **not** baked into the PNG.
- Drop-shadow is applied via CSS `filter`, not baked in.

### backcard.png
- Used in two places, both via `background-image`:
  - `.card-back.board-back` — 88 × 124 (board)
  - `.opp-holes .mini-back` — 50 × 70 (opponent hole-cards above seats)
- All glow / border are CSS box-shadows.
- **This is the only sprite for any face-down card. Every face-down card on the table uses it.**

### Chip PNGs (`*-chip.png`)
- Rendered as `<img>` (foreground) inside `.bet-chip` and `.pot .chip-row`.
- Color is chosen by amount via `chipFor(amount)` in `app.jsx`:
  - `< 5` → `bw-chip`
  - `5–9` → `blue-chip`
  - `10–24` → `green-chip`
  - `25–99` → `purple-chip`
  - `≥ 100` → `pink-chip`
- Pot displays a small stack of three sample chips (green / purple / blue) when `showChips` is true.

### Avatars
- Rendered as `<img>` inside `.avatar`. Object-fit cover, circular crop.
- If `player.avatar` is `null`, an initial-letter placeholder is rendered instead (`.avatar .placeholder`) — the ring color still comes from `player.ring`.
- For real users this should accept any square PNG/JPG/WebP URL; the three shipped avatars are placeholders/defaults.

### Card faces
- Card **faces** are **not images.** They are DOM (`.card-face`) — rank + suit char rendered as text on a CSS-painted card. Suits: `♥ ♦ ♠ ♣`, red for ♥/♦.
- Rationale: arbitrary 52-card rendering, no per-rank sprites needed.

## 3. Asset → component matrix (quick lookup)

| Asset | Component(s) |
|---|---|
| `bg.png` | `Root` / stage backdrop |
| `table.png` | `TableSurface` (the `.table-wrap` element) |
| `backcard.png` | `CardBack`, `BoardCards` (face-down slots), `OppHoles` |
| `*-chip.png` | `BetChip`, `Pot` |
| `avatar-*.png` | `Avatar` (only when `player.avatar` is set) |

## 4. Asset preparation checklist (for production build)

- Copy 11 files (`bg`, `table`, `backcard`, 5 chips, 3 avatars) to `/public/assets/` — exclude `player-border.png` and `uploads/chips.png` + `uploads/reference.png`.
- Verify intrinsic sizes match the rendered targets (no scaling artifacts at 1× stage).
- Consider exporting `@2x` versions later for retina; not required for v1.
- Add a license / source manifest if any asset is third-party.
