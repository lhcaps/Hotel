# PeaceNest successor handoff

## Final status

| Field | Current handoff value |
| --- | --- |
| `FINAL_SOURCE_SHA` | Exact immutable SHA of the final committed `main` tree, recorded by `git rev-parse HEAD` in the final evidence. This file avoids a self-referential hash. |
| `FINAL_PRODUCTION_SHA` | The same immutable SHA after the one canonical governed production deployment; strict attestation must show equality. |
| `HANDOFF_STATUS` | `TECHNICAL_HANDOFF=PASS`; `CREDENTIAL_TRANSFER=PENDING_HUMAN` |
| Stable production before final cutover | `c7aa4f6daf0c911967a8c63731e0a8408cbd3e43` (historical starting point only) |
| Credential revocation | Not performed; pending independent successor verification |

The final evidence bundle is authoritative for the literal SHA, hosted CI run, release ID, runtime service revisions, public smoke, pricing inspection, workflow checks, archive hash, and clean-room results. No historical report or untracked overlay is current proof.

## What a successor receives

- The authoritative source is the committed `main` SHA named in the final evidence, not an untracked overlay or local release directory.
- Governed release and rollback tooling is in `scripts/release/`; the deployment contract is in `deploy/README.md`.
- Local development, migration, and verification guidance is in [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md).
- Security ownership and transfer controls are in [SECURITY_HANDOFF.md](SECURITY_HANDOFF.md) and [CREDENTIAL_TRANSFER_CHECKLIST.md](CREDENTIAL_TRANSFER_CHECKLIST.md).
- Historical root reports and read-only query evidence are preserved in [docs/archive/2026-08](archive/2026-08/).

## Required closure evidence

1. Exact final source SHA is pushed to `main`; hosted CI is successful for that exact SHA.
2. The canonical materialize, manifest, environment-render, dry-run, backup/restore, recovery-baseline, rollback, and deploy gates pass without changing the serving pointer until cutover.
3. Strict attestation and topology prove matching web, API, worker, and payment-demo revisions; public site, live, and ready endpoints return 200.
4. Read-only pricing inspection proves the published policy is healthy with four components, twelve prices, and universal pricing PASS. Housekeeping, admin-account, and customer booking checks are bounded and non-destructive.
5. A `git archive` of the final SHA is stored at `D:\PeaceNest-Handoff`, scanned with approved Gitleaks, and validated in a D: clean room.
6. Human owners independently verify every credential and console path. Until then the only permissible transfer status is `CREDENTIAL_TRANSFER=PENDING_HUMAN` and outgoing access remains intact.

## Non-negotiable boundaries

- Never run root-level `b0-*`, `check-*`, `deploy-*.sh`, archive contents, or other untracked helpers as release tooling.
- Never use direct production DDL, migration-history rewrites, invented prices, manual service restarts, broad Git staging, or real-payment probes.
- Never copy secret values into reports, source packages, terminal captures, or handoff material.
- Documentation and historical evidence do not replace exact-SHA runtime attestation.

## Completion rule

Technical handoff is complete only with fresh immutable source, CI, release, runtime, pricing, workflow, archive, and clean-room evidence. Credential transfer completes only after human acceptance; do not revoke outgoing access before that acceptance.
