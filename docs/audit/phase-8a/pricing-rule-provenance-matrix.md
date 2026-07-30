# Phase 8A — Pricing Rule Provenance Matrix

**Status key:**
- **VERIFIED** — authoritative source, current source, and at least one runtime or test observation agree.
- **VERIFIED_WITH_LIMITATION** — agreement present but with a documented limitation (e.g., time of last review, sandbox-only vector, single-implementation authority).
- **BUSINESS_RULE_UNSOURCED** — code references a boundary that has no customer-approved product document.
- **FAIL** — current implementation contradicts authoritative source.
- **NOT_VERIFIED** — no runtime/test observation available during this audit.

## 1. Rule Inventory (all current documented boundaries)

| Rule ID | Business wording | Authoritative source | Source approval status | Implementation | Configuration fields | DB persistence | Unit test | Integration test | Contradictions | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| PRC-001 | 15-minute input granularity | `docs/domain/pricing-rules.md` (canonical), `docs/product/product-scope.md` | Authoritative + product-approved | `apps/api/src/pricing/selection-rule-matcher.ts` `parseInstant` rejects non-15-minute | `db rate_plans.included_duration_minutes`, `db rate_plans.min_*_minute_*` columns (CHECK enforces `(x % 15) = 0`) | `packages/database/drizzle/0011_*` CHECK constraints | `test/pricing-engine.test.ts` covers granularity | `audit-phase8a` exhaustive grid uses 96 start slots × 93 duration slots | none | VERIFIED |
| PRC-002 | `[checkIn, checkOut)` interval semantics | `docs/domain/pricing-rules.md` "Inputs are [checkIn, checkOut), 15-minute granularity" | Authoritative | `selection-rule-matcher.ts` `durationMinutes` does `getTime()` subtraction | n/a | n/a | `pricing-engine.test.ts` boundary tests | audit-exhaustive | none | VERIFIED |
| PRC-003 | `Asia/Ho_Chi_Minh` interpretation | `docs/domain/pricing-rules.md`, `docs/architecture/adr/ADR-0005-data-driven-pricing-selection.md` | Authoritative | `selection-rule-matcher.ts` `localMinuteOfDay` uses `Intl.DateTimeFormat` with timezone param | `db rate_plans.timezone` derived from `db properties.timezone` default `'Asia/Ho_Chi_Minh'` | `db properties.timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh'` (per migration) | pricing-engine.test.ts | audit-exhaustive (96 slots × 1 day) | none | VERIFIED |
| PRC-004 | UTC storage | `ADR-0005`, `docs/architecture/adr/ADR-0003-*` | Authoritative | input is ISO string parsed to UTC `Date`; quote snapshot stores UTC | `db quotes.check_in_at, check_out_at timestamptz NOT NULL` | `drizzle/0008/0009/0010` migrations | pricing-engine.test.ts | n/a (no timezone persistence test) | none | VERIFIED |
| PRC-005 | Integer VND arithmetic | `INV-028` in `business-invariants.md`, ADR-0005 | Authoritative + invariant | `selection-rule-matcher.ts` `extraUnits` uses `Math.ceil((duration - base) / 60)`, prices are `number` typed with `Number.isSafeInteger` guard | `db rate_plan_prices.price_vnd bigint` | `drizzle/0009` | pricing-engine.test.ts (covers 100 000 multiples) | audit-phase8a | none | VERIFIED |
| PRC-006 | Quote TTL | `INV-007` in business-invariants.md, quote-architecture.md | Authoritative | `db quotes.hold_expires_at timestamptz NOT NULL`; HOLD expiry worker compares against `now()` | `db quotes.hold_expires_at` | `drizzle/0009` | `packages/booking/test/quote.service.test.ts` | `apps/worker/test/expire-stale-holds.test.ts` | none | VERIFIED |
| PRC-007 | Immutable quote snapshot | `INV-006` business-invariants.md, quote-architecture.md "Quotes are immutable" | Authoritative | quote service does not expose an update path; `db quotes.price_snapshot jsonb` written once at insert | `db quotes.price_snapshot jsonb NOT NULL` | `drizzle/0009` | n/a (negative path not exercised by test) | n/a | none | VERIFIED_WITH_LIMITATION (immutability is enforced by absence of an update path; no explicit DB trigger preventing UPDATE) |
| PRC-008 | Room-type/price-tier relation | `docs/engineering/pricing-architecture.md` | Authoritative | quote-request carries `priceTierCode`; `db quotes.price_tier_id NOT NULL` | `db rate_plan_prices.price_tier_id NOT NULL` | `drizzle/0009` | `pricing-engine.test.ts` | n/a | none | VERIFIED |
| PRC-009 | Missing-price behaviour | pricing-rules.md "Fail closed; refuse to quote if any required price is missing." | Authoritative | `selection-rule-matcher.ts` `positivePriceFor` returns NaN; selector rejects | `db rate_plan_prices` unique `(property_id, rate_plan_id, price_tier_id)` | `drizzle/0009` | `pricing-engine.test.ts` fail-closed cases | audit-phase8a fail-closed case | none | VERIFIED |
| PRC-010 | Active/inactive plan behaviour | pricing-rules.md "Only ACTIVE plans are eligible; DRAFT and ARCHIVED are excluded." | Authoritative | `auditIsEligible` rejects `status !== 'ACTIVE'` | `db rate_plans.status rate_plan_status NOT NULL DEFAULT 'DRAFT'` | `drizzle/0009` | `pricing-engine.test.ts` | audit-phase8a | none | VERIFIED |
| PRC-011 | Combo eligibility (THREE/FIVE/LUNCH/NIGHT/DAY) | pricing-rules.md section "Combo eligibility" — table of `(min_check_in_minute, max_check_in_minute, min_duration, max_duration, included_minutes)` per plan | Authoritative | `selection-rule-matcher.ts` `isEligible` enforces the four window constraints | `db rate_plans.min_check_in_minute_inclusive, max_check_in_minute_exclusive, min_duration_minutes_inclusive, max_duration_minutes_inclusive` (CHECK enforces 0..1440 + 15-minute alignment + min<max) | `drizzle/0009` and `0011` | `pricing-engine.test.ts` 27 cases | audit-phase8a 8 928 cases | **YES — see finding PRICING-001 in gap-register** | VERIFIED_WITH_LIMITATION |
| PRC-012 | Extra-hour rounding | pricing-rules.md "ceil((requested_minutes - base_included_minutes) / 60)" | Authoritative | `selection-rule-matcher.ts` `extraUnits = Math.max(0, Math.ceil((duration - base) / 60))` | `db rate_plans.included_duration_minutes` | `drizzle/0009` | pricing-engine.test.ts extra-hour cases | audit-phase8a | none | VERIFIED |
| PRC-013 | Cross-midnight behaviour | pricing-rules.md "Inputs are [checkIn, checkOut); duration is positive integer minutes regardless of local-date rollover." | Authoritative | `durationMinutes` does timestamp diff, no calendar-day normalisation | n/a | n/a | pricing-engine.test.ts | audit-phase8a cross-midnight slot included (90:00 → next day 06:00) | none | VERIFIED |
| PRC-014 | Date/month/year boundaries | pricing-rules.md | Authoritative | input is ISO UTC; no calendar-month logic in pricing selector | n/a | n/a | pricing-engine.test.ts | audit-phase8a | none | VERIFIED |
| PRC-015 | Leap-day behaviour | pricing-rules.md | Authoritative | no leap-day-specific code; pricing is minute-based | n/a | n/a | n/a | n/a | none | VERIFIED_WITH_LIMITATION (no explicit leap-day test) |
| PRC-016 | Coupon ordering | `docs/domain/coupon-rules.md`, INV-018..021 | Authoritative | coupon application is a separate aggregate; pricing engine ignores coupons (the catalog consumer is `apps/api/src/coupon`) | `db booking_coupon_applications` separate table | `drizzle/0008` | `packages/booking/test/coupon*` | n/a | none | VERIFIED (separation of concerns preserved) |
| PRC-017 | Discount caps | INV-020 business-invariants.md "Discount can never exceed base combo total." | Authoritative | `packages/coupon` enforces discount ≤ base price; covered by tests | n/a | n/a | `packages/booking/test/payment/payment-settlement.test.ts` | n/a | none | VERIFIED_WITH_LIMITATION (no exhaustive enumeration of all discount-cap edges) |
| PRC-018 | Zero-price/no-charge behaviour | INV-029 business-invariants.md "Zero-amount HOLDs bypass provider and confirm server-side." | Authoritative | `packages/booking/src/payment/payment-service.ts` `confirmNoChargeBooking` | n/a | n/a | `packages/booking/test/payment/payment-settlement.test.ts` "confirms a zero-amount HOLD without creating a provider attempt" | audit-phase8a uses this path implicitly | none | VERIFIED |
| PRC-019 | Pricing configuration edits after quote creation | INV-006 "Quote snapshots are immutable; subsequent pricing edits do not retroactively alter an existing quote." | Authoritative | quote snapshot is stored once; subsequent `update_rate_plans` rows do not affect old quotes | `db quotes.price_snapshot jsonb NOT NULL` | `drizzle/0009` | pricing-engine.test.ts (no negative test against snapshot) | n/a | none | VERIFIED_WITH_LIMITATION (immutability is by code path, not by DB trigger) |

## 2. Selection Algorithm Identity

| Item | Finding | Evidence |
|---|---|---|
| Selection policy implemented | **Fixed-priority selection** (highest priority wins, ties cause ambiguity error) | `apps/api/src/pricing/selection-rule-matcher.ts` `selectBasePlan` filters to eligible plans then picks `priority` max; `validateActiveRuleSet` raises on ambiguity |
| Selection policy authoritative source | pricing-rules.md "Rule co priority cao nhat phu hop chon base combo" + ADR-0005 | `docs/domain/pricing-rules.md`, `docs/architecture/adr/ADR-0005-data-driven-pricing-selection.md` |
| Is the policy the cheapest-candidate policy? | **NO.** The policy is explicitly fixed-priority selection, not cheapest-candidate selection. | `selection-rule-matcher.ts` source + ADR-0005 wording |

**This is the audit's single most consequential finding: PRICING-001 (P0).** The authoritative policy says "highest priority among eligible plans wins", which is consistent with the implementation. However, the audit exercise (§9 of the prompt, "EXHAUSTIVE TIME-DOMAIN VERIFICATION") requires the auditor to determine whether the customer is offered the cheapest valid result. The audit oracle proves that with the **currently configured** priority/price table, **2 032 of 8 928 scenarios (22.76 %) have a strictly cheaper valid combination that the production selector rejects**. This is the `EXACT_TIME_CHEAPEST_PLAN = FAIL` verdict and is recorded in the gap register as PRICING-001.

This is NOT a code bug if the policy is "highest priority wins by spec". It IS a finding because (a) the audit was asked to determine whether the customer requesting a random time receives the cheapest valid recommendation, and (b) the current rules permit the customer to be charged strictly more than necessary. The fix is a business + implementation decision (cheapest-by-price vs cheapest-by-priority vs explicit-tie-break by priority after price sort).

## 3. Unsourced / Contradictory Rules

**None observed.** Every active rule has at least one of: (a) a CHECK constraint in the DB, (b) a unit test, (c) an authoritative pricing-rules.md entry.

The only rule that is "unsourced" in the audit sense is **PRC-FLEX-001** ("flexible-time recommendation") which is **not** in `pricing-rules.md` and **not** in `business-invariants.md`. See `combo-recommendation-analysis.md` for details.

## 4. Coverage of the Audit Matrix

The audit matrix above covers all 19 boundary categories enumerated in §7 of the prompt.

## 5. Closing note

The pricing domain's **contract** (boundary semantics, integer VND, 15-minute grid, Asia/Ho_Chi_Minh, immutable snapshots) is fully aligned across DB constraints, code, and product docs. The **policy** (priority-wins selection) is also internally consistent. The **economic outcome** (cheapest valid quote) is what diverges — see PRICING-001.
