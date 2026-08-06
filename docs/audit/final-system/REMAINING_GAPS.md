# Remaining gaps and closure conditions

## Must close before claiming final system closure

1. Correct the ROOM_STATUS_VIEWER permission/navigation contract. The final viewer surface must not expose property settings or unrelated catalog links, and the live API boundary must match the approved contract.
2. Repair the coupon E3 test ordering so legal PostgreSQL serialization outcomes are asserted without false ordering.
3. Update admin booking lifecycle fixtures with the immutable cancellation policy snapshot required by the current service.
4. Repair the Phase 8I payment-review fixture/assertion mismatch.
5. Make the reversed-date E2E test wait for hydrated form state, then rerun the full browser suite.
6. Re-run db:test and the full API catalog suite after fixture/test repair. Do not use the current partial counts as closure.
7. Resolve the pre-existing docs/integration formatting conflict and rerun format:check.

## External gates

| Gate                             | Status           | Missing proof                                                                |
| -------------------------------- | ---------------- | ---------------------------------------------------------------------------- |
| Google OAuth live customer flow  | BLOCKED_EXTERNAL | Authorized live provider completion and fresh customer-session evidence      |
| Live SMTP                        | BLOCKED_EXTERNAL | Authorized recipient and delivery evidence                                   |
| MoMo sandbox                     | BLOCKED_EXTERNAL | Current sandbox credentials, callback reachability, and provider-side result |
| VNPAY sandbox                    | BLOCKED_EXTERNAL | Current sandbox credentials, callback reachability, and provider-side result |
| Public HTTPS callback acceptance | BLOCKED_EXTERNAL | External callback delivery and signature evidence                            |

## Explicitly not started

Operations V3 redesign, public-overhaul work, unrelated UI redesign, production inventory reimport, production DDL, and production payment/booking mutation acceptance were not started. They remain NOT_IMPLEMENTED or NOT_SAFE_FOR_PRODUCTION_EXECUTION, not failed implementation claims.

## FUTURE_APPROVED_CHANGE_REQUESTS

The following are future-scope requests and are not current-release defects or closure gates:

- housekeeping task assignment;
- expanded departments;
- T-30 access issuance;
- multi-property support;
- pricing optimizer;
- simplified room types;
- removal of standalone menu pages.

## Readiness decision

READY_FOR_OPERATIONS_V3_DESIGN_REVIEW: NO.

The current release may remain operationally live under normal monitoring, but the audit closure is PARTIAL until the open P2 items and required external gates are addressed or formally waived by the responsible owner.
