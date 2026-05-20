# NEONPOKER — Implementation Notes

This document captures the non-obvious rules and gotchas that must survive the port from the Babel-in-browser design files (`/design/*.jsx`, `/design/*.css`) to a real production build.

## 1. Hard rules (do not violate)

1. **Desktop-only, 1920 × 1080 stage.** All layout uses absolute pixels inside this canvas. Letterbox via `transform: scale(min(vw/1920, vh/1080))`. Do not introduce media queries, flex auto-fit, or "responsive" rework in v1.
2. **The UI is a tree of DOM nodes, not a screenshot.** Every visible text node (player name, stack, status, pot, hand-history rows, chat, badges, game info, action-bar amounts) is bound to data.
3. **Asset usage is restricted.** Only the 11 production PNGs (`bg`, `table`, `backcard`, 5 chips, 3 avatars) may be rendered as images. Everything else — cards, panels, buttons, badges, seats, timers, glows — is React/CSS.
4. **Player cards stack above the player container, never below.** Opponent → face-down `backcard.png` mini fan. Hero → face-up `CardFace` pair. See `states-map.md §4`.
5. **Opponent cards are always face-down.** Showdown reveal is out of scope for v1.
6. **Board cards always render 5 slots.** Unrevealed slots use `backcard.png`. Progression: preflop 5 backs → flop 3 faces + 2 backs → turn 4 faces + 1 back → river 5 faces.
7. **Do not ship `tweaks-panel.jsx`.** Strip the `TweaksPanel` JSX, the `useTweaks` hook, the `TWEAK_DEFAULTS` block (including `EDITMODE-BEGIN`/`END` markers), and the `urlOverrides()` helper from `app.jsx`. Also drop `kit.*`, `states-*`, `kit.css`, `states.css`, and all `NEONPOKER *.html` files.
8. **No mobile / responsive work in v1.** Pointer-only, mouse hover states only. Touch and keyboard polish can come later.
9. **Dealer / blinds / active turn come from `GameState`, never from layout indexes.** The mock `seatRoles(layout, seats)` helper in `app.jsx` is design-preview only. Production reads `dealerSeatIndex`, `smallBlindSeatIndex`, `bigBlindSeatIndex`, `activeSeatIndex` from the game-state store; these rotate every hand on the server. Do not port the mock formula into production wiring.

## 2. Production composition pseudocode

```jsx
function App({ gameState, players, hero, board, pot, history, chat, info, onAction, onChatSend }) {
  const layout = LAYOUTS[gameState.seats]; // 2 | 4 | 6 | 9
  // D / SB / BB / active come straight from GameState — never derived from layout.
  const {
    dealerSeatIndex,
    smallBlindSeatIndex,
    bigBlindSeatIndex,
    activeSeatIndex,
  } = gameState;

  return (
    <Stage>
      <Background />
      <Logo />

      <TableSurface>
        <Pot amount={pot.amount} showChips={board.reveal >= 3} />
        <BoardCards cards={board.cards} reveal={board.reveal} />
        <HeroHoleCards cards={hero.holes} />
        <SeatLayer
          layout={layout}
          players={players}
          states={gameState.states}
          dealerSeatIndex={dealerSeatIndex}
          smallBlindSeatIndex={smallBlindSeatIndex}
          bigBlindSeatIndex={bigBlindSeatIndex}
          activeSeatIndex={activeSeatIndex}
        />
      </TableSurface>

      <RightSidebar
        info={info}
        history={history}
        chat={chat}
        onChatSend={onChatSend}
      />

      <ActionBar
        potAmount={pot.amount}
        toCall={gameState.toCall}
        minRaise={gameState.minRaise}
        maxRaise={gameState.maxRaise}
        canCheck={gameState.canCheck}
        onAction={onAction}
      />
    </Stage>
  );
}
```

**Mock seatRoles — design only.** `app.jsx` derives `{ dealerIdx: 0, sbIdx: seats === 2 ? 0 : 1, bbIdx: seats === 2 ? 1 : 2 }` for the static design previews. This helper does **not** move into production. In real play, positions rotate after every hand, so the UI must consume the four index fields from `GameState` (see hard rule #9). Keep `seatRoles` only as a fixture builder for Storybook / mock data, ideally renamed to `mockSeatRoles` to remove ambiguity.

## 3. Code that needs to move from design files

- `data.jsx::seatAt`, `angleDir`, `evenAngles`, `makeLayout`, `LAYOUTS`, `holesSide`, `betOffset`, `badgeOffset` — pure functions, copy verbatim into a `lib/layout.ts`.
- `data.jsx::PLAYERS`, `DEFAULT_STATES`, `HAND_HISTORY`, `CHAT_MESSAGES`, `BOARD_DEFAULT`, `HERO_HOLES` — promote to fixtures under `mocks/` for Storybook / dev; production wires real game-state in their place.
- `app.jsx::chipFor` — chip-tier mapping; copy into `lib/chips.ts`.
- All of `components.jsx` and `panels.jsx` — port to TSX, type with the shapes in `components-map.md §3`, remove the `Object.assign(window, …)` window-export trailers.
- `styles.css` — copy to `app.css` or split into per-component CSS-modules. Keep the `:root` token block as the single source of truth.

## 4. Code that gets dropped

- `tweaks-panel.jsx` — entire file.
- `app.jsx`: `TWEAK_DEFAULTS`, the `/*EDITMODE-BEGIN*/.../*EDITMODE-END*/` markers, `urlOverrides()`, `useTweaks`, the `<TweaksPanel>` JSX, and the `<a className="kit-link">` link.
- `kit.jsx`, `kit.css`, `states-board.jsx`, `states-seats.jsx`, `states.css`.
- All four `NEONPOKER *.html` files (replaced by the production HTML template).
- The `<script>` includes that pull React/ReactDOM/Babel from `unpkg.com` (replaced by the bundler).

## 5. Build / tooling

- Recommended stack: **Vite + React 18 + TypeScript**. Babel-in-browser must go.
- Fonts: keep the Google Fonts link for `Orbitron`, `Rajdhani`, `JetBrains Mono` (or self-host).
- Static assets: copy `/design/assets/*.png` (minus `player-border.png`) to `public/assets/`. Paths in CSS remain `assets/<file>.png`.
- No image processing required in v1. Consider WebP later.
- No icon library required — the two SVGs (logo and chat-send) are inline.

## 6. Known limitations / out of scope for v1

- **Showdown reveal of opponent cards** — opponent cards never flip to face-up.
- **Animations beyond CSS keyframes** — no card-dealing trajectories from a deck origin, no chip-fly animations, no pot-collect animations.
- **Sit-down / empty-seat affordance** — `.seat.is-empty` styles exist but no real flow.
- **Spectator mode, multi-table, tournament lobby** — not modeled.
- **Sound** — not modeled.
- **Internationalization** — strings are inline English; refactor later.
- **Accessibility** — current design is mouse-only with no `aria-` work; needs a follow-up pass.
- **Touch / mobile** — explicitly out of scope.

## 7. Open questions for the product owner

1. **Avatar source of truth** — accept any URL from the back-end, or only a fixed set of presets?
2. **Showdown UX** — how should winning hands reveal opponent cards? (Currently no design.)
3. **Tournament info** — `Next Break` field in Game Info implies tournaments; cash tables would show something else.
4. **Hand-history depth** — only current hand, or scroll back through previous hands?
5. **Chat moderation / muting** — needed?
6. **Localization** — required scope?
7. **Currency display** — always `$`? Crypto? BB-equivalent toggle?

## 8. Testing surface for v1

- Snapshot the four layout presets (2 / 4 / 6 / 9) against the exported PNGs in `/design/exports/`.
- Storybook stories for each `SeatStatus` (×2 for hero vs opponent), each `reveal` value (0/3/4/5), and each `ActionBar` configuration (`canCheck` true/false, various pot sizes).
- Visual regression on the four `NEONPOKER *.html` reference pages once they're rebuilt under the new toolchain.
