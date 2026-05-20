# ADR 0001: Monorepo foundations

**Status:** Accepted  
**Date:** 2026-05-20  
**Phase:** 0

## Context

NEONPOKER needs a four-workspace monorepo (`apps/web`, `apps/server`, `packages/shared`, `packages/poker-core`) where TypeScript, Vite, NestJS, and Vitest agree on module resolution and package boundaries before game or UI work begins.

## Decision

1. **pnpm workspaces** for package management (`apps/*`, `packages/*`).
2. **Four workspaces** with strict dependency arrows (documented in `docs/architecture.md`).
3. **Package-level imports only** — `@neonpoker/shared`, `@neonpoker/poker-core`; no deep `src/` imports (ESLint enforced).
4. **Per-app TypeScript module settings:**
   - `apps/web`: `module: ESNext`, `moduleResolution: Bundler`
   - `apps/server`: `module: CommonJS`, `moduleResolution: Node`
   - `packages/*`: CommonJS emit to `dist/` for Node consumers
5. **ESLint flat config** at repo root with `no-restricted-imports` overrides per workspace.
6. **`/design` remains read-only handoff** — not part of the production build graph.

## Consequences

- Server dev requires `pnpm build:packages` (or `dev:server` which runs it) before Nest can resolve workspace packages at runtime.
- Web can alias `@neonpoker/shared` to TypeScript source during early phases.
- Phase 1+ plugs into this tree without restructuring imports.

## Alternatives considered

- **npm/yarn workspaces** — rejected; pnpm locked in phased plan.
- **Single global `moduleResolution: Bundler`** — rejected; causes Nest/Vitest friction.
- **Turborepo/Nx** — deferred; not needed for Phase 0 scope.
