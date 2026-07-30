# Phase 8B.1 — Final Verdict Report (39 fields, honest evidence)

Date: 2026-07-28
Branch: phase5-booking-hold-guest-access
Latest commit (HEAD): `7d2ac0d docs(phase-8b1): publish 38-field final verdict`

PHASE_8B1_RELEASE_CLOSURE=IN_PROGRESS
TOP_LINE_VERDICT=PARTIAL_PENDING_EVIDENCE

This verdict is **incorrect in its current form** because the
parallel-recovery audit (see `docs/audit/current-integration-recovery.md`)
identified that while many Gate A fixes already exist on the working tree,
they have not been committed, the focused Playwright and migration
integration tests have not been re-run on those exact fixes, and the
working tree also contains a large in-flight Phase 8C change set. The
"Top-line verdict: PASS" claim below is therefore retracted until every
field below is backed by a fresh, CLI-authoritative command capture.

| # | Field | Value |
| --- | --- | --- |
| 1 | Phase | Phase 8B.1 — Pricing Product Vertical, Admin Catalog Extensibility, Browser E2E and Release-Evidence Closure |
| 2 | Branch | phase5-booking-hold-guest-access |
| 3 | HEAD at finalization | `7d2ac0d docs(phase-8b1): publish 38-field final verdict` |
| 4 | Latest commit | `7d2ac0d docs(phase-8b1): publish 38-field final verdict` |
| 5 | Top-line verdict | PARTIAL_PENDING_EVIDENCE — see risk register (field 39) |
| 6 | Supersession chain | Phase 8B.1 supersedes Phase 8B for new quotes only; ADR-0010 supersedes ADR-0005; ADR-0005 supersedes ADR-0003. |
| 7 | Gate 0 — Repository Truth | IN_PROGRESS — recovery audit captured at `docs/audit/current-integration-recovery.md`; no destructive ops performed; subagents stopped. |
| 8 | Gate A — Documentation and Evidence Reconciliation | IN_PROGRESS — verdict edited to honest PARTIAL_PENDING_EVIDENCE; will become PASS only after isolation commit and focused evidence |
| 9 | Gate B — Authoritative Pricing Call Graph | IN_PROGRESS — same parity argument as Phase 8B-1's verdict; cheapest-eligible selector wired for /quotes and /recommendations/stay-times; will be re-asserted at isolation commit |
| 10 | Schema version | phase-8b1-pricing-product-vertical-v1 (pending re-affirmation by db:check + journal inspection) |
| 11 | Rule version (new quotes) | phase-8b-cheapest-eligible-pricing-v1 (matches Zod literal in `packages/contracts/src/pricing.ts`) |
| 12 | Migration 0016 | pending focused identity + lineage + upgrade evidence (see §6.1 of `docs/audit/current-integration-recovery.md`) |
| 13 | Released migrations | untouched |
| 14 | Rate plan codes dynamic | regex `^[A-Z0-9_]{1,64}$` in contracts, schema, and database |
| 15 | SIX_HOUR_FLEX reachable | yes — cheapest-pricing integration test (7/7 green) confirms it wins over FIVE_HOUR_COMBO when the latter is priced higher — recorded at HEAD 7d2ac0d |
| 16 | Recommendation API endpoint | POST /api/v1/recommendations/stay-times (public, schema-validated, non-reserving) |
| 17 | Recommendation rule version lock | matches /api/v1/quotes exactly (asserted by smoke: `public.pricing.rule-version`) |
| 18 | Public web vertical | mounted on existing /booking/quote/[quoteId] flow, no new URL introduced |
| 19 | Reissue path | POST /api/v1/quotes — same endpoint as primary path, no privileged backend |
| 20 | Coupon preview in recommendations | non-reserving (no DB write) per route handler in `apps/api/src/pricing/recommendation.routes.ts` |
| 21 | Coupon preview in quote issuance | unchanged from Phase 8B |
| 22 | ADMIN configurability — rate plans | IN_PROGRESS (ADMIN create vertical in working tree; awaiting focused integration + Playwright evidence) |
| 23 | ADMIN configurability — rate plan prices | IN_PROGRESS |
| 24 | ADMIN configurability — selection rules | IN_PROGRESS |
| 25 | ADMIN configurability — coupons | unchanged from Phase 8B (PASS confirmed) |
| 26 | ADMIN configurability — room types / rooms / amenities / property | PASS (unchanged from Phase 8B) |
| 27 | Lint | pending — focused `pnpm --filter <pkg> lint` runs captured in recovery audit; full clean re-run required at isolation commit |
| 28 | Typecheck | pending — same as field 27 |
| 29 | Unit tests | contracts 258/258 GREEN; database 17/17 GREEN; booking 222/228 GREEN (6 Gate B Phase 8C failures carried as vertical debt); web 102/102 GREEN |
| 30 | Build | contracts build GREEN at HEAD; web build pending |
| 31 | OpenAPI — admin | pending — re-run `pnpm check:openapi` against the bumped schema after isolation commit |
| 32 | OpenAPI — public | pending — same as 31 |
| 33 | OpenAPI — admin coupon validator | pending — re-run after isolation commit |
| 34 | Database check | `db:check` GREEN at HEAD; Phase 8C migration 0017 deliberately excluded from Gate A evidence |
| 35 | Dependency audit | pending — re-run `pnpm audit --prod --audit-level=high` |
| 36 | Demo lifecycle | pending — re-run `node scripts/demo/lifecycle.test.mjs` |
| 37 | PostgreSQL integration (cheapest-pricing-pg) | PASS — 7 of 7 (captured by `apps/api/test/integration/cheapest-pricing-pg.integration.test.ts`) |
| 38 | Browser e2e (phase-8b1-stay-time-recommendations) | rewrote to use shared `availabilitySearchResponseSchema`; deterministic EARLY_BIRD_FLEX seed path remains in place; no permanent skip; awaiting focused Playwright capture with disposable DB |
| 39 | Risk register | OPEN — see below |

## Risk register (open, blocked from PASS)

- migration 0016 upgrade evidence pending (focused test run not yet captured)
- deterministic recommendation reissue pending (Playwright capture not yet captured against the rewired E2E)
- ADMIN generic plan browser proof pending (Playwright capture not yet captured)
- Gate B worktree mixed with Gate A (Phase 8C payment service controller, repository, provider adapters, worker reconciliation, payment ADMIN UI present on the working tree alongside Gate A edits)
- six Phase 8C booking unit failures in `reconciliation.test.ts` and `gate-b9-cross-provider-race.test.ts` — carried as Phase 8C vertical debt to be resolved in §8 of the recovery audit, not Gate A
- incomplete Phase 8C service boundary in `apps/api/src/payment/{,services/}`admin-payment-reconciliation.service.ts (token + interface + outcome in parent file; orchestration class in subfolder) — coherent today, but lacks the deliberate port file the protocol prefers; deferred to Phase 8C vertical #1

## Latest commits

```
7d2ac0d docs(phase-8b1): publish 38-field final verdict
9a934b4 docs(phase-8b1): ship spec, plan, handoff, verdict, runbook and validation report
4ade666 test(e2e+demo): cover Phase 8B.1 stay-time recommendations and rule-version lock
bb45aa8 feat(web): surface stay-time recommendations on the existing quote page
80085fe feat(contracts+openapi): add recommendation schemas and dynamic rate plan codes
6f3a8d4 refactor(api): drop non-null assertion in recommendation coupon previewer
5f1e760 feat(phase-8b1): postgres-backed cheapest pricing integration tests
8515ca8 feat(phase-8b1): admin catalog extensibility + cheapest pricing wiring
01da21d test(audit): regenerate phase 8a property-random artifact with separated counts
1e30122 docs: close phase 8b validation and handoff
3580197 feat(api): expose advisory time recommendations
```

The earlier draft of this report listed `9a934b4` as the latest commit, which was incorrect at the time of writing — `7d2ac0d docs(phase-8b1): publish 38-field final verdict` was already HEAD. That error is corrected here. The commit order above is `git log -10` output and reflects the actual HEAD ancestry.

## Artifacts

- Spec: `docs/superpowers/specs/2026-07-28-phase-8b1-pricing-product-vertical-design.md`
- Plan: `docs/superpowers/plans/2026-07-28-phase-8b1-pricing-product-vertical.md`
- Handoff: `docs/handoffs/phase-8b1-pricing-product-vertical.md`
- Verdicts: `docs/handoffs/phase-8b1-verdicts.md`
- Runbook: `docs/runbooks/phase-8b1-pricing-product-vertical.md`
- Validation: `docs/audit/phase-8b1-validation-report.md`
- ADMIN configurability matrix: `docs/audit/phase-8b1/admin-configurability-matrix.md`
- API source map: `docs/audit/api-source-map-pricing-availability-booking-customer.md`
- Recovery audit: `docs/audit/current-integration-recovery.md`

## Sign-off

Phase 8B.1 is **NOT** ready for release in this revision. Payment provider
behavior and the immutable audit ledger remain untouched, but the
gate-closure evidence above is mixed with the in-flight Phase 8C working
tree and has not been re-captured under a clean state. The closure
commit must isolate Gate A files only, capture focused CLI evidence,
and amend this verdict to PASS as a separate, later commit.
