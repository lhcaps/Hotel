# ADR-0006 - Payment-core settlement authority

**Status:** Accepted
**Date:** 2026-07-26

## Decision

The Phase 7C payment core is the only component allowed to transition a booking from `HOLD` to `CONFIRMED`. A provider adapter may create checkout data and verify a provider callback, but it supplies only a `VerifiedPaymentProviderEvent` to the core. The core owns transaction locks, amount and currency checks, coupon redemption, inventory preservation, audit/outbox writes, late-success review and duplicate handling.

Phase 7D's MoMo adapter uses this boundary. A timeout or malformed post-dispatch response marks the stable payment attempt `REVIEW_REQUIRED` with `MOMO_INITIATION_OUTCOME_UNKNOWN`; it does not mint a new provider order. A later verified success for that order may clear the provisional review state and settle through the same core.

## Consequences

- Browser returns are read-only and never settle a payment.
- Signed IPN verification, canonicalization and digesting remain provider-specific.
- Raw provider bodies, signatures and merchant credentials are not persisted.
- A new provider must reuse the core rather than reimplement booking or coupon transitions.
