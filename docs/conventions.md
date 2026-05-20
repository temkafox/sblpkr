# NEONPOKER — Conventions

## Naming

| Item | Convention | Example |
|------|------------|---------|
| Directories | kebab-case | `apps/web`, `packages/poker-core` |
| React components | PascalCase | `PlayerSeat`, `ActionBar` |
| Types / interfaces | PascalCase | `GameState`, `HealthStatus` |
| Type-only files | `*.types.ts` | `game-state.types.ts` (Phase 2+) |
| Tests | colocated `__tests__/` or `*.spec.ts` | `health.controller.spec.ts` |
| Package scope | `@neonpoker/*` | `@neonpoker/shared` |

## Imports

- **Always** use package-level imports: `@neonpoker/shared`, `@neonpoker/poker-core`
- **Never** deep-import: `@neonpoker/poker-core/src/engine/foo` (lint blocks this)
- Web may import `@neonpoker/shared` only
- Server may import `@neonpoker/shared` and `@neonpoker/poker-core`

## Scripts (root)

| Script | Purpose |
|--------|---------|
| `pnpm dev:web` | Vite dev server (port 5173) |
| `pnpm dev:server` | Build workspace packages, then NestJS (port 3000) |
| `pnpm typecheck` | Typecheck all workspaces |
| `pnpm lint` | ESLint all workspaces |
| `pnpm test` | Vitest in all workspaces |
| `pnpm build:packages` | Compile `shared` + `poker-core` to `dist/` |

## Tooling

- **Package manager:** pnpm (workspaces in `pnpm-workspace.yaml`)
- **First install (pnpm 11+):** if install reports `ERR_PNPM_IGNORED_BUILDS`, run `pnpm approve-builds --all` once (allows `@nestjs/core` and `esbuild` postinstall scripts listed in `pnpm-workspace.yaml`)
- **Node:** 20 LTS (see `.nvmrc`)
- **Formatter:** Prettier (root `.prettierrc`)
- **Linter:** ESLint flat config (`eslint.config.mjs`)

## Phase 0 decisions

1. **pnpm workspaces** — `apps/*` and `packages/*`
2. **Per-app TypeScript overrides** — Vite uses Bundler resolution; Nest uses CommonJS/Node
3. **Packages emit CJS `dist/`** — required for Nest runtime resolution via `node_modules`
4. **Web aliases to package source** — faster iteration until shared stabilizes in Phase 2
5. **`/design` untouched** — reference handoff; production code lives under `apps/` and `packages/`

## Out of scope (Phase 0)

- Real UI port (Phase 1)
- Poker rules (Phase 3+)
- Socket.IO, PostgreSQL, Prisma
- Mobile / responsive layouts
- Shipping `tweaks-panel.jsx` or design-kit pages
