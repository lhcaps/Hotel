# Phase 8A — Performance & Capacity Baseline

## 1. SLO / Capacity Targets

**No approved SLOs were located.** `OBSERVABILITY_POLICY.md`, `RELEASE_CHECKLIST.md`, and the product docs do not define p50/p95/p99 latency targets, error-rate budgets, throughput targets, or DB pool utilisation targets.

**Verdict: `CAPACITY_TARGETS = BUSINESS_OR_OPERATIONS_DECISION_REQUIRED`.** The audit does not invent thresholds.

## 2. EXPLAIN Plans (representative)

All EXPLAIN plans captured on the disposable dev DB (`room_management`, 2 properties, 6 rooms, 6 rate plans, 0 bookings/payments).

### 2.1 Property lookup

```
EXPLAIN (ANALYZE, BUFFERS) SELECT id, name FROM properties;
→ Seq Scan on properties (cost=0.00..15.10 rows=510 width=48) (actual time=0.010..0.010 rows=2.00 loops=1)
  Buffers: shared hit=1
Planning Time: 0.287 ms
Execution Time: 0.029 ms
```

### 2.2 Active rate plans for a property

```
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, code, status, included_duration_minutes, priority
FROM rate_plans
WHERE property_id = (SELECT id FROM properties LIMIT 1) AND status = 'ACTIVE'
ORDER BY priority DESC;
→ Sort  (cost=8.20..8.20 rows=1 width=60) (actual time=0.050..0.050 rows=1.00 loops=1)
    Sort Key: rate_plans.priority DESC
    Buffers: shared hit=5 read=1
  InitPlan 1
    → Limit (cost=0.00..0.03 rows=1 width=16) (actual time=0.010..0.010 rows=1.00 loops=1)
        Buffers: shared hit=1
      → Seq Scan on properties (cost=0.00..15.10 rows=510 width=16) (actual time=0.009..0.009 rows=1.00 loops=1)
  → Index Scan using rate_plans_active_property_code_idx on rate_plans
       (cost=0.14..8.16 rows=1 width=60) (actual time=0.030..0.030 rows=1.00 loops=1)
       Index Cond: (property_id = (InitPlan 1).col1)
       Buffers: shared hit=2 read=1
Planning Time: 2.956 ms
Execution Time: 0.073 ms
```

**Observation:** the partial index `rate_plans_active_property_code_idx` is being used. Sort is in-memory and trivial (1 row). Query is well-indexed.

## 3. Throughput / Latency Baseline (disposable)

The audit did not run a full load test in Phase 8A. The vitest unit suite runs the **pricing oracle** exhaustively (8 928 scenarios) and completes in ~2.3 s on a single Node thread, which provides a useful micro-benchmark:

| Operation                                 | Time (single thread)                |
| ----------------------------------------- | ----------------------------------- |
| `calculatePricing` over 8 928 scenarios   | ~1.2 s                              |
| `auditEnumerate` over 8 928 scenarios     | ~1.0 s                              |
| `applyVerifiedPaymentEvent` (single call) | ~3–10 ms in the concurrency fixture |

These are **NOT** production targets; they are observation points on disposable infrastructure.

## 4. Resource Utilisation

| Resource          | Observation this audit                             |
| ----------------- | -------------------------------------------------- |
| DB pool           | Default `pg` pool; not stress-tested in this audit |
| Worker throughput | Not measured                                       |
| Outbox lag        | Not measured                                       |
| Memory            | Not measured                                       |
| CPU               | Not measured                                       |

## 5. Audit Findings

| ID              | Finding                                                       | Severity                                 |
| --------------- | ------------------------------------------------------------- | ---------------------------------------- |
| PERFORMANCE-001 | No load test in regression baseline; no soak test.            | P2                                       |
| CAPACITY-001    | No approved SLOs; no approved capacity targets.               | BUSINESS_OR_OPERATIONS_DECISION_REQUIRED |
| CAPACITY-002    | No documented upper-bound on simultaneous HOLDs per property. | P2                                       |

## 6. Headline Verdict

| Verdict              | Status                                   |
| -------------------- | ---------------------------------------- |
| PERFORMANCE_BASELINE | VERIFIED_WITH_LIMITATION                 |
| CAPACITY_TARGETS     | BUSINESS_OR_OPERATIONS_DECISION_REQUIRED |
