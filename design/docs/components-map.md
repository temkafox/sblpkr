# NEONPOKER — Components Map

Future React component tree for the production app. Mirrors `app.jsx` / `components.jsx` / `panels.jsx` but with the Tweaks panel and editmode block removed. Names are proposed for the production build.

## 1. Tree

```
<App>                            // root, composes the 1920×1080 stage
├── <StageScaler>                // letterbox scaling wrapper (was useStageScale)
│   └── <Stage>                  // 1920×1080 absolute canvas
│       ├── <Background />       // bg.png + vignette
│       ├── <Logo />             // top-left brand mark + wordmark
│       ├── <TableSurface>       // table.png + felt watermark
│       │   ├── <Pot amount showChips />
│       │   ├── <BoardCards cards reveal />
│       │   ├── <HeroHoleCards cards />
│       │   └── <SeatLayer seats=[…]>
│       │       ├── <Seat … /> × N   // hero or opponent variant
│       │       ├── <SeatBadge … /> × {0..3}
│       │       └── <BetChip … />   × {0..N}
│       ├── <RightSidebar>
│       │   ├── <HandHistoryPanel history />
│       │   ├── <ChatPanel messages onSend />
│       │   └── <GameInfoPanel info />
│       └── <ActionBar pot toCall minRaise maxRaise canCheck onAction />
```

## 2. Component catalog

### Layout / shell

| Component | Responsibilities | Props (proposed) |
|---|---|---|
| `App` | Wire data sources, compose stage | — |
| `StageScaler` | Resize-observe viewport, set `transform: scale(s)` | `children` |
| `Stage` | Fixed 1920×1080 absolute canvas | `children` |
| `Background` | `.app-bg` + vignette overlay | — |
| `Logo` | Top-left identity mark | `subtitle?` |

### Table layer

| Component | Responsibilities | Props |
|---|---|---|
| `TableSurface` | `table.png` plate + `felt-mark` watermark; child positioning context | `children` |
| `Pot` | Pot label, amount, optional chip stack | `amount: number`, `showChips?: bool` |
| `BoardCards` | 5 community card slots, supports staged reveal | `cards: Card[5 \| ≤5]`, `reveal: 0\|3\|4\|5` |
| `HeroHoleCards` | Hero's two face-up cards (tilted, glowing) | `cards: [Card, Card]` |
| `SeatLayer` | Iterates layout, renders seats + overlays | `seats: SeatPos[]`, `states: Record<id, SeatState>`, `players: Record<id, Player>`, `dealerSeatIndex, smallBlindSeatIndex, bigBlindSeatIndex, activeSeatIndex` (all from `GameState`, not derived) |

### Seat

| Component | Responsibilities | Props |
|---|---|---|
| `Seat` | Discriminator: renders `HeroSeat` or `OpponentSeat` based on `pos.hero` | `player, state, pos` |
| `OpponentSeat` (= current `PlayerSeat`) | 244×84 seat pill: avatar, name, stack, status, timer, opt. hole cards | `player, state, pos, showHoles` |
| `HeroSeat` | 320×110 hero pill: larger avatar, larger type, cyan border, pulse-active glow | `player, state, pos` |
| `Avatar` | Circular portrait or initial placeholder with neon ring | `player, ring?, size?` |
| `OppHoles` | Two `backcard` rectangles, fanned, anchored above seat (`bottom: 100%`); muted when `folded` | `folded?: bool` |
| `SeatBadge` | `D` / `SB` / `BB` pill, positioned absolutely | `kind: 'd'\|'sb'\|'bb', x, y` |
| `BetChip` | Chip-icon + amount pill, positioned absolutely | `x, y, amount, chipKey?` |
| `StatusLine` (internal) | Text + color per `status` token | (consumed inside `Seat`) |
| `WinnerTag` (internal) | Amber pill above seat when winning hand | (consumed inside `Seat`) |
| `Timer` (internal) | Active-turn 15 s draining bar | (consumed inside `Seat`) |

### Cards

| Component | Responsibilities | Props |
|---|---|---|
| `CardFace` | White card with rank + suit char + large background suit | `rank, suit, big?` |
| `CardBack` | `backcard.png` plate (board size 88×124) | — |

### Sidebar

| Component | Responsibilities | Props |
|---|---|---|
| `RightSidebar` | Vertical stack of three panels | `playerCount, maxSeats, history, chat, info, onChatSend` |
| `Panel` (proposed shared) | Glass panel shell + heading bar | `title, children, collapsible?` |
| `HandHistoryPanel` | Streets + rows scroller | `streets: { street, rows: { name, cls, act }[] }[]` |
| `ChatPanel` | Scrollback + input + send button | `messages, onSend(msg)` |
| `GameInfoPanel` | 5 key/value rows (game type, stakes, buy-in, players, next break) | `info: { gameType, stakes, buyIn, playerCount, maxSeats, nextBreak }` |

### Action bar

| Component | Responsibilities | Props |
|---|---|---|
| `ActionBar` | 4 action buttons + raise controls | `potAmount, toCall, minRaise, maxRaise, canCheck, onAction(kind, amount?)` |
| `ActionButton` (proposed) | Stylised neon button (`fold`, `check`, `call`, `raise` variants) | `variant, label, sub?, disabled?, onClick` |
| `RaiseControls` | Amount input + slider + ± + quick-bet row | `min, max, value, pot, onChange` |
| `AmountInput` | Numeric input with `$` prefix | `value, min, max, onChange` |
| `RaiseSlider` | Custom slider (cyan→violet→magenta) with mouse-drag thumb | `value, min, max, onChange` |
| `QuickBetButton` | One of `MIN / 1/2 POT / POT / 2X POT / ALL-IN` | `id, label, active, onClick` |

## 3. Data shapes (TypeScript-style)

```ts
type Suit = 'h' | 'd' | 's' | 'c';
type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';
type Card = { r: Rank; s: Suit };

type RingColor = 'cyan'|'pink'|'magenta'|'violet'|'green'|'amber';

type Player = {
  id: string;
  name: string;
  stack: number;
  ring: RingColor;
  init: string;          // 1–2 char fallback inside avatar
  avatar: string | null; // URL or null
};

type SeatStatus =
  | 'turn' | 'fold' | 'check' | 'call'
  | 'raise' | 'allin' | 'winner' | 'sitout' | 'idle';

type SeatState = {
  status: SeatStatus;
  bet: number;     // chips committed this street, 0 if none
  amount?: number; // optional explicit amount for raise/call
};

type SeatPos = {
  id: string;       // player id at this seat
  x: number; y: number;
  w: number; h: number;
  hero: boolean;
  dir: 'down'|'down-left'|'down-right'|'left'|'right'|'up'|'up-left'|'up-right';
};

type HandHistoryRow = { name: string; cls: string; act: string };
type HandHistoryStreet = { street: 'PRE-FLOP'|'FLOP'|'TURN'|'RIVER'; rows: HandHistoryRow[] };

type ChatMessage = { who: string; cls: string; msg: string };

type GameInfo = {
  gameType: string;       // "No Limit Hold'em"
  stakes: string;         // "$1 / $2"
  buyIn: string;          // "$200 (100 BB)"
  playerCount: number;
  maxSeats: number;
  nextBreak: string;      // "00:45:21"
};

type ActionKind = 'fold' | 'check' | 'call' | 'raise';

type GameState = {
  seats: 2 | 4 | 6 | 9;
  // Authoritative position pointers — rotate every hand on the server side.
  // The UI never derives these from layout indexes in production.
  dealerSeatIndex: number;
  smallBlindSeatIndex: number;
  bigBlindSeatIndex: number;
  activeSeatIndex: number;
  // Per-seat status (turn / fold / call / …) keyed by seat index or player id.
  states: Record<string, SeatState>;
  // Action-bar context
  toCall: number;
  minRaise: number;
  maxRaise: number;
  canCheck: boolean;
};
```

## 4. State ownership (proposed)

For v1, the app is read-only from the design's perspective: external data flows in via props from a game-state store (Zustand / Redux / context — TBD). The only locally-stateful production components are:

- `ChatPanel` — local input text, emits `onSend`.
- `RaiseControls` — local amount + quick-bet selection, emits raise amount on action.
- `StageScaler` — local scale factor based on `resize`.

Everything else is pure / props-driven.

## 5. Removed at build time

- `TweaksPanel`, `TweakSection`, `TweakRadio`, `TweakSlider`, `TweakToggle`, `TweakSelect`, `useTweaks` — debug UI.
- `TWEAK_DEFAULTS` / `EDITMODE-BEGIN`/`END` marker block — design-iteration scaffolding.
- `urlOverrides()` — design-export helper (`?seats=2|4|6|9`).
- `.kit-link` anchor and the `NEONPOKER UI Kit.html` page — design helper.
- All `kit.*`, `states-*`, `states.css`, `kit.css` modules.
