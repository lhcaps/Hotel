# ADR-0004 - Payment Adapter cho MoMo va VNPAY

**Status:** Accepted  
**Date:** 2026-07-21  
**Decision owners:** Product owner, Solution Architect

## Context

MVP yeu cau MoMo va VNPAY, nhung provider co payload, signature, redirect va retry semantics khac nhau. Booking inventory khong duoc phu thuoc vao browser return URL.

## Decision

Dat provider sau mot payment adapter common contract logical: create payment order, build redirect, verify callback/IPN, normalize outcome, identify idempotency event va truy xuat reconciliation data. Adapter provider-specific so huu signature verification va mapping; Booking service chi nhan normalized verified result.

## Decision drivers

Provider isolation, return URL vs webhook separation, idempotency, amount/order validation, testability va reconciliation.

## Considered alternatives

- Provider logic trong Booking module: tu chon vi coupling va kho test/reconcile.
- Trust browser return: tu chon vi forged return URL va khong co provider authority.

## Consequences

### Positive consequences

MoMo/VNPAY dung cung payment lifecycle; implementation co the fake adapter trong test va them provider sau ma khong doi Booking state machine.

### Negative consequences

Can duy tri provider-specific integration spec, secrets va test signature.

## Risks

Webhook replay, mismatch, late success, provider outage. Control: HTTPS, signature/merchant/order/amount verification, idempotency, REVIEW_REQUIRED va reconciliation.

## Constraints

Full payment only; no cash/manual transfer/deposit; no automated refund. Email chi gui qua outbox sau transaction commit.

## Revisit conditions

Them refund adapter/lifecycle chi khi stakeholder phe duyet refund policy va phase moi duoc lap.

## Related documents

[Booking state machine](../../domain/booking-state-machine.md), [User journeys](../../product/user-journeys.md), [Threat model](../../security/threat-model.md).

## Phase 7C implementation boundary

Phase 7C implements the provider-independent adapter contract and persisted payment core only. It deliberately includes no MoMo/VNPAY SDK or adapter, merchant credential, webhook ingress, checkout/return route or UI, provider selection, or ADMIN configuration screen. The core accepts only an adapter-marked verified normalized event and never trusts browser return state.

Any future merchant secret must be injected through environment configuration or a secret manager. It must not be persisted in the database, audit payloads, or logs. No provider secret configuration is introduced in this phase.

## Phase 7D MoMo sandbox contract

Phase 7D locks one contract only: MoMo One-Time Payment `captureWallet`, accessed from the official documentation on 2026-07-26. Sandbox initiation uses `POST https://test-payment.momo.vn/v2/gateway/api/create`, HMAC-SHA256, and the documented field order; request IDs reuse the stable provider-order identity. The response signature is verified before a successful redirect is accepted. IPN is JSON, signed over documented logical fields, acknowledged with HTTP 204, and normalized into the Phase 7C event core. The return URL is explicitly non-authoritative.

Configuration is server-only (`MOMO_*`), disabled by default, and fails closed when enabled but incomplete. Production rejects sandbox endpoints, loopback callbacks and placeholders. Phase 7D adds no VNPAY support, payment UI, ADMIN credential UI, production credentials or production readiness.

The intended sequence is 7D MoMo sandbox adapter, 7E VNPAY adapter, 7F client selection plus ADMIN non-secret operations, then 7G reconciliation/operations.
