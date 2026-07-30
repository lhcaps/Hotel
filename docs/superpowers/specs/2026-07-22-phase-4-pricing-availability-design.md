# Phase 4 Pricing and Availability Design

## Decision

Phase 4 adds a server-authoritative pricing and availability vertical slice for the existing single-property platform: ADMIN configures the existing rate-plan catalog, an anonymous visitor searches room-type availability, the API issues an immutable 15-minute quote, and the web displays the resulting breakdown. PostgreSQL remains authoritative for the pricing catalog, room inventory ledger, quotes and audit events. A search or quote never creates a booking, assigns a physical room, inserts an inventory block, stores guest PII, applies a coupon, or starts payment.

This design is constrained to Node `v24.18.0`, pnpm `10.33.2`, Next App Router, Nest/Fastify, shared Zod contracts, Drizzle/PostgreSQL and the existing single repository. Released migrations, the Phase 3 auth bridge, the `room_inventory_blocks` ledger, and existing route contracts remain intact.

## Existing facts and compatibility

The current schema already has `rate_plans`, `rate_plan_prices`, `price_tiers`, room types and rooms. Released codes are `THREE_HOUR_COMBO`, `FIVE_HOUR_COMBO`, `LUNCH_COMBO`, `NIGHT_COMBO`, `DAY_COMBO`, and `EXTRA_HOUR`. Development seed data makes only `LUNCH_COMBO` ACTIVE with prices TIER_1 `359000`, TIER_2 `419000`, and TIER_3 `489000`; all other plans are DRAFT. Phase 4 must therefore report a typed missing/inactive configuration outcome rather than invent an amount.

The actual status enum is `DRAFT | ACTIVE | INACTIVE`, not `RETIRED`. `INACTIVE` is the Phase 4 historical-retirement equivalent: it cannot receive price updates that reactivate it implicitly, cannot produce a new quote, is retained for history, and is never hard-deleted. `DRAFT` remains editable but ineligible. `ACTIVE` is eligible only after transactional completeness validation.

## Pricing decision matrix

All input instants are ISO timestamps with offsets. The pure engine converts check-in to `Asia/Ho_Chi_Minh` for time-window selection and computes duration from instants. Inputs must align to 15-minute boundaries, satisfy `[checkIn, checkOut)`, and be at least 60 and at most 1,440 minutes. Amounts are positive `bigint` VND in storage and integer JavaScript `number` only within the existing safe contract range; no decimal or floating-point money is accepted.

| Precedence | Rule version/code | Condition                                                                          | Base plan / included minutes | Extra plan / units                                        |
| ---------- | ----------------- | ---------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------- |
| 100        | `PRC-001`         | `duration > 960 && duration <= 1440`                                               | `DAY_COMBO`, 1,440           | none                                                      |
| 90         | `PRC-002`         | local check-in `>= 18:00`, `duration > 300 && duration <= 960`                     | `NIGHT_COMBO`, 300           | `EXTRA_HOUR`, `ceil((duration - 300) / 60)`               |
| 80         | `PRC-003`         | local check-in `>= 11:00 && < 15:00`, `duration <= 960`, after Day/Night rejection | `LUNCH_COMBO`, 180           | `EXTRA_HOUR`, `ceil((duration - 180) / 60)` when positive |
| 70         | `PRC-006`         | `duration > 240 && duration <= 300`, after higher rules                            | `FIVE_HOUR_COMBO`, 300       | none                                                      |
| 70         | `PRC-007`         | `duration > 300 && duration <= 960`, local check-in `< 18:00`, after Lunch/Day     | `FIVE_HOUR_COMBO`, 300       | `EXTRA_HOUR`, `ceil((duration - 300) / 60)`               |
| 60         | `PRC-004`         | `duration <= 180`, after higher rules                                              | `THREE_HOUR_COMBO`, 180      | none                                                      |
| 60         | `PRC-005`         | `duration > 180 && duration <= 240`, after higher rules                            | `THREE_HOUR_COMBO`, 180      | exactly 1 `EXTRA_HOUR`                                    |

`DAY_COMBO` wins over all other rules, `NIGHT_COMBO` wins over Lunch and duration plans, Lunch wins over duration plans, Five-hour wins for durations over four hours, and Three-hour is the remaining base. The lunch end is exclusive (`15:00` is not lunch); the evening start is inclusive (`18:00` is night only when duration is greater than five hours). The day threshold is strict (`> 16h`); exactly 16 hours follows the preceding applicable rule. Durations between four and five hours use the five-hour base, while exactly four hours remains three-hour plus one extra. Extra time is each started 60-minute unit, rounded up; at 15-minute input precision, 15/30/45/60 minutes of excess all cost one unit. `DAY_COMBO` includes up to 24 hours and has no extra amount.

Prices are final tax/service-inclusive catalog values. The response contains `baseAmountVnd`, `extraAmountVnd`, `totalAmountVnd = baseAmountVnd + extraAmountVnd`, selected base plan, optional `EXTRA_HOUR` line, rule version, and a snapshot timestamp. The client submits neither a total nor an authoritative plan. A selected plan absent, DRAFT, INACTIVE, cross-property, duplicated, or missing a selected tier price yields a typed, safe configuration failure.

### Boundary examples

`B` denotes the configured base-plan price for the room type's tier; `E` denotes that tier's configured extra-hour price. Values such as `359000` are literal VND where the seeded Lunch catalog is sufficient; non-Lunch production prices remain configuration, not assumptions.

| Local check-in | Duration | Selected rule           | Extra units | Expected amount                |
| -------------- | -------: | ----------------------- | ----------: | ------------------------------ |
| 10:45          |       3h | `PRC-004` Three         |           0 | `B(THREE_HOUR_COMBO)`          |
| 11:00          |       3h | `PRC-003` Lunch         |           0 | `359000/419000/489000` by tier |
| 14:45          |       3h | `PRC-003` Lunch         |           0 | Lunch tier amount              |
| 15:00          |       3h | `PRC-004` Three         |           0 | `B(THREE_HOUR_COMBO)`          |
| 15:15          |       3h | `PRC-004` Three         |           0 | `B(THREE_HOUR_COMBO)`          |
| 15:00          |     2h45 | `PRC-004` Three         |           0 | `B(THREE_HOUR_COMBO)`          |
| 15:00          |       3h | `PRC-004` Three         |           0 | `B(THREE_HOUR_COMBO)`          |
| 15:00          |     3h15 | `PRC-005` Three + extra |           1 | `B(THREE_HOUR_COMBO)+E`        |
| 15:00          |       4h | `PRC-005` Three + extra |           1 | `B(THREE_HOUR_COMBO)+E`        |
| 15:00          |     4h15 | `PRC-006` Five          |           0 | `B(FIVE_HOUR_COMBO)`           |
| 15:00          |       5h | `PRC-006` Five          |           0 | `B(FIVE_HOUR_COMBO)`           |
| 15:00          |     5h15 | `PRC-007` Five + extra  |           1 | `B(FIVE_HOUR_COMBO)+E`         |
| 17:45          |     5h15 | `PRC-007` Five + extra  |           1 | `B(FIVE_HOUR_COMBO)+E`         |
| 18:00          |       5h | `PRC-006` Five          |           0 | `B(FIVE_HOUR_COMBO)`           |
| 18:00          |     5h15 | `PRC-002` Night + extra |           1 | `B(NIGHT_COMBO)+E`             |
| 08:00          |      16h | `PRC-007` Five + extra  |          11 | `B(FIVE_HOUR_COMBO)+11E`       |
| 08:00          |    16h15 | `PRC-001` Day           |           0 | `B(DAY_COMBO)`                 |
| 08:00          |      24h | `PRC-001` Day           |           0 | `B(DAY_COMBO)`                 |

## Architecture and data flow

`PricingEngine` is a pure domain function. It receives validated localizable instants, a tier-scoped lookup of ACTIVE plan prices, and returns a deterministic breakdown or typed domain error. It performs no database, clock, environment, logger, HTTP, or browser access. A `PricingCatalogRepository` loads the property-scoped plan/tier rows; `RatePlanAdminService` owns price upsert, activation and inactivation transactions plus audit events; and `QuoteService` owns availability revalidation, quote persistence, and safe retrieval.

Availability uses one SQL query over ACTIVE room types and ACTIVE rooms, with an anti-join/`NOT EXISTS` against ACTIVE `room_inventory_blocks` whose `tstzrange(starts_at, ends_at, '[)') && tstzrange($checkIn, $checkOut, '[)')`. It filters adults, children and combined capacity and returns only room-type-safe data plus available count, ordered by room-type name then id. It never returns a room ID, room number, ledger ID, or a selected physical room. Maintenance blocks are already ledger rows and are therefore automatically authoritative. Search has bounded 1–24 hour / 15-minute input and a documented rate-limit category; Redis never decides its answer.

The forward migration adds a property-scoped `quotes` table with room-type reference, requested interval/occupancy, `expires_at`, and a non-empty JSONB immutable snapshot. The snapshot contains only property/room-type display facts, tier code, pricing rule version, line items, integer VND totals, and server timestamps—no physical-room reference and no PII. Check constraints enforce interval, quarter-hour precision, occupancy, VND total arithmetic and expiry after creation. A PostgreSQL trigger rejects `UPDATE` and `DELETE`; expired retrieval returns `QUOTE_EXPIRED` without mutation, using `CURRENT_TIMESTAMP` in the database query. Quote creation uses database time and a 15-minute interval, inserts no `room_inventory_blocks` row, and does not reserve availability.

## API, authorization and contracts

Shared `@room/contracts` becomes the sole source of Zod schemas, inferred types, API parsing, OpenAPI generation, typed web clients and contract tests. Public routes are `POST /api/v1/availability/search`, `POST /api/v1/quotes`, and `GET /api/v1/quotes/:quoteId`; all accept no PII. ADMIN routes are `GET /api/v1/admin/rate-plans`, `PUT /api/v1/admin/rate-plans/:id/prices/:priceTierId`, `POST /api/v1/admin/rate-plans/:id/activate`, and `POST /api/v1/admin/rate-plans/:id/inactivate`. They use new fixed permissions, the existing server-derived actor context, an atomic audit write, and current-property scoping.

Safe problem responses extend the existing envelope with `PRICING_CONFIGURATION_UNAVAILABLE`, `RATE_PLAN_INCOMPLETE`, `AVAILABILITY_UNAVAILABLE`, `CAPACITY_EXCEEDED`, `QUOTE_NOT_FOUND`, and `QUOTE_EXPIRED`; they never return SQL, constraint names, room IDs/numbers, credentials, or plan catalog internals. Structured events record category, request ID, property/room-type/quote opaque IDs, selected rule code and duration—not bodies, PII, physical rooms, price catalog, cookies, tokens, URLs with credentials, or SQL.

## Web and accessibility

The admin shell gains `/admin/rate-plans` with a rate-plan list, tier price editor, completeness panel, activation/inactivation controls and explicit loading, error, empty and disabled states. `/booking/search` has check-in/check-out date-time fields limited to 15-minute input, occupancy fields, validation summary, accessible result announcement and room-type cards. `/booking/quote/[quoteId]` renders only server-returned snapshot data, VND formatting, expiry and the statement that a quote does not reserve a room; there is no personal-info form, HOLD button, coupon or payment action.

Reusable `RatePlanCompletenessPanel`, `AvailabilitySearchForm`, `RoomTypeAvailabilityCard`, `QuoteBreakdown`, `VndAmount`, and `QuoteExpiryNotice` receive meaningful Storybook states and component axe coverage. Public and admin Playwright flows use real web/API/PostgreSQL; physical-room disclosure is explicitly asserted absent.

## Testing, migration and recovery

Every behavior is test-first: table-driven pure pricing tests cover every matrix boundary, timezone conversion, configuration failures and integer math; guarded PostgreSQL tests cover the migration, catalog activation/audit atomicity, anti-overlap availability semantics, quote immutability and snapshot preservation; API/contract tests cover public and permission boundaries; component/Storybook/axe and Playwright prove UI behavior. Generated migration artifacts, OpenAPI artifact and declarative configuration are recorded TDD exceptions.

The migration is forward-only, advances schema readiness to `phase-4-pricing-availability-v1`, and is tested on an empty guarded database and an already-migrated database. Rollback stops an application release; schema defects use a new reviewed forward migration. Phase 5 may revalidate an unexpired quote and availability before creating a HOLD but must not mutate this quote snapshot.

## Design self-review

The decision matrix resolves every listed monetary boundary from the authoritative Phase 0 pricing document without inventing unconfigured catalog amounts. It preserves existing statuses and released migrations, excludes booking/HOLD/coupon/payment work, names one owner for each transaction, keeps room inventory and pricing server-authoritative, specifies public non-disclosure, and maps each vertical slice to executable evidence.
