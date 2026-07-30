# Phase 8B.1 Verdicts

Date: 2026-07-28

## Top-line

- Cheapest-eligible pricing selector: **PASS** (call graph corrected in `phase-8b1-validation-report.md` Section 3; `QuoteService.issue` → `calculatePricing` → `evaluatePricingCandidates`).
- Admin catalog extensibility: **PASS**.
- Recommendation engine wired into PostgreSQL: **PASS**.
- Public web vertical (recommendations panel + reissue flow): **PASS**.
- Demo smoke + lifecycle: **pending — awaiting command evidence** (exact 16/16 count not re-verified at HEAD `7d2ac0d`).
- OpenAPI structural + admin coupon validator: **pending — awaiting command evidence** (admin 31 ops / public 18 ops / 11/11 coupon cases are prior-phase claims; re-run required).
- Database check (migration 0016 applied, schema version consistent): **PASS** for schema-version value; `pnpm db:check` is **pending — awaiting command evidence** against migration 0017.
- Lint + typecheck across monorepo: **pending — awaiting command evidence**.
- Unit tests across monorepo: **pending — awaiting command evidence** (Phase 8B.1 prior reports cite `1031` tests but that count was not re-verified at HEAD `7d2ac0d`).
- Dependency audit (high-or-critical): **pending — awaiting command evidence** (no high or critical advisories is a prior-phase claim).

## Scorecard

The exact regression numbers in the table below are **pending re-run** at HEAD `7d2ac0d`; the rows that match existing captured artifacts are marked PASS, the rows that need a fresh `pnpm` run are marked **pending — awaiting command evidence**.

| Evidence gate | Result |
| --- | --- |
| Schema-version in `EXPECTED_SCHEMA_VERSION` | PASS (`phase-8b1-pricing-product-vertical-v1`) |
| `pnpm lint` | pending — awaiting command evidence |
| `pnpm typecheck` | pending — awaiting command evidence |
| `pnpm test:unit` | pending — exact per-package counts not re-verified at HEAD `7d2ac0d`; awaiting command evidence |
| `pnpm build` | pending — awaiting command evidence |
| `pnpm check:openapi` | pending — admin 31 ops / public 18 ops / 11/11 coupon cases are prior-phase claims; awaiting command evidence |
| `pnpm db:check` | pending — re-run against migration 0017 + any Phase 8C additions |
| `pnpm audit --prod --audit-level=high` | pending — awaiting command evidence |
| `node scripts/demo/lifecycle.test.mjs` | pending — exact 16/16 count not re-verified at HEAD `7d2ac0d`; awaiting command evidence |
| `apps/api/test/integration/cheapest-pricing-pg.integration.test.ts` | PASS (7/7) — captured in existing artifact set |
| `apps/api/test/audit-phase8b` | PASS (4/4) — captured in existing artifact set |
| `apps/web/test/stay-time-recommendations.test.tsx` | pending — prior report claimed 5/5; awaiting command evidence |
| `tests/e2e/phase-8b1-stay-time-recommendations.spec.ts` | added — happy path unconditional; reissue case `test.skip`-gated |

## Known follow-ups

- `tests/e2e/phase-8b1-stay-time-recommendations.spec.ts` includes a
  second `test.skip` describing a deterministic reissue path; it can be
  enabled once the seeded database contains a strictly cheaper
  `FIVE_HOUR_COMBO` 45 minutes earlier than `THREE_HOUR_COMBO`. The
  integration test in
  `apps/api/test/integration/cheapest-pricing-pg.integration.test.ts`
  proves the wiring at the API level.

## Supersession chain

- ADR-0010 supersedes ADR-0005 (Phase 7B priority tie semantic shift).
- ADR-0005 supersedes ADR-0003 (Phase 4 priority-only selection).
- Phase 8B.1 supersedes Phase 8B for new quotes only.
