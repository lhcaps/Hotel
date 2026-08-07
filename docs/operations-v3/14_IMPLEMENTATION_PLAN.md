# Implementation-ready B0 vertical slice

## Current implementation status

The vertical slice below is implemented locally and freshly verified. The
release remains unreleased: public multi-night exposure defaults OFF, 0029 is
local-only, and no production or Git mutation is authorized by this document.

B0 is one slice only:

`public interval input -> server policy validation -> exact pricing eligibility -> complete-interval room-type availability -> immutable quote -> transactional HOLD revalidation -> allocate exactly one physical room -> one booking -> one inventory block -> one payment aggregate -> lifecycle`.

Availability proves existential same-room continuity for the complete interval
without selecting or reserving a physical room. The quote stores no `roomId` or
physical room code. HOLD is the first physical-room reservation point and
rechecks the complete interval transactionally.

No housekeeping assignment workspace, full smart-lock provider, multi-property creation, new top-level role, or unrelated Operations V3 redesign belongs in B0.

## Historical B0.2 scope and catalog stop

B0.2 is pricing composition only. It may produce an internal pure candidate
calculation after an authoritative catalog capability gate, but it must not
change public UI/API schemas, availability, quote persistence, HOLD, booking,
payment, room allocation, or production state. The authorized catalog migration
is additive and limited to the database package, generated migration metadata,
custom PostgreSQL guards, guarded tests, and narrow documentation. The candidate must
contain the exact requested interval/timezone, policy identity, exact component
intervals, source ids/versions, quantities, integer-VND totals, restrictions,
and deterministic id/ranking; it must contain no physical room id/code,
selection, reservation, lock, or availability claim.

The catalog schema gate is now implemented locally in migration 0029 because
the repository catalog did not explicitly define repeatability, before/after
combinability, effective periods, or immutable rule/version identity. Do not
map those meanings from plan codes, labels, or `isBasePlan`. The local
V1-derived bootstrap, published reader, composer, and publication/Admin HTTP
flows are implemented behind server-owned gates; production remains dark. See
`11_MIGRATION_PLAN.md` for the additive schema and approval boundary.

## Current B0 V3 catalog correction and runtime boundary

The corrected model is one immutable release aggregate:

`pricing_policy_versions -> pricing_policy_components -> pricing_policy_component_prices`

with directed adjacency in `pricing_policy_component_edges`.

The root owns property, monotonic version number,
DRAFT/PUBLISHED/RETIRED/CANCELLED lifecycle, explicit `QUOTE_INSTANT` or
`STAY_START` applicability basis, half-open effective interval, timezone
snapshot, schema discriminator, actor/audit metadata, cancellation metadata,
and candidate line safety bound. Components own coverage and billing semantics,
separate occurrence/billing quantities, restrictions, display explanation
metadata, and deterministic tie-break ranks. Prices are separate per component
and property-owned price tier. Edges are directed, same-release, and bounded;
only bounded self-repeat is allowed.

The exact coverage models are `FIXED_ELAPSED`, `LOCAL_CLOCK_WINDOW`, and
`REQUEST_BOUNDARY` with explicit `LEADING` or `TRAILING` position. Leading and
trailing extensions have independently reviewed edge sets and approvals; there is no
terminal-only remainder. The exact initial billing models are
`FIXED_OCCURRENCE` and `STARTED_UNIT`. Occurrence count is governed by
`maximum_occurrences_per_candidate` and explicit self-edges, while started-unit
quantity is derived separately from `billing_unit_minutes` and exact coverage.
Coverage is always computed from exact instants before billing quantity, and
`displayNightCount` is presentation-only.
Each boundary component may have multiple explicitly approved predecessor or
successor alternatives in the catalog, while each candidate selects exactly
one boundary path; graph and line limits remain authoritative.
See `11_MIGRATION_PLAN.md` for keys, composite ownership FKs, constraints,
immutability triggers, publication transaction, and expected Drizzle/custom SQL
after a separate approval.

The local implementation is additive in `packages/database/src/schema.ts` and
`packages/database/drizzle/0029_operations_v3_pricing_policy_release.sql`, with matching snapshot,
journal, provenance, and guarded integration tests. The current V1 rate-plan
APIs and snapshots remain unchanged. A development-only, opt-in bootstrap reads
actual V1 technical `NIGHT_COMBO`/`EXTRA_HOUR` rows and creates DRAFT only;
the published lookup, composer, Admin API, public interval/offer/quote/HOLD
path, and lifecycle integrations are implemented behind server-owned gates.
Production migration, bootstrap, and public exposure remain off.

Lookup is explicit through the property's established basis:
`QUOTE_INSTANT` uses the server quote timestamp and `STAY_START` uses the exact
check-in instant. The local B0 basis is `STAY_START`; production enablement
remains release controlled, no default is inferred from client input, and the
client cannot choose the basis. A candidate selects one PUBLISHED policy release and never mixes multiple policy versions or bases. Published
open-ended policies are replaced only by an atomic, one-way closure at an
explicit cutover while the old policy remains PUBLISHED; interval extension is
forbidden. `CANCELLED` drafts are excluded
from lookup and exclusion and do not alter accepted snapshots.

## Ordered checkpoints

| Phase                                        | Expected files to modify after approval                                                                                    | Tests                                                                                                                     | Migration                         | Compatibility/rollback boundary                                                                          | Stop condition                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| B0.1 contract and property-policy foundation | `packages/contracts/src/pricing.ts`; `apps/api/src/pricing/stay-policy.ts`; focused tests                                  | Contract, derivation, stay-policy, pricing-regression, and dark-launch tests                                              | `NONE`                            | Additive `multi_night`; existing hourly/overnight remain unchanged; new path fails closed                | Cannot represent exact interval or enforce property maximum without a production hard-code.         |
| B0.2 multi-night pricing composition         | Database schema, `drizzle/0029_operations_v3_pricing_policy_release.sql`, snapshot/journal/provenance, guarded tests, docs | 40 schema/invariant + 5 concurrency; 0028 -> 0029 upgrade; bootstrap, lookup, composer, and internal/public-gated runtime | `0029` local only                 | Additive catalog; development/loopback opt-in bootstrap; production migration and public gate remain OFF | Missing approved business semantics, overlap/gap/double charge, unbounded graph, or nondeterminism. |
| B0.3 availability/same-room continuity       | `apps/api/src/pricing/availability.service.ts`; booking HOLD path; no room-split path                                      | DB inventory overlap, maintenance-middle-night, concurrent HOLD                                                           | `NONE`                            | Full-interval query and transactional revalidation; no physical room in public availability or quote     | Any path can select a room free only for part of interval.                                          |
| B0.4 quote snapshot compatibility            | `quote.service.ts`, `quote.repository.ts`, contracts, quote/customer adapters                                              | Quote expiry, old snapshot decode, duration/night derivation                                                              | `NONE`                            | Never reprice old quote/booking; legacy snapshot adapter required                                        | Old quote unreadable or new snapshot missing immutable timezone/reason.                             |
| B0.5 HOLD/booking/inventory/payment          | `create-booking-hold.ts`, booking repository, payment adapters only as needed                                              | One quote/HOLD/booking/room/block/payment; payment/IPN/return; idempotency                                                | `NONE` expected                   | Existing transactional locks and one payment aggregate remain; no per-night records                      | More than one booking/room/block/payment aggregate or client amount accepted.                       |
| B0.6 customer/admin UI                       | `availability-search-form.tsx`, search state/results, quote/booking/admin adapters/pages, i18n                             | Web unit/a11y and relevant Playwright flows                                                                               | `NONE`                            | Additive fields; remove one-night copy only after server error path is gone                              | Frontend accepts an interval backend rejects or exposes physical room code.                         |
| B0.7 access/final checkout compatibility     | Existing access/detail/customer adapters and lifecycle only if needed                                                      | Multi-night pass expiry, cancellation/revocation, final checkout/one turnover, duplicate checkout                         | `NONE` for current HMAC mechanism | Keep on-demand HMAC pass; T-30/provider remains deferred unless contract proves minimal foundation       | Daily access/task, room movement, or missing final turnover appears.                                |
| B0.8 complete verification                   | No new behavior; test/config/docs as approved                                                                              | API/web/auth/worker, disposable PostgreSQL, OpenAPI, endpoint, E2E, accessibility, security gates                         | `NONE`                            | All local/integration/external/production verdicts separate                                              | Any blocked prerequisite presented as PASS.                                                         |
| B0.9 stop before release                     | Release evidence only                                                                                                      | Human review and release checklist                                                                                        | `NONE`                            | No deploy or push from Phase A/B0 implementation without release token                                   | Stop and wait for `APPROVE_OPERATIONS_V3_PHASE_B0_RELEASE`.                                         |

## Access and housekeeping boundary

B0 proves continuous entitlement under the current HMAC pass and preserves final checkout. Full provider abstraction, scheduled T-30 issuance, retry/health/exception handling, cleaner assignment, activity logs, and verification workspace are later approved phases. Physical-room allocation remains transactional at HOLD; changing it requires a repository-grounded ADR and separate approval.
