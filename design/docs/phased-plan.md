# NEONPOKER — Global Phased Implementation Plan

This is the master delivery plan. It assumes the spec docs in `/design/docs/` (`design-spec`, `layout-map`, `assets-map`, `components-map`, `states-map`, `implementation-notes`) are accepted as-is.

## Stack (locked)

| Layer | Choice |
|---|---|
| Package manager | **pnpm** (locked) — strict hoisting, fast workspace links |
| Web | React 18 + TypeScript + Vite + Zustand + plain CSS (tokens from `styles.css :root`) |
| Realtime | Socket.IO client (added in Phase 7) |
| Server | Node.js + TypeScript + NestJS + Socket.IO gateway |
| Persistence | PostgreSQL + Prisma (Phase 8) |
| Auth | **MVP: guest nickname + room code only** (no accounts). Later: **magic-link email** if/when accounts are needed. No username/password. JWT + httpOnly cookies adopted alongside magic-link. |
| Cache | Redis — architectural placeholder only; not in MVP unless needed |
| Core | Pure TS package `@neonpoker/poker-core` — no Node, no React, no DOM imports |
| Hand evaluator | **Pure TypeScript implementation** in `poker-core`. No `pokersolver` or other JS evaluator in the production runtime. (3rd-party evaluators may be used in **tests** as cross-check oracles only.) |
| Shared | `@neonpoker/shared` — types, DTO, socket event names, zod schemas |
| Tests | Vitest (unit, poker-core + server services) + Playwright (e2e, Phase 9) |

### Locked rules-engine policies

- **Odd-chip rule (split pots).** The odd chip goes to the **first eligible winning player to the left of the dealer button, moving clockwise**. Applied per pot (main + each side pot) independently. Implemented in `poker-core/src/engine/pot-distribution.ts` (never in frontend) and tested explicitly in Phase 5 (`split-pot.spec.ts`).

### TypeScript / ESM / path-alias strategy (locked)

- **Path aliases are package-level only.** All cross-package imports use `@neonpoker/shared` and `@neonpoker/poker-core`. Deep imports (`@neonpoker/poker-core/src/engine/foo`) are banned by lint; only the package's `index.ts` barrel is the public surface.
- **Shared `tsconfig.base.json`** sets the common strict flags and path aliases. **Each app is allowed to override `module` / `moduleResolution`** in its own `tsconfig.json` if the bundler / runtime requires it:
  - `apps/web` — `module: ESNext`, `moduleResolution: Bundler` (Vite-native).
  - `apps/server` — `module: CommonJS` (or `NodeNext`), `moduleResolution: Node` — whatever NestJS + Vitest tolerate without runtime gymnastics. The base config will **not** force Vite-oriented bundler resolution onto the server.
  - `packages/*` — `module: ESNext`, `moduleResolution: Bundler`. Source is consumed directly via TS path aliases in dev; build output is emitted to `dist/` for any consumer that needs it.
- Workspace dependency direction is enforced both by `tsconfig.json#references` and by ESLint `no-restricted-imports` rules. The arrows (see "Critical boundaries" above) are checked in CI, not just in code review.

## Critical boundaries (never violate)

1. **React renders `GameState`. React never computes `GameState`.**
2. **All rules live in `packages/poker-core`. No imports from `apps/*` into core.**
3. **`apps/server` is authoritative.** Client emits **intents** (`fold | check | call | raise | allin`), server resolves with `poker-core`, broadcasts new `GameState`.
4. **`packages/shared` is the contract.** Both apps depend on it; it depends on nothing.
5. **No dealer/SB/BB derivation on the client.** Read `dealerSeatIndex / smallBlindSeatIndex / bigBlindSeatIndex / activeSeatIndex` straight off `GameState`.

Dependency arrows (allowed only):

```
apps/web ───► packages/shared
apps/server ─► packages/shared, packages/poker-core
packages/poker-core ─► packages/shared
packages/shared ─► (nothing)
```

---

## Phase 0 — Project architecture & monorepo bootstrap

**Goal.** Settle the workspace shape so every later phase plugs into a clean tree.

**Deliverables.**
- `pnpm` workspace (chosen for speed, strict hoisting, and good monorepo ergonomics).
- Root `package.json` with `workspaces: ["apps/*", "packages/*"]`, `engines.node >= 20`.
- `pnpm-workspace.yaml`.
- Root `tsconfig.base.json` (strict, `moduleResolution: "bundler"`, path aliases for `@neonpoker/*`).
- Per-package `tsconfig.json` extending base.
- Root `.editorconfig`, `.gitignore`, `.nvmrc` (Node 20 LTS).
- Lint/format: ESLint (typescript-eslint, react, react-hooks) + Prettier; shared config under `packages/config-eslint` or a root config.
- Empty placeholder packages with valid `package.json`:
  - `apps/web` (Vite + React + TS skeleton, renders "NEONPOKER")
  - `apps/server` (NestJS skeleton, single health route)
  - `packages/shared` (exports a stub type)
  - `packages/poker-core` (exports a stub function)
- One root script per phase: `pnpm dev:web`, `pnpm dev:server`, `pnpm test`, `pnpm typecheck`, `pnpm lint`.
- Naming conventions doc (`docs/conventions.md`): kebab-case dirs, PascalCase components/types, `*.types.ts` for type-only files, `__tests__/` colocated.

**Folders affected.** Repo root, `apps/web`, `apps/server`, `packages/shared`, `packages/poker-core`.

**Must NOT do yet.** Game logic, real UI, Socket.IO, Prisma, Docker, CI/CD pipelines, Redis.

**Dependencies.** None.

**Success criteria.**
- `pnpm install` succeeds from a cold clone.
- `pnpm dev:web` serves a blank "NEONPOKER" page; `pnpm dev:server` answers `GET /health`.
- `pnpm typecheck && pnpm lint` is green across all workspaces.
- An import from `apps/web` into `apps/server` (or vice versa) fails TS / ESLint by design (no path mapping for it).

**Risks.**
- Workspace path-alias misconfig (TS + Vite + Nest each resolve differently). Mitigation: validate cross-package import in a smoke test at end of Phase 0; allow per-app `tsconfig` overrides for `module` / `moduleResolution` rather than forcing one global setting.
- `pnpm` vs `npm` debate — locked to pnpm; do not revisit.

**Architecture Decision Record (deliverable).** Phase 0 also produces `docs/adr/0001-monorepo-foundations.md` capturing: pnpm choice, four-workspace shape, ESM/TS strategy, path-alias rules, package-boundary rules, lint enforcement approach. Future phases append ADRs; the table of contents lives in `docs/adr/README.md`.

---

## Phase 1 — Static frontend UI port (mock-only)

> Phase 1 is split into four sequential sub-phases. Each lands as its own reviewable PR. Do not start 1B before 1A is accepted, etc.

### Phase 1A — Stage shell, design tokens, assets

**Goal.** A blank but fully-styled stage that proves the toolchain end-to-end before any component logic.

**Deliverables.**
- `react-router-dom` installed; `apps/web/src/router.tsx` with placeholder routes (`/` → simple landing, others 404 for now).
- `apps/web/src/styles/tokens.css` — `:root` block copied verbatim from `/design/styles.css`.
- `apps/web/src/styles/base.css` — reset + body / html setup.
- `apps/web/src/components/Stage/`:
  - `StageScaler.tsx` — `useStageScale()` letterbox at 1920×1080.
  - `Stage.tsx` — the 1920×1080 absolute canvas.
- `apps/web/src/components/Background.tsx` — `.app-bg` (bg.png + vignette).
- `apps/web/src/components/Logo.tsx` — top-left brand mark from the design.
- Static assets copied: 11 PNGs from `/design/assets/` (minus `player-border.png`) to `apps/web/public/assets/`.
- Google Fonts preconnect + preload in `index.html`.

**Must NOT do yet.** Table, seats, pot, board, sidebar, action bar, room-entry form.

**Dependencies.** Phase 0.

**Success criteria.** Loading the app shows `bg.png` letterboxed in any 16:9 viewport with the top-left `NEONPOKER` logo. No layout shift after font load. No console errors.

### Phase 1B — TablePage static mock (9-seat layout only)

**Goal.** All visual components of the poker table rendered from a static mock at the 9-seat preset. This is the meat of the design port.

**Deliverables.**
- `apps/web/src/pages/TablePage/TablePage.tsx` mounted at `/table/:roomId` (uses a hardcoded mock `roomId` for now).
- Components ported from `/design/components.jsx` + `/design/panels.jsx`:
  - `TableSurface` (with `felt-mark`), `Pot`, `BoardCards`, `HeroHoleCards`.
  - `Avatar`, `OppHoles`, `PlayerSeat`, `HeroSeat`, `SeatBadge`, `BetChip`.
  - `CardFace`, `CardBack`.
  - `HandHistoryPanel`, `ChatPanel`, `GameInfoPanel`, `RightSidebar`.
  - `ActionBar` with `RaiseControls`, `AmountInput`, `RaiseSlider`, `QuickBetButton`.
- Layout math in `apps/web/src/lib/layout.ts` (`seatAt`, `angleDir`, `LAYOUTS`, `betOffset`, `badgeOffset`) and `apps/web/src/lib/chips.ts` (`chipFor`).
- Mocks under `apps/web/src/mocks/`: `players`, `gameState` (9-seat preset), `handHistory`, `chat`, `gameInfo`, `boardDefault`, `heroHoles`.
- `useMockGameState` Zustand store, shape-compatible with the future server `GameState`.

**Must NOT do yet.** Layout switching, board reveal toggle, room-entry screen, real navigation, server.

**Dependencies.** Phase 1A.

**Success criteria.** `/table/:roomId` renders the 9-seat layout matching `/design/exports/01-Table-9-players.png` within visual-diff tolerance. Badges and active pulse driven by `gameState` indexes (no hardcoded constants in components).

### Phase 1C — Layout presets (2/4/6/9) + board reveal states

**Goal.** Prove the layout math and the board state machine against all four configurations.

**Deliverables.**
- A dev-only query param (`?seats=2|4|6|9` and `?reveal=0|3|4|5`) on `/table/:roomId` to switch presets, mirroring the original `urlOverrides()` helper but kept behind a dev flag — **never** exposed in production UI.
- Mock fixtures expanded to cover all four seat counts and all four reveal values.
- Snapshot tests (Vitest + React Testing Library) for each `(seats, reveal)` combination — render and serialize the DOM tree to lock current output. (No visual assertions yet — those come in Phase 10.)

**Must NOT do yet.** Room entry, real routing flows, server.

**Dependencies.** Phase 1B.

**Success criteria.** All 16 `(seats × reveal)` combinations render without console errors and match `/design/exports/0[1-4]-Table-*-players.png` for the relevant seat counts.

### Phase 1D — JoinRoomPage + routing + local session guard

**Goal.** A working pre-game flow that lands users on the table screen via `/join` or `/room/:roomId`.

**Deliverables.**
- `apps/web/src/pages/JoinRoomPage/` — built from the same `Stage` + `Background` + glass-panel + Orbitron/Rajdhani recipe as the table; uses `.btn.call` / `.btn.raise` button styles. No new visual style.
- Form: `NicknameInput` (3–20 chars, alphanumeric + `-_`, persisted to `localStorage('neonpoker:lastNickname')`), `RoomCodeInput` (4–12 chars, hidden when `roomId` is in URL), helper text, `Join Room` (cyan), `Create Room` (magenta).
- `Create Room` generates a local pseudo-code in the **same format the server will issue** (6-char base32, e.g., `K7P4QX`) so URLs survive Phase 6/7.
- Routes finalized: `/ → /join`, `/join`, `/room/:roomId`, `/table/:roomId`, 404 fallback.
- `useSession` Zustand store (`{ nickname, roomId }`, persisted to `localStorage`).
- Route guard: `/table/:roomId` redirects to `/room/:roomId` when nickname is missing.

**Must NOT do yet.** Real socket connection, server-side room validation, real auth, lobby.

**Dependencies.** Phases 1A, 1B (1C is helpful but not blocking).

**Success criteria.**
- `/` lands on `/join`; submitting the form navigates to `/table/:roomId`.
- `/room/ABC123` locks the room-code field and asks only for a nickname.
- `/table/XYZ` cold (no session) redirects to `/room/XYZ`.
- Refresh on `/table/:roomId` after entering the form keeps the user on the table.

---

### Phase 1 — combined definition (informational)

**Goal.** Pixel-faithful port of `/design` into the production toolchain, driven by local mock data only. No server, no rules, no `tweaks-panel`. Adds a pre-game **Room Entry** screen so users have somewhere to land before the table.

**Deliverables.**
- `apps/web` becomes the real app: Vite + React 18 + TS.
- **Routing:** `react-router-dom` with three routes:
  - `/join` — `JoinRoomPage` (nickname + room code form).
  - `/room/:roomId` — `JoinRoomPage` again, but `roomId` is pre-filled from the URL and read-only; only nickname is asked. Use this for invite links.
  - `/table/:roomId` — the existing poker `TablePage` (the design we already ported).
  - Default `/` redirects to `/join`.
- Design tokens lifted verbatim from `/design/styles.css :root` into `apps/web/src/styles/tokens.css`.
- `StageScaler` (letterbox 1920×1080) + `<Stage>` wrapper.
- **Table screen** components ported from `/design/components.jsx` + `/design/panels.jsx`:
  - `Background`, `Logo`, `TableSurface` (with `felt-mark`)
  - `Pot`, `BoardCards`, `HeroHoleCards`
  - `Avatar`, `OppHoles`, `PlayerSeat`, `HeroSeat`, `SeatBadge`, `BetChip`
  - `CardFace`, `CardBack`
  - `HandHistoryPanel`, `ChatPanel`, `GameInfoPanel`, `RightSidebar`
  - `ActionBar` (with `RaiseControls`, `AmountInput`, `RaiseSlider`, `QuickBetButton`)
- **Room Entry screen** (new) — `apps/web/src/pages/JoinRoomPage/`:
  - Uses the **same** `Stage` + `Background` + `Logo` shell as the table. **No new visual style.**
  - Centered glass card (~520×460), built from the same panel recipe as `RightSidebar` panels (`.panel` background gradient, violet hairline top, cyan corner glow, backdrop blur).
  - Heading "ENTER ROOM" in Orbitron, body in Rajdhani.
  - Fields:
    - `NicknameInput` — 3–20 chars, trimmed, alphanumeric + `-_`, error message inline. Pre-fills from `localStorage('neonpoker:lastNickname')` if present.
    - `RoomCodeInput` — required at `/join`, hidden / disabled+filled at `/room/:roomId`. Validates basic shape (e.g., 4–12 alphanumeric chars).
    - Optional helper text: "Enter a room code or use an invite link."
  - Primary action: `Join Room` button — `.btn.call` variant (cyan), disabled until both fields valid.
  - Secondary action: `Create Room` button — `.btn.raise` variant (magenta/violet). MVP: generates a local pseudo-room code and navigates to `/table/:roomId`. Server-side creation arrives in Phase 6.
  - Inline error states for invalid input.
  - "Made with NEONPOKER" small footer using `--text-lo`.
- Reusable form primitives in `apps/web/src/components/form/`: `TextField`, `Button` (variants: `call`, `raise`, `fold`, `check` — already in `styles.css` from the action bar).
- Layout math (`seatAt`, `angleDir`, `LAYOUTS`, `betOffset`, `badgeOffset`, `chipFor`) ported into `apps/web/src/lib/layout.ts` and `lib/chips.ts`.
- Mock fixtures under `apps/web/src/mocks/`: `players`, `gameState`, `handHistory`, `chat`, `gameInfo`, `boardDefault`, `heroHoles`.
- A `useMockGameState` Zustand store wired to the mocks, exposing the same shape the future server will deliver (`GameState`).
- A `useSession` Zustand store (also Phase-1-local, replaced in Phase 7) holding `{ nickname, roomId }`. Persists to `localStorage` so a refresh on `/table/:roomId` doesn't kick the user back to `/join`.
- **Route guard:** `/table/:roomId` checks `useSession` for a nickname; if missing, redirects to `/room/:roomId` (preserves `roomId`).
- Storybook **optional in this phase**; if added, set up alongside Vite, but it's not blocking.
- Static assets copied: 11 PNGs from `/design/assets/` (minus `player-border.png`) to `apps/web/public/assets/`.

**Folders affected.**
- `apps/web/src/pages/JoinRoomPage/**` (new)
- `apps/web/src/pages/TablePage/**` (the design we ported)
- `apps/web/src/router.tsx` (new)
- `apps/web/src/components/form/**` (new)
- `apps/web/src/components/**` (table components, as before)
- `apps/web/src/lib/**`, `apps/web/src/mocks/**`, `apps/web/src/state/**`, `apps/web/src/styles/**`
- `apps/web/public/assets/**`

**Must NOT do yet.**
- Any real poker logic (no shuffle, no betting validation).
- Socket.IO or `fetch` (room "creation" is a local pseudo-code generator only).
- Real authentication, user accounts, password fields.
- Lobby / matchmaking / table browser UI.
- Server-side room validation (capacity, duplicate nickname, exists/not-exists). The room-entry form does **shape** validation only.
- Redesigning the table UI. The room-entry screen reuses the existing design system; the table screen is untouched from the prior port plan.
- `TweaksPanel`, `EDITMODE-BEGIN/END` markers, `urlOverrides()`, `kit-link` — strip on port.
- Mobile / responsive media queries.
- Animations beyond what's already in `styles.css`.
- Showdown opponent-card reveal.

**Dependencies.** Phase 0.

**Success criteria.**
- Opening the app at `/` lands on `/join`.
- `/join` accepts a nickname + room code and navigates to `/table/:roomId`.
- Opening `/room/ABC123` shows the same screen with `ABC123` shown and the room-code field locked; only nickname is asked; submit navigates to `/table/ABC123`.
- Opening `/table/XYZ` cold (no session) redirects to `/room/XYZ`.
- All 4 layout presets (2 / 4 / 6 / 9) render on `/table/:roomId` and match `/design/exports/0[1-4]-Table-*-players.png` visually.
- `gameState.seats / dealerSeatIndex / smallBlindSeatIndex / bigBlindSeatIndex / activeSeatIndex` drive badges and the active pulse — **no hardcoded `D=0 SB=1 BB=2`** in components (mock fixtures may set those values, but components consume them as data).
- Hero hole cards render face-up above the hero seat; opponent hole cards render face-down above each opponent seat.
- Board supports `reveal ∈ {0, 3, 4, 5}` via a fixture toggle.
- The room-entry screen visually belongs to the same product — same background plate, same glass panel recipe, same typography, same button styling as the table's `ActionBar`.
- `pnpm dev:web` opens in any 16:9 viewport letterboxed correctly down to ~1280×720 and up to 4K.

**Risks.**
- CSS regressions when moving from Babel-in-browser to Vite + ES modules — mitigate with side-by-side screenshot comparison to `/design/exports/`.
- Babel-standalone JSX uses class fields and `Object.assign(window, …)` exports; these patterns must all be converted cleanly.
- Font loading flash — preconnect/preload Google Fonts up front.
- Form-state edge cases (refresh on `/room/:roomId`, paste of full invite URL into the room-code field, etc.). Mitigation: parse and normalize on input; add a small unit test.
- Risk of "fake room creation" diverging from real server-issued codes. Mitigation: keep the local generator format identical to what the server will issue (e.g., 6-char base32) so URLs survive the Phase 6/7 transition.

---

## Phase 2 — Shared contracts (`packages/shared`)

**Goal.** Lock the wire format and types before any rules code is written.

**Deliverables.**
- `packages/shared/src/types/`:
  - `card.ts` — `Suit`, `Rank`, `Card`
  - `player.ts` — `Player`, `PlayerId`, `SeatIndex`
  - `game-state.ts` — `GameState`, `TableState`, `HandState`, `Street`, `SeatState`, `SeatStatus`
  - `action.ts` — `PlayerAction` (intent), `ActionKind`, `AvailableActions`
  - `pot.ts` — `Pot`, `SidePot`
  - `chat.ts` — `ChatMessage`
  - `hand-history.ts` — `HandHistoryEntry`
- `packages/shared/src/events/socket-events.ts` — string-constant map for socket event names (`SERVER_GAME_STATE`, `CLIENT_PLAYER_ACTION`, `SERVER_HAND_HISTORY`, etc.).
- `packages/shared/src/dto/` — zod schemas for every client→server payload (validated on the server) and a few server→client payloads where it adds safety.
- A versioning constant `PROTOCOL_VERSION` and `clientHello` shape.
- `index.ts` re-exports.

**Folders affected.** `packages/shared/**`.

**Must NOT do yet.** Behavior, rules, default state factories — types only (zod schemas are fine as they're contract).

**Dependencies.** Phase 0.

**Success criteria.**
- Both `apps/web` and `apps/server` can import the same `GameState` and get identical structural typing.
- Zod schemas exist for every inbound socket event. `parse()` is what gates the server.
- No runtime code beyond zod schemas and constants.

**Risks.**
- Premature DTO commitment. Mitigation: keep types deliberately small now; expand as Phases 3/6 expose real needs.
- Cyclic deps if `shared` accidentally imports anything else — enforce via lint rule.

---

## Phase 3 — `poker-core` domain model

**Goal.** Define immutable data structures that represent a poker hand, without any rules yet.

**Deliverables.**
- `packages/poker-core/src/domain/`:
  - `card.ts` — re-export / refine from `shared`
  - `deck.ts` — `Deck` type, `createDeck(seed?)`, `shuffle(deck, rng)`
  - `seat.ts` — `Seat`, `SeatIndex`
  - `player-state.ts` — chips, holeCards, hasFolded, isAllIn, currentBet, totalCommitted
  - `table-state.ts` — seats, maxSeats, dealerSeatIndex, smallBlind, bigBlind
  - `hand-state.ts` — boardCards, deck, street, pots, currentTurnSeatIndex, lastAggressorSeatIndex, minRaise, lastRaiseAmount
  - `game-state.ts` — composition of TableState + HandState + per-seat PlayerState
  - `player-action.ts` — discriminated union: `Fold | Check | Call | Raise(amount) | AllIn`
- Pure factories: `createInitialGameState(config)`, `dealCards(state, rng)`.
- A `RandomSource` interface + a deterministic seeded RNG (for reproducible tests).

**Folders affected.** `packages/poker-core/**`.

**Must NOT do yet.** Any decision logic (turn advance, action validation, pot distribution).

**Dependencies.** Phases 0, 2.

**Success criteria.**
- All domain types are immutable in spirit (use `readonly` and never mutate in place; transitions produce a new object).
- `createDeck()` returns 52 unique cards; shuffle is deterministic given a seed.
- `poker-core` exports zero side-effects; importing the package does nothing at runtime.
- No `console.log`, no I/O, no Node-only APIs.

**Risks.**
- Over-modeling. Keep it tight; if a field isn't needed by Phase 4 rules, remove it.
- Drift from `packages/shared`. Decide upfront: domain re-exports shared types unchanged, or core has internal types that map at the server boundary. Recommendation: **re-export** to avoid duplicate sources of truth.

---

## Phase 4 — `poker-core` rules engine

**Goal.** Implement Texas Hold'em NL rules as a set of pure transitions.

**Deliverables.**
- `packages/poker-core/src/engine/`:
  - `start-hand.ts` — rotate button, post blinds, deal hole cards, set first-to-act preflop.
  - `actions.ts` — `applyAction(state, seatIndex, action)`; returns new state or throws `InvalidActionError`.
  - `available-actions.ts` — `getAvailableActions(state, seatIndex)`; returns `{ canFold, canCheck, canCall, callAmount, canRaise, minRaise, maxRaise, canAllIn }`.
  - `turn-order.ts` — preflop and postflop action order, with all-in/folded skipping; advance after each action; close betting round on bet-matched-or-everyone-acted.
  - `min-raise.ts` — last full raise tracking; correct semi-raise rule for short all-ins.
  - `street.ts` — `advanceStreet(state)`; deals flop/turn/river; resets street bets.
  - `side-pots.ts` — compute main + side pots from per-seat `totalCommitted`.
  - `showdown.ts` — evaluate best 5-card hand per still-in player; rank with a hand evaluator.
  - `hand-evaluator.ts` — pure TypeScript 5-of-7 evaluator (locked). No `pokersolver` / external JS evaluator at runtime. Implementation approach: rank straight flush → quads → full house → flush → straight → trips → two pair → pair → high card, with explicit handling of the wheel (A-2-3-4-5) and kicker tiebreaks. Performance is not a constraint at MVP scale.
  - `pot-distribution.ts` — distribute each pot to the best eligible hand(s); on split pots, **odd chip goes to the nearest eligible winner clockwise from the dealer button**, computed independently per pot.
- All functions are **pure**: `(state, …) => newState | result`. No mutation. No clocks. No randomness except via injected `RandomSource`.
- Custom error types: `InvalidActionError`, `OutOfTurnError`, `InsufficientChipsError`, etc.

**Folders affected.** `packages/poker-core/**`.

**Must NOT do yet.** Persistence, networking, timeouts, server scheduling, table-lifecycle (sit-down, leave, rebuy).

**Dependencies.** Phase 3.

**Success criteria.**
- `applyAction(state, seat, intent)` rejects all invalid actions with typed errors.
- A full hand can be driven end-to-end by sequential `applyAction` calls + `advanceStreet` calls.
- Splitting a pot across N tied winners yields chips summing exactly to the pot (no rounding leak).
- Side-pot math holds for arbitrary all-in stacks.

**Risks.**
- **Hand evaluator correctness.** Mitigation: extensive table-driven tests in Phase 5 against known rankings, including straights wheel A-2-3-4-5 and royal flush.
- **All-in / min-raise edge cases.** The "incomplete raise doesn't reopen action" rule is a frequent bug source — test exhaustively.
- **Odd-chip rule.** Pick one deterministic policy and document it.

---

## Phase 5 — `poker-core` unit tests

**Goal.** Lock the rules engine with Vitest.

**Deliverables.**
- `packages/poker-core/__tests__/`:
  - `start-hand.spec.ts` — button rotation, blind posting (incl. heads-up: dealer = SB), first-to-act preflop = UTG / hu = dealer.
  - `actions-validation.spec.ts` — every invalid combination throws the right error.
  - `available-actions.spec.ts` — check available actions in every street + position + bet state.
  - `min-raise.spec.ts` — short all-in doesn't reopen; full raise does.
  - `all-in.spec.ts` — single all-in, multiple simultaneous all-ins, all-in caller against larger stack.
  - `side-pots.spec.ts` — main + 1, 2, 3 side pots; correct eligibility per pot.
  - `split-pot.spec.ts` — exact tie, two-way and three-way; **odd-chip rule: chip awarded to nearest eligible winner clockwise from the dealer button**, verified across multiple dealer positions and across main + side pots.
  - `heads-up.spec.ts` — D=SB; preflop dealer acts first; postflop dealer acts last.
  - `turn-order.spec.ts` — folded seats and all-in seats are skipped; round closes correctly.
  - `street-transitions.spec.ts` — board dealt at correct counts; bets reset; first-to-act postflop = first non-folded seat left of button.
  - `winner-determination.spec.ts` — known board+hole combos → known winner / split.
  - `hand-evaluator.spec.ts` — every category boundary; wheel; royal; kicker tiebreaks.
- Deterministic seeded RNG for any test that deals cards.
- Property-based check (fast-check) for: "total chips before == total chips after a full hand."
- **Optional cross-check (dev-only):** `hand-evaluator.spec.ts` may import a third-party evaluator (e.g., `pokersolver`) under `devDependencies` to oracle a large random-board sample against our pure-TS evaluator. The oracle never enters the production bundle.

**Folders affected.** `packages/poker-core/__tests__/**`, `packages/poker-core/vitest.config.ts`.

**Must NOT do yet.** UI tests, integration tests, Playwright.

**Dependencies.** Phase 4.

**Success criteria.**
- All tests green.
- Branch coverage on `engine/` ≥ 90% (informational, not gating).
- The fast-check chip-conservation property passes ≥10k iterations.

**Risks.**
- Test-only helpers leaking into the production bundle — keep them under `__tests__/` and exclude from `tsconfig` build.

---

## Phase 6 — Backend skeleton (`apps/server`)

> Phase 6 is split into four sequential sub-phases. Each lands as its own reviewable PR.

### Phase 6A — Room REST endpoints

**Goal.** A minimal `RoomService` + REST surface so the room-entry screen can talk to a real server.

**Deliverables.**
- NestJS bootstrap with `AppModule`, `HealthModule`, `RoomModule`.
- `RoomService` — in-memory `Map<roomId, Room>` with `{ id, code, createdAt, hostPlayerId, maxSeats, status }`.
- REST endpoints:
  - `POST /rooms` → `{ roomId, code }` (6-char base32, same format as the Phase 1D local generator).
  - `GET /rooms/:roomId` → `{ exists, seatCount, maxSeats }`.
- Zod schemas in `packages/shared/src/dto/room.ts` validating both payloads.
- CORS configured for local dev (`apps/web` origin allow-listed).

**Must NOT do yet.** Sockets, game state, persistence.

**Dependencies.** Phases 0, 2.

**Success criteria.** `curl POST /rooms` returns a code; subsequent `GET /rooms/:roomId` shows it exists. Bad payloads rejected with `400` + zod error.

### Phase 6B — Socket join/leave + ROOM_STATE

**Goal.** Pre-game roster over Socket.IO. Players can join a room and see who else is seated. No gameplay yet.

**Deliverables.**
- `RealtimeModule` with `TableGateway`.
- Events: `REGISTER_NICKNAME`, `JOIN_ROOM`, `LEAVE_ROOM`, server-emitted `ROOM_STATE` (roster), `ERROR`.
- Nickname validation: shape + duplicate-per-room (`NICKNAME_TAKEN`, case-insensitive).
- Capacity validation: `ROOM_FULL`, `ROOM_NOT_FOUND`, `ALREADY_JOINED`.
- Per-socket session: `{ socketId, nickname, playerId (uuid), currentRoomId? }`.
- Disconnect handling: free the seat on `disconnect`, broadcast updated `ROOM_STATE`.

**Must NOT do yet.** Game start, `poker-core` calls, hole-card filtering (no cards exist yet).

**Dependencies.** Phase 6A.

**Success criteria.** Two `socket.io-client` test clients can both join a room, see each other in `ROOM_STATE`, and a third with the same nickname or in a full room is rejected with the right error code.

### Phase 6C — `poker-core` actions through server

**Goal.** Wire `poker-core` into the gateway so a hand can actually be played server-authoritative.

**Deliverables.**
- `GameModule` with `GameService` wrapping `startHand`, `applyAction`, `advanceStreet`.
- `TableService` (in-memory `Map<roomId, GameState>`), one game state per room.
- Events: `PLAYER_ACTION`, server-emitted `GAME_STATE` (full state, **not** filtered yet), `HAND_RESULT`, `AVAILABLE_ACTIONS`.
- Server-side action validation: `getAvailableActions` gates every incoming `PLAYER_ACTION`; invalid → `ERROR` to the sender, no broadcast.
- Per-table action queue (async-mutex) to serialize concurrent actions.

**Must NOT do yet.** View filtering for hole cards (Phase 6D). Tournament logic. Persistence.

**Dependencies.** Phases 4, 5, 6B.

**Success criteria.** Two clients in a room can play a full hand end-to-end; chips are conserved across the hand; an invalid action (e.g., check-when-can't) yields `ERROR` and the server state is unchanged.

### Phase 6D — Per-seat view filtering

**Goal.** Each player sees only their own hole cards (and any cards exposed at showdown).

**Deliverables.**
- `apps/server/src/realtime/view-for-seat.ts` — pure function `viewForSeat(state, seatIndex): GameState` that strips opponent hole cards.
- Gateway broadcasts using per-socket filtered views instead of one global payload.
- Dedicated tests for the filter (no leakage, showdown reveals only when `street === 'SHOWDOWN'` and seat is not folded).

**Must NOT do yet.** Persistence, auth.

**Dependencies.** Phase 6C.

**Success criteria.** A unit test asserts that for any in-progress hand, `viewForSeat(state, i)` contains no `holeCards` for `j ≠ i`. A live test with two clients shows each seeing only its own cards until showdown.

---

### Phase 6 — combined definition (informational)

**Deliverables.**
- NestJS modules:
  - `AppModule`, `HealthModule`.
  - **`RoomModule`** — manages room lifecycle (the pre-game container). `RoomService` holds `Map<roomId, Room>` where each `Room` has `{ id, code, createdAt, hostPlayerId, seats[], maxSeats, status }`. REST endpoints:
    - `POST /rooms` — create a new room (returns `{ roomId, code }`). The `code` is the shareable invite token.
    - `GET /rooms/:roomId` — fetch existence + capacity (for the room-entry screen to validate before connecting).
  - `TableModule` — `TableService` (in-memory `Map<roomId, GameState>`), one game state per room.
  - `GameModule` — `GameService` wraps `poker-core` calls (`startHand`, `applyAction`, `advanceStreet`).
  - `RealtimeModule` — `TableGateway` (Socket.IO): rooms keyed by `roomId`.
- Events:
  - `client → server`: `REGISTER_NICKNAME`, `JOIN_ROOM`, `LEAVE_ROOM`, `PLAYER_ACTION`, `CHAT_MESSAGE`.
  - `server → client`: `ROOM_STATE` (pre-game roster), `GAME_STATE`, `AVAILABLE_ACTIONS`, `HAND_RESULT`, `CHAT_MESSAGE`, `ERROR`.
- **Nickname registration per socket session.** On connect, client must emit `REGISTER_NICKNAME { nickname }`; server stores nickname against the socket id. Server-side validation:
  - shape: 3–20 chars, allowed character set
  - **duplicate-nickname handling within a room** — reject with `ERROR { code: 'NICKNAME_TAKEN' }` if another seated player in the same room already has it (case-insensitive)
  - profanity / reserved-name list — placeholder, MVP allows everything
- **Room capacity validation.** `JOIN_ROOM { roomId }` rejects with `ROOM_FULL` if seats are taken, `ROOM_NOT_FOUND` if the id doesn't exist, `ALREADY_JOINED` if the same socket tries to seat twice.
- Auth stub: socket handshake carries `{ nickname, roomCode? }`; no JWT yet. The nickname + socket id is the player identity for MVP. Real auth is Phase 8+.
- Per-seat **view filtering**: opponent hole cards are stripped before broadcast; only revealed at showdown.
- Server-side timeout placeholder for "act within N seconds" — implementation OK, but pure in-memory for now.

**Folders affected.** `apps/server/src/**`.

**Must NOT do yet.** Database, Redis, JWT, real authentication / user accounts, tournament logic, sit-out/leave-during-hand polish, reconnect-state-resync polish, lobby / matchmaking, multi-room browsing.

**Dependencies.** Phases 0, 2, 3, 4 (5 helpful, not blocking).

**Success criteria.**
- `POST /rooms` issues a `{ roomId, code }`; `GET /rooms/:roomId` returns capacity + seated count.
- Two socket clients connecting with `REGISTER_NICKNAME` + `JOIN_ROOM { roomId }` are seated; a third with the same nickname is rejected with `NICKNAME_TAKEN`; a third with a different nickname when the room is full is rejected with `ROOM_FULL`.
- Two `wscat` / two `socket.io-client` test clients can both join a room, post blinds, complete a hand to showdown, see pot distribution, with hole cards hidden across seats.
- All `PLAYER_ACTION` payloads are zod-validated against `packages/shared`.
- Server never trusts client-supplied amounts beyond the intent (e.g., a raise amount is range-validated against `getAvailableActions`).
- An `InvalidActionError` from core → `ERROR` event to the offending client, no broadcast.

**Risks.**
- Concurrency: two actions from the same seat at once. Mitigation: single per-table message queue (NestJS `EventEmitter` or a simple async-mutex per `tableId`).
- Filtering bugs that leak opponent hole cards. Mitigation: a dedicated `view-for-seat.ts` mapper with its own tests.

---

## Phase 7 — Frontend ↔ backend integration

**Goal.** Replace mock state with real server-driven state; route all player intents through the socket.

**Deliverables.**
- `apps/web/src/net/socket.ts` — Socket.IO client wrapper, single connection per session.
- **`JoinRoomPage` rewires** to the real server:
  - `Join Room` → calls `GET /rooms/:roomId` to verify existence, then opens the socket with `{ nickname, roomId }` in the handshake; on `connect`, emits `REGISTER_NICKNAME` + `JOIN_ROOM`; on success, navigates to `/table/:roomId`. On `ROOM_NOT_FOUND`, `ROOM_FULL`, or `NICKNAME_TAKEN`, surfaces inline error.
  - `Create Room` → calls `POST /rooms`, then proceeds as above.
- A `useGameState` Zustand store replaces `useMockGameState`. Same shape; new data source.
- A `useRoomState` Zustand store holds pre-game roster (who's seated, host) — driven by `ROOM_STATE` events.
- `useSession` (introduced in Phase 1) now also carries the live `socketId` and connection status.
- `useAvailableActions` selector — disables/enables `ActionBar` buttons from `gameState.availableActions` for the local seat.
- Intent emitters: `sendFold()`, `sendCheck()`, `sendCall()`, `sendRaise(amount)`, `sendAllIn()`.
- Reconnect handler — on connect, request current `GAME_STATE` snapshot for the current `roomId`; if the room is gone or the nickname slot is taken, redirect to `/join` with a banner.
- Hand-history & chat panels switch to server feed.

**Folders affected.** `apps/web/src/net/**`, `apps/web/src/state/**`, `apps/web/src/components/ActionBar/**`, `apps/web/src/components/Sidebar/**`.

**Must NOT do yet.** Persistence-backed tables, real auth UI, mobile, animations beyond CSS, opponent-card showdown reveal polish.

**Dependencies.** Phases 1, 2, 6.

**Success criteria.**
- Opening `/join`, entering a nickname + room code, and clicking `Join Room` actually connects to the server, registers the nickname, joins the room, and navigates to `/table/:roomId`.
- An invite link `/room/:roomId` shared from one browser to another lets a second player join the same room with a different nickname.
- Invalid scenarios (`ROOM_NOT_FOUND`, `ROOM_FULL`, `NICKNAME_TAKEN`) display inline errors on `JoinRoomPage` without crashing the app.
- Two browser windows can join one in-memory room on the local server, play a full hand, and the UI stays in sync at every action.
- Disabling network for 5 s and re-enabling restores the same `GameState`.
- The web app contains **no rules code**. A grep for "minRaise" / "evaluateHand" / "advanceStreet" in `apps/web/src/**` returns nothing.

**Risks.**
- State races between optimistic UI and server broadcast. Mitigation: no optimistic updates in MVP — always wait for the authoritative `GAME_STATE`.
- Per-seat view drift if the server filter has a bug. Mitigation: in dev, log a diff of seat views vs full state on the server.

---

## Phase 8 — Persistence

**Goal.** Make tables, users, and hand history durable.

**Auth approach (locked).** MVP stays on **guest nickname + room code** — no accounts. Phase 8 introduces persistence first; real auth is added only **if/when accounts are required** (multi-device sessions, friends list, leaderboards, etc.), and at that point it is **magic-link email + JWT in httpOnly cookies**. No username/password.

**Deliverables.**
- Prisma schema:
  - `User` (id, email or oauth identity, displayName, avatarUrl, ringColor)
  - `Table` (id, name, stakes, maxSeats, createdAt)
  - `Hand` (id, tableId, handNumber, startedAt, endedAt, boardCards, potTotal)
  - `HandAction` (id, handId, seatIndex, action, amount, street, sequence)
  - `Seat` (tableId, seatIndex, userId, chips) — current sitting state
  - `ChipTransaction` (id, userId, tableId, handId, delta, reason)
  - `ChatMessage` (id, tableId, userId, msg, at)
- Migrations + a seed script.
- `apps/server` services switch from `Map<tableId, GameState>` to: load on first access, persist after each hand (or each action — decide based on perf).
- Hand-history endpoint for the sidebar replay.
- **If accounts are needed in this phase:** JWT auth (httpOnly cookie) + a minimal `/login` flow using **email magic-link only** (no username/password). Otherwise, keep guest-only and skip this deliverable.
- A graceful shutdown path that flushes in-memory state.

**Folders affected.** `apps/server/prisma/**`, `apps/server/src/persistence/**`, `apps/server/src/auth/**`, root `docker-compose.yml` (Postgres for local dev).

**Must NOT do yet.** Sharding, Redis pub/sub between server replicas, monetization, KYC, geolocation gating.

**Dependencies.** Phases 6, 7.

**Success criteria.**
- A server restart preserves table state and chip balances.
- A full hand creates one `Hand` row + N `HandAction` rows + chip transactions that balance to zero across players (i.e., chips conserved).
- The hand-history panel reads from the DB, not from in-memory.

**Risks.**
- Hand-action write amplification. Mitigation: batch within a transaction at end of street or end of hand; OK to revisit if profiling shows pressure.
- Schema churn vs. early users. None expected at this stage — break the schema freely.

---

## Phase 9 — End-to-end tests (Playwright)

**Goal.** Lock the user-visible behavior of the full stack.

**Deliverables.**
- `e2e/` workspace with Playwright + a Postgres-backed test environment (Docker-compose).
- Test fixtures that boot the server with a known seed (deterministic deals via `RandomSource`).
- Scenarios:
  - Create table & join two players.
  - Blinds posted automatically.
  - Each player acts through preflop / flop / turn / river.
  - Street progression renders correct card count and pot increments.
  - Showdown reveals winner; pot transfers; chips update.
  - Disconnect mid-hand → reconnect → state restored.
  - Invalid action attempt (e.g., check-when-can't) shows error UI, not silent fail.
- CI job runs Playwright headless against ephemeral Postgres.

**Folders affected.** `e2e/**`, root CI config.

**Must NOT do yet.** Load tests, soak tests, chaos tests.

**Dependencies.** Phases 7, 8.

**Success criteria.**
- All listed scenarios pass on CI.
- Test run time ≤ ~5 min wall clock.

**Risks.**
- Flakiness on animations/timers. Mitigation: use Playwright's auto-waiting + `[data-testid]` attributes added in Phase 1; freeze CSS animations via a `?test=1` flag.

---

## Phase 10 — Polish

**Goal.** Make it feel like the design.

**Deliverables.**
- Card-deal & chip-fly animations (CSS first, fall back to a small library only if needed).
- Showdown opponent-card reveal (`CardFace` swap with flip-in).
- Reconnect UX: subtle banner + re-fetch state without flicker.
- Error states: "table full", "seat taken", "action timed out", "you've been disconnected".
- Visual regression suite (Playwright screenshots vs. `/design/exports/`) for the four layouts.
- Performance pass: bundle analysis (`vite-bundle-visualizer`), font preload, asset compression.
- A11y pass: keyboard focus rings on `ActionBar` buttons, `aria-live` for status changes.
- Telemetry hooks (optional): client-side log of fatal errors only.

**Folders affected.** App-wide.

**Must NOT do yet.** Mobile/responsive layout, internationalization, multi-table view, tournament UI.

**Dependencies.** Phases 1–9.

**Success criteria.**
- Visual diff with `/design/exports/` under threshold.
- No layout shift after first paint.
- Reconnect flow proven on a flaky-network harness.

**Risks.**
- Animation budget creep. Cap at 1 day per animation; defer fancier ones.

---

## Cross-cutting concerns

| Concern | Phase introduced | Note |
|---|---|---|
| CI (lint + typecheck + tests) | Phase 0 (lint/tc), Phase 5 (poker-core tests), Phase 9 (e2e) | GitHub Actions; matrix Node 20 only. |
| Logging | Phase 6 | Nest `Logger`; structured logs only on server. |
| Error tracking (Sentry) | Phase 10 (optional) | Skip in MVP. |
| Docker | Phase 8 | `docker-compose.yml` for Postgres + server. |
| Feature flags | not needed for MVP | Skip. |
| i18n | not in scope | Strings inline English. |
| Auth | Phase 6 (guest stub), Phase 8 (only if accounts needed) | MVP = guest nickname + room code. If/when needed: magic-link email + JWT in httpOnly cookie. No username/password. |
| Anti-cheat (RNG audit, etc.) | Phase 8+ | Document RNG source; out of scope for the build itself. |

---

## Recommended starting phase

**Start with Phase 0** — and the reason isn't ceremony.

The biggest risk in a monorepo with four cross-cutting workspaces (`apps/web`, `apps/server`, `packages/shared`, `packages/poker-core`) is *getting module resolution wrong* across `tsc`, Vite, Nest, and Vitest. Each tool has its own opinion on path aliases, ESM/CJS interop, and workspace symlinks. If we skip Phase 0 and dive into Phase 1, we'll re-do imports three times when the server and core packages arrive.

Phase 0 is small (probably ~half a day of work) and it pays off immediately:
- It locks `pnpm` + the four-workspace shape.
- It validates the dependency arrows from "Critical boundaries" before any real code exists, by importing a stub from each package into both apps and confirming `eslint-plugin-boundaries` / TS path aliases enforce the rules.
- It lets us run `pnpm dev:web` + `pnpm dev:server` side-by-side from day one.

After Phase 0, run Phases 1 and 2 in parallel — they don't depend on each other (UI port uses local mocks; shared types can be drafted from the design specs alone). Phase 3 starts the moment Phase 2's types are stable. Phases 4 and 5 should land together (write tests as you go). Phase 6 unblocks Phase 7; Phase 8 can begin overlapping Phase 7 once the in-memory protocol is stable.

No code yet. Tell me if you want any phase resized, reordered, cut, or split before we touch Phase 0.
