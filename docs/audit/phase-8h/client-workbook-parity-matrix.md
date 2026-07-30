# Phase 8H Client Workbook Parity Matrix

## Inspection and redaction

The supplied workbook was inspected as an OpenXML package without emitting cell values. The preferred workbook reader could not import its threaded-comment metadata because it has no required display-name author. The fallback read only workbook structure, sheet visibility, and formula-cell counts. No customer name, phone number, booking amount, identifier, formula text, or screenshot was copied to this repository.

The workbook contains seven surfaces, including visible room schedule, booking operations, customer confirmation, dashboard, settings, and two hidden report/configuration surfaces. It contains formula cells and is treated only as a business reference; pricing formulas are not implementation authority.

| Workbook capability | Repository entity and authority | API / route | Status | Treatment | Migration | Security and test boundary | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Property/site | `properties`; current property context | `/api/v1/admin/properties`, `/admin/property` | MATCHED_DIFFERENT_MODEL | Keep single configurable property; no tenancy | No | ADMIN authorization; catalog API tests | SINGLE_PROPERTY_MATCHED |
| Physical room code | `rooms.roomNumber` | `/api/v1/admin/rooms`, `/admin/rooms` | PARTIAL | Add read-only operations board; do not expose to CUSTOMER | No | ADMIN-only response and browser board test | IMPLEMENT |
| Room tier | `price_tiers` and room type tier relation | `/api/v1/admin/price-tiers`, `/admin/price-tiers` | MATCHED_DIFFERENT_MODEL | A tier is pricing authority, not a duplicated room type | No | Catalog and quote regression | MATCHED |
| Housekeeping state | No current entity | None | MISSING_REPO_OWNED | Add `CLEAN`, `DIRTY`, `CLEANING` to rooms with audited ADMIN update | Yes | role, validation, persistence, non-disclosure tests | IMPLEMENT |
| Room schedule and occupancy | bookings plus inventory constraints | existing booking lifecycle and rooms routes | PARTIAL | Server shapes occupancy for selected day; browser performs no overlap computation | No | server shaping + board refresh tests | IMPLEMENT |
| Rate plan/package | `rate_plans` | `/api/v1/admin/rate-plans`, `/admin/rate-plans` | MATCHED_DIFFERENT_MODEL | Reuse rate plans, including `EXTRA_HOUR`; no combo table | No | API validation and public quote regression | MATCHED |
| Package eligibility window | rate plan selection fields | same | MATCHED | Present current values in a matrix without formula editor | No | rate-plan tests | MATCHED |
| Tier price and extra-hour price | `rate_plan_prices` | same | MATCHED | Reformat existing configuration as scan-first matrix | No | changed price reaches quote test | IMPLEMENT_PRESENTATION |
| Booking contact | contact snapshot and guest access | booking detail / account detail | MATCHED_DIFFERENT_MODEL | Mask list contact; show contract-permitted detail only | No | disclosure tests | MATCHED |
| Acquisition source | No stable booking field | None | DOMAIN_CHANGE_REQUIRED | Defer: no ad-hoc attribution string | Yes | future source catalog and privacy review | DEFERRED |
| Responsible employee | No staff identity relationship | None | DOMAIN_CHANGE_REQUIRED | `DOMAIN_CHANGE_REQUIRED_STAFF_IDENTITY` | Yes | future RBAC/data-retention review | DEFERRED |
| Discount | coupon snapshots and immutable booking amounts | booking/admin detail | MATCHED_DIFFERENT_MODEL | Keep coupon as discount owner | No | pricing reconciliation | MATCHED |
| Surcharge/manual adjustment | No audited adjustment model | None | DOMAIN_CHANGE_REQUIRED | `DOMAIN_CHANGE_REQUIRED_AUDITED_ADJUSTMENTS` | Yes | future immutable audit/authorization review | DEFERRED |
| Total | `bookings.finalAmountVnd` | booking/admin detail | MATCHED | Stored server-authoritative VND amount | No | contract and database tests | MATCHED |
| Conflict warning | inventory exclusion constraint | safe booking conflict problem | MATCHED_DIFFERENT_MODEL | Never calculate conflict in browser or reveal SQL constraint | No | constraint and safe-problem tests | MATCHED |
| Payment attempts | `payments` plus `payment_attempts` | payment status / ADMIN payment pages | MATCHED_DIFFERENT_MODEL | Attempts represent full-payment provider attempts, not instalments | No | settlement regression | MATCHED |
| Two payment entries / partial payment | one payment aggregate per booking; attempt rows share full amount | None | DOMAIN_CHANGE_REQUIRED | `PARTIAL_PAYMENT=DOMAIN_CHANGE_REQUIRED_DEFERRED` | Yes | future ledger/reconciliation design | DEFERRED |
| Customer confirmation | protected booking/account detail | `/booking/manage/[bookingCode]`, `/account/bookings/[bookingCode]` | PARTIAL | Add safe printable confirmation projection; omit internal room, source, employee, housekeeping, UUID, and raw provider fields | No | authorization and projection tests | IMPLEMENT |
| Operational reporting | stored bookings and payments | None | MISSING_REPO_OWNED | Add server aggregate endpoint and ADMIN report with table alternative | No | aggregate correctness, role, empty/error tests | IMPLEMENT |

## Decisions

- `MULTI_PROPERTY=SINGLE_PROPERTY_MATCHED`.
- Workbook formulas are not copied or executed in browser or TypeScript.
- `PARTIAL_PAYMENT=DOMAIN_CHANGE_REQUIRED_DEFERRED`.
- Source attribution and employee attribution are deferred because no durable, authorized ownership model exists.
