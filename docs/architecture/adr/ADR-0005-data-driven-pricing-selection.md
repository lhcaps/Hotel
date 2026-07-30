# ADR-0005 - Data-Driven Pricing Selection

**Status:** Accepted
**Date:** 2026-07-26
**Decision owners:** Product owner, Solution Architect

## Context

Phase 0 hardcoded pricing thresholds (`11*60`, `15*60`, `18*60`, `>240`,
`>300`, `>960`) inside `apps/api/src/pricing/pricing-engine.ts`. ADMIN
could change tier prices through the existing `RatePlanManager`, but
**could not** change the time windows, duration thresholds, or rule
precedence without editing source code, modifying seed scripts, or
restoring a hardcoded branch in code. Phase 7B removes that asymmetry:
the same ADMIN surface must own every business rule governing which
base combo is selected, while amounts continue to live in PostgreSQL
already.

## Decision

Extend the existing `rate_plans` table with selection-rule fields
(`is_base_plan`, `min_check_in_minute_inclusive`,
`max_check_in_minute_exclusive`, `min_duration_minutes_inclusive`,
`max_duration_minutes_inclusive`) and replace the hardcoded `if/else`
chain in `calculatePricing` with a **pure rule matcher** that reads the
immutable `PricingCatalog` derived from PostgreSQL rows. One rate plan
owns exactly one current selection configuration in Phase 7B; no
generic rules table, no DSL, no separate selection-rule tables.

Pricing-grid invariants (15-minute input grid, Asia/Ho_Chi_Minh
timezone, integer VND, immutable quote snapshots, EXTRA_HOUR line
items) are enforced both in PostgreSQL `CHECK` constraints and inside
the pure matcher. ADMIN updates are validated by a **complete
finite-grid rule-set validator** before commit (96 check-in minutes ×
93 duration steps), preventing coverage gaps or equal-priority
ambiguity from leaking into PostgreSQL. Concurrent ADMIN updates
serialize through a `SELECT FOR UPDATE` on the rate-plan rule set so
two conflicting edits cannot both commit.

The existing snapshot contract accepts both
`phase-4-pricing-availability-v1` and `phase-7b-data-driven-pricing-v1`
through a union `PricingRuleVersion` literal. Existing quotes remain
immutable; new quotes use the Phase 7B version.

## Decision drivers

- ADMIN operability of every business rule governing pricing.
- Removal of every runtime hardcoded threshold.
- Continuation of immutable quote snapshots and the Phase 4 version
  schema for historical data.
- Backward compatibility with the existing API contract and the
  in-flight Phase 6 coupon pipeline.
- Forward-only migration discipline, no destructive down migrations,
  no rewrite of historical quote snapshots.

## Considered alternatives

- **Generic rules platform**: multiple rule tables, expression
  strings, dynamic predicates. Rejected — concrete current source
  evidence does not demand it. One rate plan owns one current
  selection configuration in Phase 7B; adding a platform now would be
  speculative, multiply audit surface, and conflict with the
  anti-overengineering guard.
- **Move thresholds to environment variables**: rejected. Pricing
  business configuration belongs in PostgreSQL so changes survive
  restarts, persist across deployments, audit naturally, and require
  ADMIN RBAC. `.env` is for deployment-time secrets.
- **Run the matcher on every public quote**: rejected. The full-grid
  validator runs at ADMIN update/activation time only; the public
  matcher runs once per quote.
- **Distributed locks or Redis authority**: rejected. A single
  PostgreSQL row-level lock inside the transaction is sufficient and
  aligns with the repository's accepted concurrency convention.

## Consequences

### Positive consequences

- Every business rule governing pricing is owned by the existing
  ADMIN surface; no SQL editing, no restart, no rule hidden in code.
- Public Web continues to call the same endpoints and never computes
  authoritative totals.
- Existing quotes and HOLDs stay immutable; Phase 4 snapshots remain
  readable.
- Configuration is committed through a transactional gate so the
  active rule set in PostgreSQL never enters a coverage-gap or
  ambiguous state.

### Negative consequences

- The pure matcher is more code than the old `if/else` chain, but
  the test matrix is finite and the test suite covers every reachable
  boundary.
- The full-grid validator costs more work at ADMIN update/activation
  time; the grid is 96×93 and bounded by database validation, so the
  cost is acceptable.
- `rate_plans` carries four new nullable columns. The columns are
  guarded by CHECK constraints so the new shape cannot regress.

## Boundary interpretation

Public timestamps accept **15-minute increments only**. Reachable
runtime boundaries are:

| Dimension    | Reachable values                            |
|--------------|--------------------------------------------:|
| Check-in     | 10:45, 11:00, 14:45, 15:00, 15:15, 17:45, 18:00 |
| Duration     | 1h00, 2h45, 3h00, 3h15, 4h00, 4h15, 5h00, 5h15, 16h00, 16h15, 24h00 |

Outcomes:

| Case                                  | Selected plan              | Extra units |
|---------------------------------------|----------------------------|------------:|
| 4h00 exact                            | THREE_HOUR_COMBO           | 1           |
| 4h15                                  | FIVE_HOUR_COMBO            | 0           |
| 5h00                                  | FIVE_HOUR_COMBO            | 0           |
| 5h15 before 18:00                     | FIVE_HOUR_COMBO            | 1           |
| 18:00 exactly with 5h00               | FIVE_HOUR_COMBO            | 0           |
| 18:00 with 5h15                       | NIGHT_COMBO                | 1           |
| 16h00                                 | not DAY_COMBO              | n/a         |
| 16h15                                 | DAY_COMBO                  | 0           |
| 24h00                                 | DAY_COMBO                  | 0           |
| 24h15                                 | InvalidPricingIntervalError | n/a        |

A "human description" like "14:59" means "before 15:00 under the
15-minute contract" — not a valid public timestamp.

## Migration identity

| Phase                                  | Schema version                    | Migration                                       |
|----------------------------------------|-----------------------------------|-------------------------------------------------|
| Phase 6 (Coupon core)                  | phase-6-coupon-core-v3            | 0010_phase6_coupon_reference_closure            |
| **Phase 7B (data-driven pricing)**     | **phase-7b-data-driven-pricing-v1** | **0011_phase7b_data_driven_pricing**             |

The migration is additive only. Migrations `0000`–`0010` remain
byte-identical. No down migration is shipped. Existing quote
snapshots are not re-priced.
