# NEONPOKER — Architecture

## Overview

NEONPOKER is a desktop-only (1920×1080) neon cyberpunk Texas Hold'em poker application. The codebase is a **pnpm monorepo** with two apps and two shared packages.

## Repository structure

```
/
├── apps/
│   ├── web/          # React + Vite client (renders GameState, emits intents)
│   └── server/       # NestJS authoritative backend
├── packages/
│   ├── shared/       # Contracts, types, socket event names (Phase 2+)
│   └── poker-core/   # Pure TypeScript poker rules (Phase 3+)
├── design/           # Design handoff only — reference, not production code
└── docs/             # Engineering documentation
```

## Critical boundaries

| Rule | Detail |
|------|--------|
| React renders `GameState` | React never computes game state, winners, pots, blinds, or legal actions |
| Rules live in `poker-core` | No imports from `apps/*` into core |
| Server is authoritative | Client sends intents; server resolves with `poker-core` |
| `shared` is the contract | Both apps depend on it; it depends on nothing |
| `/design` is handoff only | Do not ship `tweaks-panel.jsx` or design-helper pages |

### Allowed dependency arrows

```
apps/web        → packages/shared
apps/server     → packages/shared, packages/poker-core
packages/poker-core → packages/shared
packages/shared → (nothing)
```

### Forbidden

- `apps/web` → `apps/server`, `packages/poker-core`
- `apps/server` → `apps/web`
- `packages/shared` → apps or `poker-core`
- `packages/poker-core` → apps, React, NestJS, Socket.IO, Prisma, DOM

Enforced via ESLint `no-restricted-imports` and `import/no-internal-modules` (no deep imports into package `src/`).

## TypeScript / module strategy (Phase 0)

| Workspace | `module` | `moduleResolution` | Notes |
|-----------|----------|-------------------|--------|
| `apps/web` | ESNext | Bundler | Vite resolves `@neonpoker/shared` via alias to source |
| `apps/server` | CommonJS | Node | NestJS default; workspace packages built to `dist/` |
| `packages/*` | CommonJS | Node | Emit `dist/` for Node consumers; typecheck-only in dev for web |

Path aliases in `tsconfig.base.json` point at package entry barrels only. Public API is each package's `src/index.ts`.

## Phase 0 scope (current)

- Monorepo bootstrap with stub packages
- `GET /health` → `{ status: "ok" }`
- Web placeholder: "NEONPOKER Web"
- No Socket.IO, Prisma, game logic, or design port

## What comes next

| Phase | Focus |
|-------|--------|
| **1** | Static frontend UI port from `/design` (mock data only) |
| **2** | Shared contracts (`GameState`, socket events, zod DTOs) |
| **3–5** | `poker-core` domain, rules engine, unit tests |
| **6–7** | Server game loop + frontend socket integration |
| **8+** | PostgreSQL/Prisma, e2e, polish |

Poker rules are implemented in `packages/poker-core`, not in React.

### Phase 4D1 — Side pot accounting (`poker-core`)

Side-pot math splits chip flows into **contested pots** vs **true uncalled tails**:

- **Contested slices** (`calculateSidePotBreakdown().contestedSidePots`): layered from matched `totalCommitted` thresholds; each slice lists **non-folded** eligible seats only.
- **Uncalled / unmatched excess** (`returnableUncalledBySeatIndex` on breakdown and optionally `pots.returnableUncalled` after `syncPotsFromCommitments`): inferred only in **heads-up chip geometry** — when **at most two players** have `totalCommitted > 0`. Then the deeper stack’s tail above the shorter (`max − shorter`) is modeled as returnable (excluding blind-only HU posting). With three or more contributors (even if only one player remains eligible), staggered stacks are expressed purely via contested layering plus dead-money audit fields — never as silent refunds carved out by a misleading global `max − second`.
- **Dead money from folded-only layers**: if a contribution tier has **contributors but zero eligible survivors**, those chips are **not** modeled as refunds to anyone; they accumulate and merge into the **last contested** slice with an explicit audit counter **`deadMoneyMergedIntoLastContestedPot`** so the merge is visible (distinct from uncalled refunds).

If action sequencing is correct, uncalled tails should usually already live in stack semantics elsewhere; this breakdown still guarantees **`Σ contested + Σ returnable === Σ totalCommitted`** on the snapshot.

## Design handoff

`/design` contains HTML/CSS/JSX reference files, assets, exports, and spec docs (`design/docs/`). Phase 1 copies tokens and components into `apps/web`; the `/design` folder itself stays unchanged as reference.
