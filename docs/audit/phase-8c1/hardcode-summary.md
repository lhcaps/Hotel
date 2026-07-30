# Phase 8C.1 Hardcode Audit

Scope: production source and Phase 8C additions were reviewed separately from fixtures, generated OpenAPI, snapshots, and deterministic seeds.

## Result

- `HARMFUL_HARDCODE_P0=0`
- `HARMFUL_HARDCODE_P1=0`
- One P1 release-validation defect was found and fixed: the demo smoke test treated Mailpit's capped 50-message list as an unbounded counter. It now verifies a booking-specific OTP email for the actual hold contact.

## Classification totals

| Classification | Count |
| --- | ---: |
| APPROVED_DOMAIN_INVARIANT | 3 |
| TEST_OR_SEED_ONLY | 2 |
| VALIDATED_SERVER_CONFIGURATION | 1 |
| DATABASE_CATALOG_DATA | 1 |
| DUPLICATED_POLICY | 1 |
| SECRET_OR_SECURITY_RISK | 1 |
| HARMFUL_HARDCODE | 1 fixed |

## Extensibility assessment

Provider credentials, provider URLs, provider timeout values, feature flags, currency and timezone pass through typed configuration. Rate-plan codes in browser setup are deterministic catalog fixtures rather than production selectors. Reconciliation retry/lease values are explicit domain policy and covered by reconciliation tests.

P2: demo lunch-slot calculation is duplicated from test fixture behavior. Consolidate only in a later tooling-focused phase; it is not a production capability boundary.
