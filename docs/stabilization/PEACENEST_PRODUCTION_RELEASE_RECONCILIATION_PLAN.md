# PEACENEST production release reconciliation plan

**Plan only. Production deployment is not authorized by this document.** It responds to the read-only mixed-state evidence in [Wave 0 production truth](WAVE0_PRODUCTION_TRUTH.md).

## Candidate target

`TARGET_SOURCE_SHA=0e65d3be5fd033375471b347e2e25421aa4185c2`  
`TARGET_RELEASE_ID=TO_BE_GENERATED_FROM_MANIFEST_FOR_0e65d3be5fd033375471b347e2e25421aa4185c2`  
`TARGET_WEB_IMAGE=TO_BE_BUILT_FROM_0e65d3be5fd033375471b347e2e25421aa4185c2`  
`TARGET_API_IMAGE=TO_BE_BUILT_FROM_0e65d3be5fd033375471b347e2e25421aa4185c2`  
`TARGET_WORKER_IMAGE=TO_BE_BUILT_FROM_0e65d3be5fd033375471b347e2e25421aa4185c2`  
`TARGET_PAYMENT_DEMO_IMAGE=TO_BE_BUILT_FROM_0e65d3be5fd033375471b347e2e25421aa4185c2`

No target digest is invented. The approved build must publish immutable digest references and produce one signed/verified manifest containing the final `TARGET_COMPOSE_DIGEST`, `TARGET_CADDY_DIGEST`, `TARGET_MIGRATION_PROVENANCE`, and `TARGET_ENV_SCHEMA`.

## Preconditions

1. A human approves the exact source SHA, build provenance, immutable image digest set, and maintenance window.
2. Run backup evidence and restoration-readiness checks; record a timestamped database backup location without placing credentials in release records.
3. Verify disk capacity for one complete candidate plus one retained rollback release; verify DNS/host routing prerequisites.
4. Render per-service environment files from the approved secret authority, validate the schema/allowlists, and reject placeholders. Do not copy shared production environment files into a release artifact.
5. Confirm database migration compatibility from the candidate manifest. If incompatible with the rollback manifest, stop; do not deploy.

## Exact order of operations

1. Build and inspect the four candidate images; resolve each to an immutable digest.
2. Generate and verify the release manifest against the exact Compose, Caddy, environment schema, and migration set.
3. Materialize one immutable release directory and service environment directory; retain the previous complete manifest as `ROLLBACK_RELEASE`.
4. Run canonical deploy preflight and topology attestation against the existing runtime. Existing mixed state is expected to prevent an unattended cut-over until the approved reconciliation operator validates its authority boundary.
5. Start the complete candidate topology under the release directory, with one release ID/source SHA and digest-bound image variables. Never recreate individual production services manually.
6. Run migration/candidate health/canary checks, then atomically switch `/current` only after all checks pass.
7. Run post-deploy strict attestation: all governed services, `/current`, Compose/Caddy hashes, migration provenance, source revision, and image identities must match one manifest.
8. Observe public booking/readiness and operations canaries for the approved window. Expected downtime is the approved cut-over window only; this plan does not estimate a duration without a measured rehearsal.

## Rollback

Triggers: candidate health failure, failed strict attestation, failed canary, migration incompatibility, unexpected error rate, or any service not bound to the candidate manifest.

Rollback uses the governed command with the retained immutable `ROLLBACK_RELEASE` manifest; it restores the full release rather than individual services. It must re-run migration compatibility and strict post-rollback attestation. It must never resolve `latest`, guess image references, or reconstruct a release from memory.

## Required end state

One release ID; one source SHA; one image-digest set; one Compose and Caddy artifact; one environment schema; one `/current` pointer; one deploy command; and one rollback command. This removes staging ownership, API/worker/payment-demo revision drift, mutable application image resolution, shared `RELEASE_SHA` divergence, and manual per-service authority.

`PRODUCTION_RECONCILIATION_PLAN_READY=YES`  
`LIVE_PRODUCTION_RECONCILIATION=NOT_EXECUTED`
