# ADR-0002 - PostgreSQL lam transactional source of truth

**Status:** Accepted  
**Date:** 2026-07-21  
**Decision owners:** Product owner, Solution Architect

## Context

HOLD allocation, overlap prevention, coupon quota, payment confirmation va audit can relational integrity, concurrency control va atomic multi-entity updates.

## Decision

Su dung PostgreSQL lam transactional source of truth cho booking, inventory allocation, price snapshot, payment mapping, coupon reservation/redemption va audit. Luu timestamp UTC; ap dung business time o `Asia/Ho_Chi_Minh` tai boundary.

## Decision drivers

ACID transaction, relational constraint, query audit/reporting, chong overlap va co che locking phu hop.

## Considered alternatives

- Document database: tu chon do weak relational/concurrency fit cho inventory va coupon quota.
- Redis primary store: tu chon do cache/queue loss va persistence semantics khong du cho `INV-016`.

## Consequences

### Positive consequences

Co mot source of truth de tai tao state, reconciliation va audit.

### Negative consequences

Can thiet ke migration, index, transaction isolation va backup/restore ky luong o phase implementation.

## Risks

Contention allocation/coupon va slow query. Giam thieu bang query/index design, transaction ngan, observability va load test.

## Constraints

ADR nay khong dinh nghia bang, migration hay ORM schema.

## Revisit conditions

Chi danh gia alternative khi workload/availability requirement vuot kha nang postgres da do duoc.

## Related documents

[Business invariants](../../domain/business-invariants.md), [System context](../system-context.md), [Threat model](../../security/threat-model.md).
