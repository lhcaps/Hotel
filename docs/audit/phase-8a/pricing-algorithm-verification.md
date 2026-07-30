# Phase 8A — Pricing Algorithm Verification

## 1. Independent Oracle (audit-only)

**Location:** `apps/api/test/audit-phase8a/audit-independent-oracle.ts`

The oracle:

- Imports **only TypeScript types** from `selection-rule-matcher.ts`. It does **not** import any runtime symbol from the matcher, the pricing-engine wrapper, or any production plan-selection helper.
- Re-implements the four-window eligibility predicate from first principles.
- Re-implements the integer VND extra-hour rounding formula from first principles.
- Enumerates **every eligible base plan** and computes its total.
- Returns the minimum total, all ties, and a flag indicating whether the production selector would agree with the cheapest candidate.

The structural-distinctness property is asserted at test level by `audit-independent-enumeration.test.ts` (placeholder; in practice enforced by code review and by the fact that the oracle's loop and priority semantics differ from production).

## 2. Exhaustive Time-Domain Verification

**Test:** `apps/api/test/audit-phase8a/audit-exhaustive-verification.test.ts`

**Grid:** 96 check-in minute-slots × 93 valid duration steps = **8 928 scenarios per date** for the locked Phase 7B catalog fingerprint.

**Catalog fingerprint (locked):**

- THREE_HOUR_COMBO: priority 10, included 180 min, dur window [60, 240], any check-in window.
- FIVE_HOUR_COMBO: priority 70, included 300 min, dur window [255, 960].
- LUNCH_COMBO: priority 80, included 180 min, dur window [60, 960], check-in [660, 900).
- NIGHT_COMBO: priority 90, included 600 min, dur window [240, 1440], check-in [1080, 1440).
- DAY_COMBO: priority 100, included 960 min, dur window [240, 1440], check-in [0, 1440).
- EXTRA_HOUR: 100 000 VND per unit.

**Result (locked catalog):**

| Metric                                       | Value               |
| -------------------------------------------- | ------------------- |
| Total scenarios                              | 8 928               |
| Production resolved                          | 8 928               |
| Production exceptions                        | 0                   |
| Oracle resolved                              | 8 928               |
| Oracle no-match                              | 0                   |
| Production matches oracle's minimum          | **6 896 (77.24 %)** |
| **Production differs from oracle's minimum** | **2 032 (22.76 %)** |

**Conclusion:** the locked catalog fingerprint contains 2 032 scenarios where the production selector charges strictly more than the cheapest valid combination.

**Artifacts:**

- `docs/audit/phase-8a/artifacts/pricing-exhaustive-summary.json`
- `docs/audit/phase-8a/artifacts/pricing-counterexamples.json` (first 50 representative mismatches)
- `docs/audit/phase-8a/artifacts/pricing-boundary-matrix.csv` (machine-readable)

## 3. Property-Based Random Testing

**Test:** `apps/api/test/audit-phase8a/audit-property-random.test.ts`

**Seed:** `8008008` (deterministic).
**Case accounting:** 2,000 generated and executed cases; 1,999 compared cases; 1 rejected case. The rejected case is retained in `pricing-property-random.json` with its attempt, input and exact production/oracle error. The denominator 1,999 therefore refers only to compared cases; it is not the generated-case count.

**Result:**

| Metric                                               | Value                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Total cases                                          | 2 000                                                                                                   |
| Resolved by both production and oracle               | 1 999                                                                                                   |
| Production exceptions                                | 1                                                                                                       |
| **Production differs from oracle's minimum**         | **234 (11.7 %)**                                                                                        |
| **Production strictly higher than oracle's minimum** | **234 (100 % of mismatches; i.e. when production differs, it is always more expensive, never cheaper)** |

**Conclusion:** the random-property test independently confirms the exhaustive finding: production never picks a more expensive option when a cheaper one exists, but production **does** pick a more expensive option in ~12 % of randomly shaped configurations.

**Artifact:** `docs/audit/phase-8a/artifacts/pricing-property-random.json` (first 200 records).

## 4. Algorithm Invariants (Audit Findings)

| Invariant                                             | Result                       | Evidence                                                                                                                                                                                                         |
| ----------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic output for identical input              | **VERIFIED**                 | Pricing engine is pure; given identical catalog and input it returns identical `totalAmountVnd` and `selectedPlanCode`. Verified by re-running unit tests.                                                       |
| No floating-point money                               | **VERIFIED**                 | All prices are stored as `bigint` in DB (`rate_plan_prices.price_vnd bigint NOT NULL`) and as `number` (with `Number.isSafeInteger` guard) in code. `extraUnits = Math.ceil(...)` operates on integer minutes.   |
| Total never negative                                  | **VERIFIED**                 | Pricing engine rejects `duration < minDurationInclusive` with a structured error before computing totals. `extraUnits = Math.max(0, ...)` ensures non-negative extras.                                           |
| Discount never exceeds gross                          | **VERIFIED**                 | Coupon application enforces `discount_vnd ≤ final_amount_vnd`; verified in `packages/booking/test/payment/payment-settlement.test.ts`.                                                                           |
| Final amount equals gross minus discount              | **VERIFIED**                 | Coupon application logic; verified by unit test.                                                                                                                                                                 |
| Quote snapshot does not change after pricing edits    | **VERIFIED_WITH_LIMITATION** | Quote `price_snapshot` is written once at quote creation; no update path is exposed. Immutability is by code path; no DB trigger prevents UPDATE. See gap-register PRICING-005 P3.                               |
| Invalid / missing required price fails closed         | **VERIFIED**                 | `audit-phase8a/audit-exhaustive-verification.test.ts` "rejects a misconfigured catalog with a missing base-plan price" + `pricing-engine.test.ts` fail-closed cases.                                             |
| Inactive plan is never selected                       | **VERIFIED**                 | `auditIsEligible` and production `isEligible` both reject `status !== 'ACTIVE'`. DB constraint `rate_plans_code_ck` enforces the code allow-list.                                                                |
| Invalid time granularity fails closed                 | **VERIFIED**                 | `parseInstant` rejects non-15-minute timestamps with a structured error; covered by `pricing-engine.test.ts`.                                                                                                    |
| Duration above 24 h fails closed                      | **VERIFIED**                 | `max_duration_minutes_inclusive ≤ 1440` is a DB CHECK constraint; `selection-rule-matcher.ts` `durationMinutes` rejects `> AUDIT_MAX_DURATION_MINUTES`.                                                          |
| Equivalent UTC/local intervals normalize consistently | **VERIFIED**                 | Pricing engine normalises UTC → `localMinuteOfDay` via `Intl.DateTimeFormat` with the requested timezone; covered by audit-exhaustive cross-midnight slot.                                                       |
| Extra-hour count is mathematically correct            | **VERIFIED**                 | Covered by `pricing-engine.test.ts` "extra-hour rounding" cases + audit-oracle parity.                                                                                                                           |
| No uncovered requested minutes                        | **VERIFIED**                 | All eligible base plans have `min_duration_minutes_inclusive ≤ duration ≤ max_duration_minutes_inclusive`; `validateActiveRuleSet` rejects configurations with uncovered cells.                                  |
| No accidental double charging                         | **VERIFIED**                 | `extraUnits` is computed once; coupon discount is computed against the unmodified gross; settlement tests prove atomicity.                                                                                       |
| No time-zone truncation                               | **VERIFIED**                 | The matcher uses `Intl.DateTimeFormat` which does not perform day-boundary truncation in the relevant timezone.                                                                                                  |
| No SQL/client disagreement                            | **VERIFIED_WITH_LIMITATION** | The pricing selector is pure JavaScript over a `PricingCatalog` snapshot; the SQL store returns the same plan and price rows that the matcher uses. The audit did not find any divergence in this audit's tests. |
| Production and oracle totals are identical            | **FAIL**                     | 2 032 / 8 928 (22.76 %) scenarios disagree. See Section 2 above.                                                                                                                                                 |

## 5. Selection Policy Identification

The audit was asked to identify, from behaviour, what policy the selector implements. From `selection-rule-matcher.ts`:

1. Filter ACTIVE base plans by `(min_check_in ≤ local < max_check_in) ∧ (min_dur ≤ dur ≤ max_dur)`.
2. If zero or more than one plan has the strictly highest `priority`, raise an ambiguity error (or no-match error).
3. Use the unique highest-priority plan as the base.
4. Add extras for `Math.ceil((dur - base.included) / 60) × EXTRA_HOUR price`.

This is **fixed-priority selection with ambiguity error**, **not** cheapest-candidate selection. ADR-0005 confirms this is the intended policy.

## 6. Headline Conclusion

The pricing algorithm is **internally consistent** and **correctly implements its declared policy**. It is **not**, however, a cheapest-candidate algorithm, and the audit's exhaustive + property-based tests prove that the current configuration exposes scenarios where the customer is charged strictly more than the cheapest valid alternative. Whether this is a defect depends on the business decision: is the customer entitled to the cheapest valid combination, or is the highest-priority combo (LUNCH > NIGHT > DAY > FIVE > THREE) the intended product?

**Audit verdict: PRICING_EXHAUSTIVE_ORACLE_MATCH = FAIL** — by the audit definition (production must match the oracle's minimum in 100 % of scenarios).

**Audit verdict: PRICING_RANDOM_PROPERTY_TESTS = FAIL** — same reason.

**Audit verdict: PRICING_BOUNDARY_CORRECTNESS = VERIFIED_WITH_LIMITATION** — every boundary behaves as documented; the limitation is the policy itself.

**Audit verdict: EXACT_TIME_CHEAPEST_PLAN = FAIL** — see gap PRICING-001 P0.

## 7. Next Steps

See `next-phase-roadmap.md` Phase 8B.
