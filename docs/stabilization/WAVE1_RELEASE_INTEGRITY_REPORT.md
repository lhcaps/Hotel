# Wave 1 release integrity report

## Outcome

**TOOLING_READY=PARTIAL: isolated governed-release validation only.**  
**PRODUCTION_RECONCILED=NO.** Production remains untouched and is demonstrably mixed.

Wave 1 adds immutable release manifests, migration provenance, service-specific environment validation, strict attestation/topology checks, explicit isolated deploy/rollback phases, and an executable A/B/rollback/mixed-state rehearsal.

## Delivered controls

| Area                 | Evidence                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CI repair            | pnpm is bootstrapped before cached Node setup; release-integrity test gate is part of CI.                                                                    |
| Manifest             | exact source/image/Compose/Caddy/migration/environment-schema identity; verification rejects tampering and mutable image manifests.                          |
| Environment safety   | per-service allowlists, placeholder rejection, and service environment rendering tests.                                                                      |
| Attestation/topology | governed services, pointer, release ID, ownership, image identity, Compose/Caddy, and migration evidence are checked; mixed and staging-owned fixtures fail. |
| Deploy/rollback      | fail-closed preflight and phase evidence on an isolated target; rollback restores a complete known release.                                                  |
| Canonical Compose    | application services require explicit image variables rather than implicit checkout builds.                                                                  |
| Rehearsal            | A deploy/attest, B deploy/attest, injected mixed rejection, B-to-A governed rollback, and restored-A attestation all pass.                                   |

Fresh `pnpm test:release-integrity` result: 22 passed, 0 failed. The rehearsal command also exited 0. Detailed evidence: [WAVE1_RELEASE_REHEARSAL.md](WAVE1_RELEASE_REHEARSAL.md).

## Fresh quality evidence

| Gate                           | Command                                                           | Exit | Result                                                 |
| ------------------------------ | ----------------------------------------------------------------- | ---: | ------------------------------------------------------ |
| Format                         | `pnpm format:check`                                               |    0 | PASS                                                   |
| Lint                           | `pnpm lint`                                                       |    0 | PASS                                                   |
| Typecheck                      | `pnpm turbo typecheck --force`                                    |    0 | PASS                                                   |
| Unit                           | `pnpm turbo test:unit --force --concurrency=1`                    |    0 | PASS; 16 package tasks                                 |
| Auth/RBAC and integration      | `pnpm test:integration`                                           |    0 | PASS; 23 auth + 9 API auth + 178 API integration tests |
| Pricing / availability / quote | `pnpm test:pricing`, `pnpm test:availability`, `pnpm test:quotes` |    0 | PASS; 30 / 5 / 3 tests                                 |
| OpenAPI / migration schema     | `pnpm check:openapi`, `pnpm db:check`                             |    0 | PASS                                                   |
| Release integrity              | `pnpm test:release-integrity`                                     |    0 | PASS; 22 tests                                         |
| Build                          | `pnpm turbo build --force`                                        |    0 | PASS; 10 package tasks                                 |
| Dependency audit               | `pnpm audit --prod --audit-level=high --json`                     |    1 | FAIL_KNOWN_SECURITY_FINDINGS; 6 HIGH                   |
| Secret scan                    | redacted Gitleaks source scan                                     |    0 | PASS; 0 findings                                       |

The local database-required gates used the repository’s already-running local test stack, explicit non-production URLs, and a completed local `pnpm db:migrate`/`pnpm db:status` check. No production endpoint or data was used.

## Production truth and readiness

Fresh read-only evidence identifies multiple live authorities: staging Compose ownership for API/web/payment-demo/caddy/postgres, a worker revision different from the pointer release, older Redis ownership, and a shared release SHA that differs from `/current`. The live attestation is therefore expected to fail. See [WAVE0_PRODUCTION_TRUTH.md](WAVE0_PRODUCTION_TRUTH.md).

The reconciliation procedure is intentionally a plan, not an execution: [PEACENEST_PRODUCTION_RELEASE_RECONCILIATION_PLAN.md](PEACENEST_PRODUCTION_RELEASE_RECONCILIATION_PLAN.md). It requires human approval, a provenance build, backup evidence, and a production-specific approved maintenance window.

## Remaining gaps and blockers

1. Docker-backed workload rehearsal remains a hardening follow-up. The current executable rehearsal operates the isolated release artifact/state adapter, not a production-like database/application Compose workload.
2. Production reconciliation is not authorized and must not be inferred from local tests.
3. Dependency audit remains failed with six HIGH findings; see [DEPENDENCY_SECURITY_TRIAGE.md](DEPENDENCY_SECURITY_TRIAGE.md).
4. Branch-protection configuration is external to this repository and needs repository-administrator confirmation.

`CANONICAL_RELEASE_TOOLING_READY=PARTIAL_ISOLATED_TARGET_ONLY`  
`LIVE_PRODUCTION_RECONCILIATION=NOT_EXECUTED`  
`WAITING_FOR=HUMAN_REVIEW_OF_WAVE1_AND_EXPLICIT_PRODUCTION_RECONCILIATION_APPROVAL`
