# NEONPOKER — Layout Map (1920 × 1080)

All coordinates are absolute pixels inside the fixed 1920 × 1080 stage. Origin is top-left. Values are pulled from `styles.css` and `data.jsx`.

## 1. Screen regions

```
+---------------------------------------------------------------------------+ 0
| .logo  (30,24, 260×60)     .kit-link (320,38)         | .sidebar          |
|                                                       | (1590, 40)        |
|                                                       | 290 × 870         |
|        +----------------------------------------+     |                   |
|        |  .table-wrap (170,115, 1380×690)       |     |  HandHistory      |
|        |   .table-img (bg: table.png)           |     |   505 px          |
|        |                                        |     |                   |
|        |   .pot (810,300, 300×95)               |     |  ChatPanel        |
|        |   .board (620,410, 500×145)            |     |   250 px          |
|        |                                        |     |                   |
|        |   .hero-holes (760,568, 200×130)       |     |  GameInfoPanel    |
|        |                                        |     |   85 px           |
|        |   seats positioned on ellipse          |     |                   |
|        +----------------------------------------+     |                   |
|                                                       |                   |
|   .action-bar (95, 850, 1360×175)                     |                   |
+---------------------------------------------------------------------------+ 1080
```

## 2. Fixed element boxes

| Element | left | top | width | height | z-index | Source |
|---|---:|---:|---:|---:|---:|---|
| `.stage` | 0 | 0 | 1920 | 1080 | — | `styles.css` |
| `.app-bg` (bg.png) | 0 | 0 | 1920 | 1080 | 0 | `styles.css` |
| `.logo` | 30 | 24 | 260 | 60 | 50 | `styles.css` |
| `.kit-link` (helper only — remove in prod) | 320 | 38 | auto | auto | 50 | `styles.css` |
| `.table-wrap` (table.png) | 170 | 115 | 1380 | 690 | 5 | `styles.css` |
| `.felt-mark` (watermark "NEONPOKER" text) | center of table, ~28% from top | — | — | — | inside table-wrap | `styles.css` |
| `.pot` | 810 | 300 | 300 | 95 | 8 | `styles.css` |
| `.board` | 620 | 410 | 500 | 145 | 8 | `styles.css` |
| `.hero-holes` | 760 | 568 | 200 | 130 | 12 | `styles.css` |
| `.sidebar` | 1590 | 40 | 290 | 870 | 30 | `styles.css` |
| `.action-bar` | 95 | 850 | 1360 | 175 | 25 | `styles.css` |

## 3. Sidebar internal layout

`.sidebar` is a vertical flex column, gap = 14 px:

| Panel | flex-basis | Notes |
|---|---:|---|
| `HandHistoryPanel` | 505 px | Scrollable list of streets and rows |
| `ChatPanel` | 250 px | Scrollable log + pill-shaped input + send button |
| `GameInfoPanel` | 85 px | 5 key/value rows |

## 4. Action bar internal layout

`.action-bar` is a horizontal flex row, 22 px / 30 px padding:

- **`.btn-group`** — `flex: 0 0 760px`, 4-column grid, gap 12 px: `FOLD`, `CHECK`, `CALL $x`, `RAISE TO $x`.
- **`.raise-ctrls`** — `flex: 1`, left border hairline, contains:
  - **`.raise-top`** — amount input (`$nnn`, `width: 200px`, right-aligned).
  - **`.raise-mid`** — `−` button, slider (cyan→violet→magenta fill, magenta thumb), `+` button.
  - **`.raise-bot`** — 5-column grid: `MIN`, `1/2 POT`, `POT`, `2X POT`, `ALL-IN`.

## 5. Seat placement geometry

Seats are placed on an **ellipse** centered on the table felt (not on the page):

- Table center: `(TABLE_CX, TABLE_CY) = (860, 460)`.
- Seat-ellipse radii: `SEAT_RX = 560`, `SEAT_RY = 305`.
- Hero anchor: angle = 90° (bottom-center, screen-down). 0° = right, 90° = bottom, 180° = left, 270° = top.
- All other seats are placed at evenly-spaced angles `90 + i·(360/n)` for `i ∈ [1, n-1]`.
- Each seat box is positioned at `(cx + RX·cosθ − w/2, cy + RY·sinθ − h/2)`.

Seat box sizes:

| Type | width | height |
|---|---:|---:|
| Opponent `.seat` | 244 | 84 |
| Hero `.seat.hero` | 320 | 110 |

Each layout entry also carries a `dir` token derived from its angle: `down`, `down-left`, `down-right`, `left`, `right`, `up-left`, `up-right`, `up`. The `dir` is used to compute (a) bet-chip offset toward the felt center, (b) badge offset away from the avatar — both as defined in `data.jsx::betOffset` and `badgeOffset`. Hole-cards do **not** use `dir` — they are always anchored above the seat container (`top`).

## 6. Layout presets — 2 / 4 / 6 / 9 players

All presets share hero at angle 90° (bottom-center). The remaining seats fill the ellipse at `360/n` spacing.

### 9 players (`evenAngles(9)`, step = 40°)

| idx | id | angle (°) | approx position | dir |
|---:|---|---:|---|---|
| 0 | hero | 90 | bottom-center (860, 765) | down |
| 1 | p2 | 130 | bottom-left of felt | down-left |
| 2 | p3 | 170 | mid-left | left |
| 3 | p4 | 210 | upper-left | up-left |
| 4 | p5 | 250 | top-left of center | up |
| 5 | p6 | 290 | top-right of center | up |
| 6 | p7 | 330 | upper-right | up-right |
| 7 | p8 | 10 | mid-right | right |
| 8 | p9 | 50 | bottom-right of felt | down-right |

### 6 players (step = 60°)

| idx | id | angle (°) | position | dir |
|---:|---|---:|---|---|
| 0 | hero | 90 | bottom-center | down |
| 1 | p2 | 150 | bottom-left | down-left |
| 2 | p3 | 210 | upper-left | up-left |
| 3 | p4 | 270 | top-center | up |
| 4 | p5 | 330 | upper-right | up-right |
| 5 | p6 | 30 | bottom-right | down-right |

### 4 players (step = 90°)

| idx | id | angle (°) | position | dir |
|---:|---|---:|---|---|
| 0 | hero | 90 | bottom-center | down |
| 1 | p2 | 180 | left center | left |
| 2 | p3 | 270 | top center | up |
| 3 | p4 | 0 | right center | right |

### 2 players (heads-up, step = 180°)

| idx | id | angle (°) | position | dir |
|---:|---|---:|---|---|
| 0 | hero | 90 | bottom-center | down |
| 1 | p2 | 270 | top-center | up |

## 7. Button / blind anchors

**Production rule:** D / SB / BB / active-turn positions are **driven by `GameState`**, not by layout indexes. The UI consumes:

- `gameState.dealerSeatIndex`
- `gameState.smallBlindSeatIndex`
- `gameState.bigBlindSeatIndex`
- `gameState.activeSeatIndex`

These rotate after each hand and are the single source of truth for badge placement and the `turn` pulse. The UI never computes them from the seat count or hero position.

**Mock / design preview only** (used by `app.jsx` and the seat-states showcase, **not** for real play): anchored to the layout array,

- **9 / 6 / 4 players:** `D = idx 0` (hero), `SB = idx 1`, `BB = idx 2`.
- **2 players (heads-up):** `D = SB = idx 0` (hero, shows `D` badge), `BB = idx 1`.

This mock arrangement is acceptable for `/design/exports/*.png` parity and Storybook fixtures only.

Badge offset rules (`badgeOffset(dir, w, h)`): badges hover at the seat edge facing the felt, on the side away from the avatar so they never cover the portrait. See `data.jsx`.

## 8. Bet-chip indicator anchors

`betOffset(dir, w, h)` pushes the bet-chip pill from its seat **toward the felt center** (table center). Direction-keyed offsets in pixels:

| dir | dx (relative to seat left) | dy (relative to seat top) |
|---|---:|---:|
| down / down-left / down-right | `w/2 − 22` | `−34` |
| up / up-left / up-right | `w/2 − 22` | `h + 4` |
| left | `w + 4` | `(h − 28)/2` |
| right | `−76` | `(h − 28)/2` |

## 9. Z-index stack (bottom → top)

| z-index | Layer |
|---:|---|
| 0 | `.app-bg` |
| 5 | `.table-wrap` |
| 8 | `.pot`, `.board` |
| 10 | `.seat` (opponent) |
| 12 | `.hero-holes` |
| 14 | `.seat-badge`, `.bet-chip` |
| 18 | `.seat.hero` |
| 25 | `.action-bar` |
| 30 | `.sidebar` |
| 50 | `.logo`, `.kit-link` |

Within a seat: opponent hole-cards `z-index: 1` (tucked behind body), body `z-index: 2` (so cards look "held" behind it), timer `z-index: 3`. Hero hole-cards sit globally above seats at `z-index: 12`.
