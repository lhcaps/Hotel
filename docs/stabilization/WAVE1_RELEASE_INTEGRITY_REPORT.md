# Wave 1 release integrity report

## Outcome

## 2026-08-10 hosted CI closure

GitHub Actions run `31392757811` passed all mandatory gates for code checkpoint
`ab263a9852c79d7a1019ebba0a92d249d4b91087`: frozen install, format, lint,
typecheck, unit/catalog/auth/pricing/availability/quote checks, OpenAPI,
Drizzle check/test, high-severity dependency audit, Gitleaks, build, release
integrity, Storybook, web unit, and Playwright. The hosted E2E gate reported
**168 primary tests passed (8.5m)** plus **1 unavailable-state test passed**.

This is non-production evidence only. PR #10 remains draft and unmerged;
there was no deployment, production migration, public enablement, or
production reconciliation.

## 2026-08-10 local E2E and RM-504 closure update

The Playwright worker previously attempted to execute the raw TypeScript export of `@room/contracts`. The test runtime now has an explicit workspace dependency and ESM boundary, covered by `tests/e2e/contracts-runtime-resolution.spec.ts`. A separate SSR hydration guard prevents the guest OTP form from performing a native submission before React owns it under full-suite load.

Fresh local evidence: frozen install, format, lint, typecheck, unit, catalog, auth, pricing, availability, quotes, OpenAPI, DB check/test, high-severity dependency audit, redacted branch-scoped secret scan, build, release integrity, Storybook, web unit, full E2E, production-image runtime verification, and the A/B rollback rehearsal all passed. Full E2E: 168 primary tests plus 1 unavailable-state test, 0 failures. The same frozen-install full E2E run passed in an isolated clean worktree.

`RM504_STATUS=PASS`
`LOCAL_E2E=PASS`
`HOSTED_CI_AFTER_SECURITY_FIX=PASS_RUN_31392757811`
`PRODUCTION_RECONCILIATION_EXECUTED=NO`
`FINAL_APPROVED_RELEASE_SHA=NOT_APPROVED`

**TOOLING_READY=YES: canonical isolated Compose release validation.**
**PRODUCTION_RECONCILED=NO.** Production remains untouched and is demonstrably mixed.

Wave 1 adds immutable release manifests, migration provenance, service-specific environment validation, strict attestation/topology checks, explicit isolated deploy/rollback phases, and an executable A/B/rollback/mixed-state rehearsal.

## Delivered controls

| Area                 | Evidence                                                                                                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI repair            | pnpm is bootstrapped before cached Node setup; release-integrity test gate is part of CI.                                                                                                                                                                   |
| Manifest             | exact source/image/Compose/Caddy/migration/environment-schema identity; verification rejects tampering and mutable image manifests.                                                                                                                         |
| Environment safety   | per-service allowlists, placeholder rejection, and service environment rendering tests.                                                                                                                                                                     |
| Attestation/topology | governed services, pointer, release ID, ownership, image identity, Compose/Caddy, and migration evidence are checked; mixed and staging-owned fixtures fail.                                                                                                |
| Deploy/rollback      | fail-closed preflight verifies backup evidence, target disk, release-pointer truth, candidate uniqueness, resolved Compose topology, rollback compatibility, and service environments before isolated mutation; rollback restores a complete known release. |
| Canonical Compose    | application services require explicit image variables rather than implicit checkout builds.                                                                                                                                                                 |
| Rehearsal            | A deploy/attest, B deploy/attest, injected mixed rejection, B-to-A governed rollback, and restored-A attestation all pass.                                                                                                                                  |

Fresh `pnpm test:release-integrity` result: 24 passed, 0 failed. The rehearsal command also exited 0. Detailed evidence: [WAVE1_RELEASE_REHEARSAL.md](WAVE1_RELEASE_REHEARSAL.md).

## Hosted PR CI truth

The first hosted CI evidence for PR #10 is **FAIL**, not a release-candidate approval. GitHub Actions run `31331742723` (PR head `e75b2c23b9080cccf19e26c9de7e8e51f1354c0a`, base `88ece32a32fe8a7b669aaddbd57d914c8ba5834c`, merge-test SHA `63df6791c46a57590cfec0e361f5f9f8aee97935`) passed install, format, lint, and typecheck, then stopped at `pnpm test:unit`. The later required jobs were skipped and are not PASS evidence.

The root cause was Bash expansion of the unquoted contracts argument `dist/**` into `dist/src dist/test`; Vitest consumed `dist/src` as the exclude value and selected `dist/test` as a positional filter. Compiled tests then resolved repository-relative fixtures from `packages/contracts/dist/test` and failed. Contracts now uses `vitest run --dir test` (and the coverage equivalent), which positively scopes discovery to source tests. Its regression fails if a compiled `dist/test` copy executes.

```text
HOSTED_PR_CI=FAIL_BEFORE_CONTRACTS_DISCOVERY_FIX
PR_HEAD_SHA=e75b2c23b9080cccf19e26c9de7e8e51f1354c0a
PR_MERGE_TEST_SHA=63df6791c46a57590cfec0e361f5f9f8aee97935
BASE_SHA=88ece32a32fe8a7b669aaddbd57d914c8ba5834c
LOCAL_GATES=PASS_AFTER_CONTRACTS_DISCOVERY_FIX
DEPENDENCY_SECURITY_GATE=FAIL_KNOWN_6_HIGH_FINDINGS
```

### Hosted rerun 31333821505: database discovery failure

The contracts fix was exercised by hosted CI, but the next `pnpm test:unit`
failure was `@room/database:test:unit`. Its script used the same unquoted
`dist/**` pattern and, under the GitHub Linux Bash shell, expanded to
`dist/booking dist/database`. Vitest treated `dist/booking` as the exclusion
value and `dist/database` as a positional test filter, then executed compiled
database unit and integration artifacts.

Database unit tests now use `vitest run --dir test/unit` (and the coverage
equivalent). The added source-discovery regression fails if a compiled
`dist/database/test/unit` copy is selected. Both a clean source run and a
post-build run passed with 6 test files and 20 tests; no compiled database
test executed in either run.

The hosted unit workflow also now provides its disposable PostgreSQL service
URL to `pnpm test:unit`. This was verified locally with the same URL and a
full 16-task unit run exited successfully; it is required by the booking
unit cases that create guarded disposable test databases. No test was
skipped, removed, or reclassified to make that run pass.

### Hosted rerun 31334384885: auth discovery failure

This rerun passed install, format, lint, typecheck, the contracts source
suite (17 files, 269 tests), and the database source suite (6 files, 20
tests). Its unit failure was then `@room/auth:test:unit`: Bash-expanded
`dist/**` caused Vitest to execute `dist/test/bootstrap-credentials.test.js`,
which tried to read a source fixture relative to the compiled directory.

The same hosted log also proved compiled config and booking tests were being
selected. To make source discovery deterministic throughout this unit graph,
auth, config, booking, observability, API, and worker scripts now use positive
source directories (`--dir test`, with API's unit task also excluding its
integration subtree). API integration now positively targets
`--dir test/integration`. Post-build local tests passed for auth 5/23, config
1/89, booking 20/127, observability 1/1, API 75/421, and worker 16/91. A
further hosted rerun is required; all later steps of run 31334384885 were
skipped after the unit failure and are not passing evidence.

### Hosted rerun 31334811401: vertical API subprocess portability

The source-scoped unit gate passed in hosted CI. Catalog integration then ran
27 suites successfully before the vertical API smoke suite timed out. Its
subprocess used the bare `pnpm` executable name and a hard-coded Windows
working directory; GitHub's `pnpm/action-setup` exposes the actual executable
through `PNPM_HOME`, so the child could not be launched on Linux.

The vertical test now starts the API through its current Node runtime from its
actual package directory, with the guarded test database URL supplied as the
application database URL. It no longer relies on `pnpm --filter` or a relative
environment-file path. The test still starts the API and performs all eight
HTTP assertions. A hosted rerun is required; auth through E2E and the
dependency audit were skipped after this catalog failure and are not passing
evidence.

### Hosted rerun 31335450125: database integration discovery

This run passed install, formatting, lint, typecheck, units, catalog
integration (including the vertical API smoke test), auth, pricing,
availability, quotes, OpenAPI, and database schema validation. `pnpm db:test`
then selected compiled `dist/database/test/integration` artifacts as well as
the source suite because it still used the unquoted `dist/**` exclusion.

Database integration now uses `vitest run --dir test/integration`. The source
suite remains mandatory and will be exercised in the next hosted run. Audit,
secret scanning, build, release-integrity, Storybook, web unit, browser setup,
and E2E were skipped after this failure and are not passing evidence.

### Hosted rerun 31335752154: migration identity provenance

The database source integration suite reached its intended files, but two
identity assertions depended on commit objects `7698353` and `721f9d0` that
are no longer reachable in the hosted repository. The migration SQL itself
was not reported as changed; only those historical Git object lookups failed.

The assertions now verify the same migrations 0000 through 0008 against their
canonical Git blob IDs. This is clone-independent and remains fail-closed for
any byte change. Local database integration passed 25 files and 222 tests.
A final hosted rerun is required. Audit and all later gates of run 31335752154
were skipped after the provenance failure and are not passing evidence.

### Local post-fix verification

Format, lint, typecheck, the full 16-task unit suite, auth/catalog
integration, pricing, availability, quotes, OpenAPI, database schema check,
build, and the 22 release-integrity tests all passed. A local Gitleaks source
scan found no leaks. `pnpm audit --prod --audit-level=high --json` remains a
failing mandatory security gate with 6 high and 0 critical findings; it has
not been downgraded or bypassed.

## Fresh quality evidence

| Gate                           | Command                                                           | Exit | Result                                                 |
| ------------------------------ | ----------------------------------------------------------------- | ---: | ------------------------------------------------------ |
| Format                         | `pnpm format:check`                                               |    0 | PASS                                                   |
| Lint                           | `pnpm turbo lint --force`                                         |    0 | PASS; 10 package tasks, zero cache hits                |
| Typecheck                      | `pnpm turbo typecheck --force`                                    |    0 | PASS                                                   |
| Unit                           | `pnpm turbo test:unit --force --concurrency=1`                    |    0 | PASS; 16 package tasks                                 |
| Auth/RBAC and integration      | `pnpm test:integration`                                           |    0 | PASS; 23 auth + 9 API auth + 178 API integration tests |
| Pricing / availability / quote | `pnpm test:pricing`, `pnpm test:availability`, `pnpm test:quotes` |    0 | PASS; 30 / 5 / 3 tests                                 |
| OpenAPI / migration schema     | `pnpm check:openapi`, `pnpm db:check`                             |    0 | PASS                                                   |
| Release integrity              | `pnpm test:release-integrity`                                     |    0 | PASS; 22 tests                                         |
| Compose workload rehearsal     | `node scripts/release/rehearse-compose-workload.mjs`              |    0 | PASS; A/B, mixed rejection, restore, governed rollback |
| Build                          | `pnpm turbo build --force`                                        |    0 | PASS; 10 package tasks                                 |
| Dependency audit               | `pnpm audit --prod --audit-level=high --json`                     |    1 | FAIL_KNOWN_SECURITY_FINDINGS; 6 HIGH                   |
| Secret scan                    | redacted Gitleaks source scan                                     |    0 | PASS; 0 findings                                       |

The local database-required gates used the repository’s already-running local test stack, explicit non-production URLs, and a completed local `pnpm db:migrate`/`pnpm db:status` check. No production endpoint or data was used.

## Production truth and readiness

Fresh read-only evidence identifies multiple live authorities: staging Compose ownership for API/web/payment-demo/caddy/postgres, a worker revision different from the pointer release, older Redis ownership, and a shared release SHA that differs from `/current`. The live attestation is therefore expected to fail. See [WAVE0_PRODUCTION_TRUTH.md](WAVE0_PRODUCTION_TRUTH.md).

The reconciliation procedure is intentionally a plan, not an execution: [PEACENEST_PRODUCTION_RELEASE_RECONCILIATION_PLAN.md](PEACENEST_PRODUCTION_RELEASE_RECONCILIATION_PLAN.md). It requires human approval, a provenance build, backup evidence, and a production-specific approved maintenance window.

## Remaining gaps and blockers

1. Production reconciliation is not authorized and must not be inferred from local tests.
2. Dependency audit remains failed with six HIGH findings; see [DEPENDENCY_SECURITY_TRIAGE.md](DEPENDENCY_SECURITY_TRIAGE.md).
3. Branch-protection configuration is external to this repository and needs repository-administrator confirmation.

`CANONICAL_RELEASE_TOOLING_READY=YES`
`LIVE_PRODUCTION_RECONCILIATION=NOT_EXECUTED`  
`WAITING_FOR=HUMAN_REVIEW_OF_WAVE1_AND_EXPLICIT_PRODUCTION_RECONCILIATION_APPROVAL`
