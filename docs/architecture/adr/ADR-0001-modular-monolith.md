# ADR-0001 - Modular monolith

**Status:** Accepted  
**Date:** 2026-07-21  
**Decision owners:** Product owner, Solution Architect

## Context

MVP la mot property, mot shared API va mot background worker; luong booking-payment can transactionally phoi hop inventory, gia, coupon va audit.

## Decision

Chon modular monolith: mot NestJS API co module ro rang `Identity`, `Authorization`, `Property`, `Room Catalog`, `Availability`, `Pricing`, `Booking`, `Coupon`, `Payment`, `Check-in/Check-out`, `Notification`, `Translation`, `Reporting`, `Audit`. Worker la runtime boundary tach biet cho async work, khong la microservice domain.

## Decision drivers

YAGNI, transaction consistency, don gian deploy/observability, toc do MVP va ranh gioi domain ro rang.

## Considered alternatives

- Microservices: tu chon do distributed transaction, deployment, observability va operational overhead vuot MVP.
- Single undifferentiated module: tu chon do accidental coupling va kho test authorization/domain guards.

## Consequences

### Positive consequences

Code va DB transaction gan nhau; module API co contracts ro; co the test end-to-end booking lifecycle trong mot deployment.

### Negative consequences

Can ky luat dependency direction va ownership de tranh module truy cap truc tiep internals cua nhau.

## Risks

Accidental coupling, shared database misuse va worker retry side effect. Giam thieu bang module boundary, transaction facade, outbox va idempotency.

## Constraints

Khong microservices/Kubernetes MVP. Redis khong authoritative.

## Revisit conditions

Tach module chi khi co independently scalable workload, ownership team doc lap, stable contract va du lieu/transaction boundary da duoc chung minh.

## Related documents

[Container diagram](../container-diagram.md), [Booking state machine](../../domain/booking-state-machine.md), [ADR-0004](ADR-0004-payment-adapter.md).
