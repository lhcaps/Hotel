# Untracked worktree inventory

Snapshot date: 2026-08-16
Branch: `main`
Committed baseline: `b1a9e2c60b1592e18646ec44e4cee6e1aea4e88a`

The release-tool fix was subsequently committed as local candidate `3c1b954147fcebc1dce83abebfe2e505e5abb632`; this inventory remains a snapshot of the untracked paths and decisions at capture time.

This is a classification snapshot, not permission to delete or stage anything. The checkout contains user-owned historical, forensic, generated, and potentially semantic work. Release material must be derived from an exact committed SHA and must exclude every untracked path.

## Counts at snapshot

The snapshot contained 2,085 untracked paths and one tracked README edit. This report was added immediately afterward, so the current worktree should contain 2,086 untracked paths; the table records the pre-report snapshot.

| Bucket                                                        | Count before this report | Decision                                                                                                                           |
| ------------------------------------------------------------- | -----------------------: | ---------------------------------------------------------------------------------------------------------------------------------- |
| Handoff documentation additions                               |                        7 | Preserve; review as source documentation.                                                                                          |
| BMAD generated assets (`.agents/`, `_bmad/`, `_bmad-output/`) |                      269 | Preserve for the local Codex/BMAD setup; do not package or commit without an explicit project decision.                            |
| Historical release candidate (`.release-candidate-b42ab08a/`) |                    1,584 | Preserve for forensic review; never execute or stage as current source.                                                            |
| Standalone archives and exported bundles                      |                        4 | Preserve until an owner decides retention; never use as a release source.                                                          |
| Known semantic candidates                                     |                        5 | Preserve and require owner review before any edit, staging, or execution.                                                          |
| Root and deploy scratch/forensic helpers                      |                      185 | Preserve for now; never execute. Remove only after each exact target is proven generated or failed scratch and the owner approves. |
| Unreviewed candidates listed below                            |                       31 | Preserve; do not classify as generated and do not add ignore rules.                                                                |

The counts are mutually exclusive and sum to 2,085. The tracked README change is separate and is intentionally retained.

## Known semantic candidates

- `0030_b0_bootstrap_template.sql`
- `0030_b0_production_bootstrap.sql`
- `docs/customer-v2/CUSTOMER_ROUTE_MATRIX.md`
- `tests/e2e/operations-v3-admin-responsive-a11y.spec.ts`
- `tests/e2e/stage3-auth-integration.spec.ts`

These files may encode real design, migration, or acceptance work. They are not release inputs until reviewed and committed through the normal process.

## Unreviewed candidates retained verbatim

The following paths do not fit a safe generated/scratch rule. They remain preserved and excluded from releases pending owner classification:

- `Caddyfile-correct`
- `Caddyfile-fixed`
- `audit-confirmation-backlog.sql`
- `audit-otp-backlog.sql`
- `baseline-home.txt`
- `compute-email-digest.js`
- `compute-source-fingerprint.sql`
- `execute-stage2-bootstrap-production.sh`
- `execute-stage2-bootstrap.sh`
- `get-admin-user.sql`
- `get-all-bootstrap-prices.sql`
- `get-plans-for-bootstrap.sql`
- `get-property-details.sql`
- `get-property-for-bootstrap.sql`
- `get-test-property-room.sql`
- `get-v1-bootstrap-source.sql`
- `get-v4-prices.sql`
- `initiate-payment-huyle.js`
- `investigate-extra-rooms.sql`
- `list-rate-plans.sql`
- `list-tables.sql`
- `otp-request-huyle.js`
- `otp-verify-huyle.js`
- `package-release.sh`
- `pre-deploy-audit.sql`
- `prod-verify-v1.sql`
- `rebuild-correct-sha.sh`
- `rebuild-fixed.sh`
- `reconstruct-policy.sql`
- `restart-services.sh`
- `v1-acceptance.sh`

## Git and release policy

- No broad staging, `.gitignore` expansion, deletion, or archival was performed.
- Do not run root `b0-*`, `check-*`, `deploy-*.sh`, `verify-*`, stage/repro/bootstrap helpers, or any path in this inventory as production tooling.
- When a candidate is approved for source, review it, move it through an exact-path change, run the relevant gates, and commit it before release materialization.
- When a candidate is proven disposable, validate its absolute path and owner decision separately before using a recoverable removal method. This snapshot does not authorize removal.
