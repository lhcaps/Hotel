# Wave 1 release integrity report

## Outcome

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

Fresh `pnpm test:release-integrity` result: 22 passed, 0 failed. The rehearsal command also exited 0. Detailed evidence: [WAVE1_RELEASE_REHEARSAL.md](WAVE1_RELEASE_REHEARSAL.md).

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
