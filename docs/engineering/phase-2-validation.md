# Phase 2 validation and rollout limits

## Required local/CI gate

```powershell
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm infra:up
pnpm db:check
pnpm db:test
pnpm test:e2e
pnpm audit --audit-level=high
```

Use Node 24 and pnpm 10. `db:check` verifies static Drizzle history; `db:test` proves the schema and custom PostgreSQL invariants on disposable guarded databases; Playwright runs only afterwards. Neither CI nor this sequence seeds or migrates a production/persistent environment.

## Dependency advisory classification (reviewed 2026-07-21)

| Advisory                                                   | Classification and action                                                                                                                                                                                                         | Owner / next review                                           |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `GHSA-qx2v-qp2m-jg93` / `CVE-2026-41305`, PostCSS moderate | Remediated through the root pnpm override `next@16.2.10>postcss: 8.5.21`, scoped to Next's vulnerable transitive edge. Unrelated consumers keep their declared resolution ranges.                                                 | Engineering platform owner; verify on each dependency update. |
| `GHSA-67mh-4wv8-2f99`, esbuild moderate (`0.18.20`)        | Development-only transitive dependency of `drizzle-kit` through `@esbuild-kit/*`. No broad override: compatibility has not been demonstrated. The affected development server is not exposed beyond the local developer machine.  | Engineering platform owner; review by 2026-08-21.             |
| `GHSA-g7r4-m6w7-qqqr`, esbuild low (`0.27.7`)              | Development-only transitive dependency of Vitest/Vite, Windows `servedir` scenario. No broad override: compatibility has not been demonstrated. Run development tooling on loopback only; do not expose it to untrusted networks. | Engineering platform owner; review by 2026-08-21.             |

The audit gate must have zero high or critical findings. The two esbuild exceptions are recorded, not suppressed: their local-only restriction, owner, and review date must be re-evaluated when Drizzle Kit, Vitest, Vite, or tsx changes.

## Rollout limits

This phase establishes local/CI database evidence, not a production launch. Before a production rollout, assign an operator and change window, verify PostgreSQL extension/privileges and backup restore, assess locks against the target dataset, establish monitoring/alerting, and approve PII, archive/delete, and payment-module policies. Redis remains non-authoritative throughout.
