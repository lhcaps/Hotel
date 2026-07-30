# Phase 3 validation record

Phase 3 has local evidence for API unit tests, disposable-PostgreSQL catalog integrations,
authenticated browser workflows, Storybook, and component accessibility. The browser suite uses the
guarded Playwright ADMIN bootstrap account; it never places a token in a URL or local storage.

## Executable gates

Run the following with Node `v24.18.0`, pnpm `10.33.2`, and the local infrastructure running where
required:

1. `pnpm test:auth` runs the `@room/auth` unit suite plus actor-context, permission-guard,
   session, and Fastify auth-bridge tests.
2. `pnpm test:catalog` runs only the real PostgreSQL catalog integration suite.
3. `pnpm test:integration` runs the preceding auth and catalog targets in sequence.
4. `pnpm storybook:build` builds the reusable catalog-table story.
5. `pnpm --filter @room/web test:unit` includes axe checks for the catalog table and its labelled
   archive action.
6. `pnpm test:e2e` generates an in-memory-only ADMIN password for the child process, then exercises
   ADMIN login, catalog persistence, maintenance creation/cancellation,
   and authenticated page navigation against real web/API/PostgreSQL processes.

The PostgreSQL integrations prove Property/Price Tier audit rollback and duplicate handling;
Room Type/Amenity archive/assignment; Room duplicate/archive/list; and Maintenance overlap,
touching intervals, cancellation release, and audit rollback. The expanded Playwright coverage
proves catalog archive controls and date-range maintenance input in the Admin workspace.

## Remaining release evidence

The Gitleaks container image completed a read-only scan of all 44 commits with no findings. Its
only historical false-positive password was removed from current test source and is allowlisted by
its exact historic commit and path. The Playwright ADMIN password and Better Auth secret
are generated at test-process startup, passed through child-process environment only, and have no
committed fallback. Tracing is disabled for the authenticated suite so it cannot persist the
generated password. ADMIN MFA remains a documented before-production requirement.

## Dependency advisory classification — reviewed 2026-07-22

| Advisory              | Dependency path                                                                                      | Severity / exposure                                                                                               | Decision                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GHSA-67mh-4wv8-2f99` | `@room/database > drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild@0.18.20` | Moderate; development migration tooling only. The project does not start the affected esbuild development server. | No compatible direct upgrade is available without changing the Drizzle Kit toolchain. Keep it monitored and re-evaluate on the next Drizzle upgrade. |
| `GHSA-g7r4-m6w7-qqqr` | `vitest > vite > esbuild@0.27.7`                                                                     | Low; local Windows test tooling only. The project does not run esbuild's `servedir` mode.                         | Keep it monitored until Vitest upgrades its Vite/esbuild edge. No production runtime path is affected.                                               |

The fresh audit contains no high or critical advisory. The CI policy fails high/critical production
findings through `pnpm audit:deps`; these documented development-tooling findings are reviewed rather
than silently suppressed.
