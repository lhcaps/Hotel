# Operations runbook

## Scope and authority

This runbook describes the repository's governed release path. It does not authorize production access, a production change window, new credentials, direct DDL, or a rollback. The assigned production operator must supply approved, non-secret evidence locations and stop on any failed preflight.

## Go / no-go conditions

Before a production transition, all of the following must be current and tied to the exact candidate source SHA:

- source SHA and CI evidence;
- release materialization, manifest generation, and manifest verification;
- current-pointer and service-revision truth;
- recovery baseline, backup evidence, and a restore rehearsal against a disposable target;
- migration provenance and rollback strategy;
- production approval evidence, environment-schema validation, and a successful tracked dry run;
- pricing-policy validation or a recorded decision not to publish; and
- a reviewed execution window, on-call owner, alert owner, and rollback decision owner.

If any condition fails, do not switch `current`, restart a service manually, edit production data, or improvise a repair. Record the named failed gate and preserve the existing serving release.

## Governed release procedure

1. Start from a clean committed candidate SHA. Use `scripts/release/materialize-release-from-git.mjs`; never package the checkout, untracked files, or a local build overlay.
2. Generate and verify the release manifest with `scripts/release/generate-release-manifest.mjs` and `scripts/release/verify-release-manifest.mjs`.
3. Capture recovery truth with `scripts/release/capture-recovery-baseline.mjs` and retain the approved backup/restore-rehearsal and rollback-strategy evidence.
4. Render service environments from the protected external configuration source with `scripts/release/render-service-environments.mjs`. Validate names and schemas only; do not print values.
5. Run `scripts/release/deploy-release.mjs --dry-run` using the approved target parameters and evidence files. A dry run is not a release.
6. With explicit release approval, use the same tracked deploy command for the atomic transition. It is responsible for candidate verification, the controlled `current` pointer change, and recovery on failure.
7. Require `scripts/release/attest-release.mjs`, `scripts/release/check-release-topology.mjs --strict`, `scripts/deploy/verify-public-assets.mjs`, and the approved health/public smoke suite. Record only redacted identifiers and PASS/FAIL results.

## Pricing-policy control

Pricing is server-authorized and uses the V3 draft/preview/validation/publication lifecycle. Inspect first. A policy may be published only when complete, price-valid, gap-free, non-overlapping, and preview-equivalent for the property basis. A failed validation is a P0 operational blocker: leave the existing state in place and document the exact missing proof. Do not seed, infer, or alter price rows with SQL.

## Incident and rollback decision

- During preflight: stop and retain the current serving release.
- After a failed candidate verification or attestation: allow the canonical release tooling to recover to its verified pointer; collect redacted logs and evidence.
- For an approved rollback: use `scripts/release/rollback-release.mjs` and its production approval/evidence requirements. Do not flip pointers, rebuild images, or restart services by hand.
- For data or migration defects: halt and create a reviewed forward fix. Released migration history is immutable.

## Evidence retention

Store redacted, immutable evidence outside the source checkout where access policy permits: candidate SHA, release ID, manifest digest, timestamps, current-pointer proof, backup/restore proof, dry-run result, attestation, topology, smoke, pricing decision, and rollback decision. Historical documents may be archived with supersession metadata but never rewritten to look current.
