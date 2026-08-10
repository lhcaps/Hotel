# Wave 0 and Wave 1 Release Integrity Design

## Purpose

Wave 0 records fresh production truth without mutating production. Wave 1 creates the release-integrity foundation for PeaceNest: deterministic CI, one immutable release identity, governed full-stack deployment and rollback, full-service runtime attestation, and least-privilege environment distribution.

This design implements RM-501, RM-101, RM-102, and RM-103 only. It does not change booking, pricing, multi-night, OTP, payment reconciliation, frontend booking flows, database lifecycle constraints, email/outbox behavior, monitoring, backups, or public feature flags.

## Safety Boundary

- Production access is read-only: SSH inspection, filesystem metadata reads, `docker ps`, `docker inspect`, safe GET/HEAD health checks, and read-only database queries.
- No production deploy, recreate, restart, rollback, migration, environment edit, secret rotation, symlink change, feature-flag change, database write, or customer communication is permitted.
- Local implementation and rehearsal use the isolated branch `codex/stabilize-release-integrity` in `D:\Study\Project\Room Management-wave1-release-integrity`.
- The original checkout and its untracked forensic artifacts remain unchanged.
- Production-impacting command paths are fail-closed, dry-run by default, and require an explicit target plus typed confirmation for any future authorized mutation.

## Fresh Evidence Baseline

The 2026-08-10 read-only snapshot found multiple live release authorities:

- `/opt/room-management/current` points to release `4fb79a023209c349cff5c74caec626556459ae67`.
- Shared `RELEASE_SHA` is `41c915c67caa211db44e419a9cc40c62cd8f6764`.
- Web, API, payment-demo, and the completed migrate container report revision `4fb79a023209c349cff5c74caec626556459ae67`.
- Worker reports revision `88ece32a32fe8a7b669aaddbd57d914c8ba5834c`.
- Redis Compose ownership points to release `9bf5c211...`.
- App image references include mutable or implicit tags.
- Several services are owned by a staging Compose working directory.
- The live API reports catalog, internal multi-night, and public multi-night enabled while production remediation is disabled.

The current hosted CI run for source SHA `88ece32a32fe8a7b669aaddbd57d914c8ba5834c` fails in `actions/setup-node@v4` because pnpm caching is requested before a pnpm executable exists. The `main` branch is not protected.

These facts are evidence for the Wave 0 report and reconciliation plan. They are not authorization to repair production.

## Chosen Architecture

The repository will gain one focused Node ESM release-integrity kernel under `scripts/release/`. This follows the existing `scripts/deploy/` convention and avoids both a second package ecosystem and further expansion of scattered one-off scripts.

The kernel has pure, independently testable policy modules and thin command-line adapters:

- canonical JSON and SHA-256 hashing;
- manifest generation and verification;
- migration-set derivation from the existing immutable provenance manifest;
- environment-schema and per-service allowlist validation;
- Compose topology validation;
- runtime snapshot normalization and attestation;
- deploy and rollback preflight planning;
- release-directory and current-pointer state transitions;
- command execution behind an injectable adapter;
- structured evidence output that never includes environment values.

The production adapter uses filesystem and Docker commands. Tests use real temporary files and a deterministic in-process runtime adapter for failure injection. A Docker-backed isolated rehearsal exercises the same CLI boundary when local Docker prerequisites are available. An unavailable required rehearsal prerequisite produces a blocked Wave 1 result rather than a simulated pass.

## Immutable Release Identity

The machine-readable manifest is stored as `release-manifest.json` and validated by `deploy/release-manifest.schema.json`. It contains at least:

- `schemaVersion`;
- `releaseId`;
- `sourceSha`;
- `createdAt`;
- immutable repository and `sha256:` digest pairs for web, API, worker, and payment-demo;
- SHA-256 digests for `docker-compose.production.yml` and `deploy/Caddyfile`;
- latest migration name, aggregate migration digest, and explicit rollback-compatible migration-set digests;
- environment-schema digest.

`releaseId` is `sha256:<64 lowercase hexadecimal characters>`. It is computed over recursively key-sorted, whitespace-free UTF-8 JSON containing the identity-bearing fields. `releaseId` and `createdAt` are excluded from that input so repeated generation from identical release inputs returns the same identifier.

Image resolution is always `<repository>@sha256:<digest>`. A missing digest, mutable-only reference, or `:latest` repository fails verification. `createdAt` is informational and cannot change release identity.

The Compose and Caddy digests are hashes of the exact bytes shipped in the release directory. Verification recomputes both hashes from the release artifacts.

## Migration Identity and Compatibility

The existing `packages/database/drizzle/migration-provenance.json` remains the migration authority. Release generation:

1. reads its entries in index order;
2. verifies each recorded SHA-256 against the corresponding SQL file;
3. verifies the journal tags and latest migration agree with the provenance list;
4. hashes canonical JSON containing each index, filename, and verified digest;
5. records the latest filename and aggregate digest in the release manifest.

No released migration is rewritten. A migration change without a matching provenance entry fails manifest generation and verification.

Rollback is automatically compatible when current and target migration aggregate digests are equal. A current release with a different migration set must explicitly list the target aggregate digest in its immutable `rollbackCompatibleWith` data. Missing compatibility evidence rejects rollback. This supports forward-only database changes without guessing that a schema downgrade is safe.

## Environment Schema and Secret Distribution

`deploy/environment-schema.json` becomes the versioned, value-free inventory of production configuration keys. Each entry records:

- classification: `PUBLIC_CONFIG`, `NON_SECRET_SERVICE_CONFIG`, or `SECRET`;
- required consumers;
- optional consumers when justified;
- whether the key is mandatory for each deployment class;
- safe validation constraints that do not expose its value.

The source code, production environment template, Compose file, API configuration, worker configuration, web configuration, and payment-demo configuration are inspected to derive the exact keys. Tests fail if a source-required production key is absent from the registry or if the template contains an unclassified key.

The canonical Compose model uses service-specific environment files for web, API, worker, payment-demo, Caddy, Postgres, and Redis. A generator selects only allowed keys from a source environment and writes files with restrictive permissions. It reports key names and counts, never values.

Negative tests enforce at least these boundaries:

- web cannot receive database or SMTP passwords;
- Caddy cannot receive auth, session, SMTP, database, or payment-control secrets;
- payment-demo cannot receive unrelated database, SMTP, auth, or administrative credentials;
- worker cannot receive browser-only public configuration;
- Postgres receives only its database bootstrap keys and non-secret release metadata;
- Redis receives only keys justified by its runtime configuration.

Production validation rejects empty critical secrets, `.invalid` endpoints, forbidden loopback endpoints, invalid public origins, wildcard production CORS, known development defaults, missing immutable release identity, and demo payment authority when the declared deployment class is real production. This validation does not redesign provider configuration.

## Canonical Release Layout

The governed layout is:

```text
/opt/room-management/
  shared/
    env/
    evidence/
    backups/
  releases/
    <releaseId>/
      release-manifest.json
      docker-compose.production.yml
      deploy/
  current -> releases/<releaseId>
```

Canonical services are Caddy, web, payment-demo, API, worker, Postgres, and Redis. The migration service is a governed one-shot job whose completed result is recorded in deployment evidence. No canonical service may be owned by `staging/<sha>`.

Released directories are immutable. Preparation occurs in a sibling temporary directory and completes with an atomic rename only after artifact verification. The current pointer changes atomically only after complete candidate startup, readiness, pre-switch attestation, and canary checks pass.

## Canonical Deploy State Machine

The single deploy command is dry-run by default. Preflight completes before mutation and verifies:

1. the candidate release directory and manifest;
2. exact file hashes and immutable images;
3. the previous release manifest and rollback candidate;
4. the environment schema and required key presence;
5. backup evidence supplied by the existing backup process;
6. migration identity and rollback compatibility;
7. current full-service production attestation;
8. free disk space;
9. declared DNS and host prerequisites;
10. canonical topology and absence of staging ownership.

A future explicitly authorized execution prepares the immutable release directory, records backup evidence, applies only compatible forward migrations, recreates the complete canonical service set, waits for readiness, attests the candidate, runs canaries, atomically switches `current`, performs final full attestation, and writes an evidence artifact.

Failure before the pointer switch leaves the previous pointer authoritative and cleans up only candidate resources created by that invocation. Failure after pointer-switch initiation invokes a verified atomic restoration to the known previous pointer and records the failed outcome. Unknown ownership or partial state stops automatically for human review.

## Canonical Rollback State Machine

The single rollback command accepts a previous `RELEASE_ID` and is dry-run by default. It verifies the target manifest, all immutable images, exact Compose and Caddy bytes, environment compatibility, database rollback compatibility, current release identity, complete service topology, and sufficient host prerequisites.

Rollback always restores a complete manifest. It never resolves mutable tags, guesses a release, mixes services, rewrites migrations, or silently downgrades an incompatible schema. The transition uses the same health, attestation, canary, atomic-pointer, and evidence rules as deployment.

## Full-Service Release Attestation

Attestation reads a sanitized runtime snapshot created from Docker inspection and release-directory metadata. It covers Caddy, web, payment-demo, API, worker, Postgres, Redis, and migration-job evidence.

For each service it reports expected immutable identity, actual image ID or repo digest, source/release label, Compose project, working directory, config file, state, and match result. It also reports Compose digest, Caddy digest, current-pointer match, shared release identifier match, required-service presence, and staging ownership.

Any missing service, mixed label, mixed app-image set, mutable app reference, staging owner, pointer mismatch, shared-release mismatch, file hash mismatch, or unexpected service causes `RELEASE_ATTESTATION=FAIL`. Output contains no environment values.

## CI Repair and Release Gates

The hosted workflow order becomes:

1. checkout;
2. install exact pnpm `10.33.2` with `pnpm/action-setup`;
3. set up Node 24 and pnpm cache;
4. frozen dependency install;
5. format check;
6. lint;
7. typecheck;
8. unit tests;
9. integration and auth/RBAC tests;
10. pricing, availability, and quote tests;
11. OpenAPI and contract checks;
12. migration and schema checks;
13. production dependency audit;
14. secret scan;
15. build;
16. manifest, environment, topology, deploy, rollback, attestation, and rehearsal gates.

Mandatory gates do not use `continue-on-error`, `allow_failure`, or success-forcing shell constructs. Dependency vulnerabilities remain a visible blocking result and are documented for RM-504 instead of being upgraded opportunistically in this branch.

Because `main` is currently unprotected, the deliverables include exact required status-check and review settings. Branch protection is reported as pending human administration unless the authenticated account can configure it and the user separately authorizes that repository mutation.

## Testing Strategy

All release-policy behavior follows red-green-refactor TDD. Tests use hand-derived fixtures and assert observable command results, exit codes, files, pointer state, and evidence rather than source text.

Required manifest cases cover a valid manifest, malformed source SHA, changed Compose, changed Caddy, missing service, mutable image, migration change, environment-schema change, and tampering.

Deploy and rollback tests cover missing images, tampered manifest, wrong Compose digest, service startup failure, health failure, interruption, pointer-switch failure, mixed images, unknown current release, missing rollback manifest, and database compatibility rejection.

Secret tests cover registry completeness, each per-service allowlist, forbidden cross-service secrets, invalid production sentinels, loopback/public-origin restrictions, development defaults, deployment-class payment authority, and non-disclosure of values.

Topology and attestation tests cover every canonical service and ensure each mismatch independently produces failure.

The isolated rehearsal proves release A deploy and attestation, release B deploy and attestation, rollback to A and attestation, and mixed-image rejection. Fresh final gates record each command, exit code, pass count, and fail count. A timed-out, skipped, unavailable, or independently failing gate is not reported as pass.

## Operational Script Governance

All tracked and untracked release/deploy scripts are inventoried without changing the forensic originals. Each is classified as `TRACKED_SAFE`, `TRACKED_UNSAFE`, `UNTRACKED_FORENSIC`, `STALE`, `LOCAL_ONLY`, or `PRODUCTION_CRITICAL_UNVERSIONED` in `docs/audit/WAVE1_CURRENT_RELEASE_PIPELINE.md`.

Only reusable safe behavior is reimplemented in the governed tooling. Promoted commands provide help, default dry-run, explicit target, production confirmation, no machine-specific host or key path, no hardcoded container identity, no secret output, no direct SQL lifecycle mutation, exit-on-error, and postcondition verification.

## Evidence and Deliverables

The implementation produces:

- `docs/audit/WAVE1_CURRENT_RELEASE_PIPELINE.md`;
- `docs/stabilization/WAVE0_PRODUCTION_TRUTH.md`;
- `docs/stabilization/WAVE1_RELEASE_INTEGRITY_REPORT.md`;
- `docs/stabilization/PEACENEST_PRODUCTION_RELEASE_RECONCILIATION_PLAN.md`;
- `docs/stabilization/DEPENDENCY_SECURITY_TRIAGE.md`;
- `WAVE1_SUMMARY.txt`;
- manifest schema, example, generator, verifier, attestation, topology, deploy, rollback, environment, and rehearsal implementation and tests.

Commits remain small and reviewable: CI bootstrap, manifest core, attestation/topology, deploy/rollback, environment allowlists and hardening, rehearsal, and evidence documentation. The branch may be pushed and a non-deploying draft pull request opened after all local verification, without changing production.

## Completion Rule

Wave 1 is `READY_FOR_RECONCILIATION_REVIEW` only when every required implementation mechanism and isolated rehearsal passes with fresh evidence and no production mutation. Known high dependency vulnerabilities may remain an explicit RM-504 blocker and must be reported as failing dependency audit evidence. Any other missing or failing required mechanism makes Wave 1 `BLOCKED`.

Work stops after Wave 0 and Wave 1 with `WAITING_FOR=HUMAN_REVIEW_AND_APPROVAL_OF_PRODUCTION_RELEASE_RECONCILIATION`.
