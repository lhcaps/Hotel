# Phase 7C payment core handoff

## Delivered boundary

Phase 7C persists a provider-independent payment aggregate (`payments`), attempts and a deduplicated provider-event ledger. A normalized event may settle a valid HOLD atomically with coupon redemption, booking confirmation, audit and outbox insertion. It instead records `REVIEW_REQUIRED` for late success, state/inventory/coupon release, transaction conflict, amount or currency mismatch. Failed provider outcomes leave the HOLD intact for a later attempt. Zero-final-amount bookings use a separate server-authoritative idempotent no-charge path.

The authoritative lock order is booking -> payment -> payment attempt -> inventory block -> coupon application. Browser returns never settle a booking. Event persistence stores an event digest and reconciliation identifiers, never raw webhook body or credentials.

## Explicitly not delivered

At Phase 7C close there was no MoMo/VNPAY adapter or SDK, credential, webhook/return endpoint, checkout route/UI, provider selection, ADMIN configuration UI, reconciliation dashboard or fake `TEST` provider. Phase 7D subsequently adds the narrow MoMo sandbox boundary; this historical handoff remains the core-only baseline.

Future merchant secrets must be supplied only by environment variables or a secret manager and must never be stored in the database or written to logs/audit payloads. This phase introduces no such secret configuration.

## Next phases

1. **7D:** MoMo sandbox adapter with verified IPN ingress.
2. **7E:** VNPAY adapter.
3. **7F:** client provider selection and ADMIN non-secret operations.
4. **7G:** reconciliation and operational workflow.

Before exposing a provider, keep provider signature verification in its adapter, map it to the core normalized event, and prove duplicate/late/mismatch behavior against the shared settlement tests.
