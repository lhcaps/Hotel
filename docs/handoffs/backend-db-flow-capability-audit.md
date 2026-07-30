# Backend, Database, and Flow Capability Audit

Date: 2026-07-30
Branch: `phase5-booking-hold-guest-access`
Actual HEAD: `ff0fbb80aa6ab1e6d8509a9c8cef77d6b77f9519`
Prior committed HEAD before this audit: `ff0fbb8 docs(handoff): record committed runtime product parity`

This audit inspects the actual schema, contracts, controllers, services,
repositories, admin forms, and public web callers to determine which parts of a
proposed customer journey (landing browse → exact availability → aggregate
counts → horizontal room-type cards → room detail → eligible plans → voucher
preview → quote → recommendation → contact → HOLD → payment, plus the optional
"if exact availability empty → nearby room/time suggestions before room
selection") are already implemented end-to-end, partially implemented, or
missing.

No implementation, migration, new endpoint, new model, or new algorithm was
added as part of this audit. The output of this audit is the contract and
authority verdict only.

---

## 1. Schema version and authoritative tables

- Expected schema version (declared by code): `phase-8d-client-acceptance-v1`
  (`packages/database/src/schema-status.ts`, `EXPECTED_SCHEMA_VERSION`).
- Highest applied migration: `0020_panoramic_mantis.sql`
  (`packages/database/drizzle/`).
- 21 Drizzle SQL migrations total. The post-phase-8D migrations
  (`0017_optimal_freak.sql`, `0018_phase8c_schema_metadata_repair.sql`,
  `0019_phase8d_coupon_delivery.sql`, `0020_panoramic_mantis.sql`) and the
  `schema-status.ts` singleton check keep the room/coupon/quote/hold/payment
  surface that this audit relies on.

### 1.1 Schema tables actually present (selected from `databaseSchema` export)

`properties`, `price_tiers`, `room_types`, `rooms`, `amenities`,
`room_type_amenities`, `rate_plans`, `rate_plan_prices`, `maintenance_blocks`,
`room_inventory_blocks`, `coupons`, `coupon_room_types`, `quotes`, `bookings`,
`booking_coupon_applications`, `booking_contacts`, `guest_otp_challenges`,
`guest_sessions`, `payments`, `payment_attempts`, `payment_provider_events`,
`payment_provider_settings`, `customer_profiles`, `audit_events`,
`outbox_events`, `coupon_delivery_requests`, `operational_reviews`,
`users`, `sessions`, `accounts`, `verification_records`, `schema_metadata`.

### 1.2 Important room/gallery columns

There is **no media/gallery model**. `rooms`, `room_types`, `properties` do not
expose any image, photo, asset, sort order of media, or description-long-form
column. The public-facing image in `apps/web/src/lib/public-room-catalog.ts` is
the **static** function `publicRoomImage(roomTypeId)` which deterministically
selects one of three bundled PNG assets by hashing the UUID. There is no DB
column that drives the image, and no admin form that mutates media.

---

## 2. Requested flow capability matrix

Each requested step is classified as one of:
`IMPLEMENTED_END_TO_END`, `BACKEND_ONLY`, `CONTRACT_ONLY`, `WEB_ONLY`,
`PARTIAL`, `MISSING`, `NEW_PRODUCT_FEATURE`.

| #   | Requested step                                                                                         | Status                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Landing page browse (hero + featured room cards)                                                       | IMPLEMENTED_END_TO_END | `apps/web/src/app/page.tsx`, `apps/web/src/components/public-landing.tsx` → `loadPublicRoomCatalog()` → `GET /api/v1/public/room-types` (`apps/web/src/lib/public-room-catalog.ts`) → `PublicRoomCatalogController.list` (`apps/api/src/public-catalog/public-room-catalog.controller.ts`) → `PublicRoomCatalogService.list` → `PublicRoomCatalogRepository.list` (`apps/api/src/public-catalog/public-room-catalog.repository.ts`) returning only ACTIVE room types of the earliest-created ACTIVE property.                                                                                                                                                                                                                                                                                |
| 2   | Exact availability inline (search form, results before navigation)                                     | IMPLEMENTED_END_TO_END | `apps/web/src/components/landing-availability-search.tsx` + `availability-search-results.tsx` → `publicApi.searchAvailability` (`POST /api/v1/availability/search`) → `AvailabilityController.search` → `AvailabilityService.search` (`apps/api/src/pricing/availability.service.ts`) → `AvailabilityRepository.search` (`apps/api/src/pricing/availability.repository.ts`) returning items per ACTIVE room type: `roomTypeId`, `roomTypeName`, `maxAdults`, `maxChildren`, `maxOccupancy`, `amenities`, `availableRoomCount`, and authoritative `offer` (`planLabel`, `amountVnd`).                                                                                                                                                                                                         |
| 3   | Aggregate available room count per room-type card                                                      | IMPLEMENTED_END_TO_END | Field `availableRoomCount` in `availabilityRoomTypeSchema` (`packages/contracts/src/pricing.ts`). Computed in `AvailabilityRepository.search` as `rooms.filter(room => room.roomTypeId === type.id && !blockedRoomIds.has(room.id)).length`. Physical room IDs/numbers are never serialized.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 4   | DB-backed horizontal room-type cards on landing/results                                                | IMPLEMENTED_END_TO_END | The `PublicLanding` server component renders featured cards from `loadPublicRoomCatalog()`; the `AvailabilitySearchResults` client component renders cards from the search response. Both pipelines read ACTIVE room types from the database (no static fallback except when `NEXT_PUBLIC_API_BASE_URL` is unset).                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 5   | Room detail page (per room type)                                                                       | WEB_ONLY               | `apps/web/src/app/rooms/[roomTypeId]/page.tsx` calls `loadPublicRoomType(roomTypeId)` (`apps/web/src/lib/public-room-catalog.ts`) which **re-fetches the full public catalog** and finds the item by id. There is **no public `GET /api/v1/public/room-types/:id`** controller or repository entry point. The DB → contract → controller pipeline for a dedicated detail is **not implemented**. The `/rooms/:roomTypeId` UI shell exists and is wired, but it is filtered from the existing list endpoint.                                                                                                                                                                                                                                                                                  |
| 6   | All eligible plans (room detail → plans list)                                                          | IMPLEMENTED_END_TO_END | `RoomDetailQuoteAction` (`apps/web/src/components/room-detail-quote-action.tsx`) → `publicApi.eligibleOffers` → `POST /api/v1/quotes/offers` → `QuoteController.eligibleOffers` → `QuoteService.eligibleOffers` returning `availabilityOfferResponseSchema.items[]` (`planCode`, `planLabel`, `includedDurationMinutes`, `extraUnits`, `totalAmountVnd`, `minCheckInMinuteInclusive`, `maxCheckInMinuteExclusive`). Validation rejects `EXTRA_HOUR` as a standalone room package and rejects ineligible selected plans.                                                                                                                                                                                                                                                                      |
| 7   | Voucher preview (input code, see discount before commit)                                               | PARTIAL                | No standalone `POST /public/coupons/preview` exists. The only path that returns a discount preview is the quote-creation path: `QuoteService.issue` calls `CouponRepository.evaluateForQuote` (`apps/api/src/pricing/coupon.repository.ts`) which validates and produces a `ProvisionalCouponEvaluation` (gross / discount / final), serialized in `quoteSchema.coupon`. The recommendation endpoint (`POST /api/v1/recommendations/stay-times`) **also** probes coupons via `ProvisionalCouponProbe` (`apps/api/src/pricing/recommendation.service.ts`), but only when a coupon is part of the request and only as a side effect of an advisory quote-coupled search. There is no pre-quote, code-only, room-independent "what would this voucher give me" surface.                         |
| 8   | Quote create / read                                                                                    | IMPLEMENTED_END_TO_END | `POST /api/v1/quotes` and `GET /api/v1/quotes/{id}` (`apps/api/src/pricing/quote.controller.ts`, `QuoteService.issue`/`get`). `QuoteService.issue` writes a `quotes` row and `coupon_snapshot` JSONB.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 9   | Stay-time recommendation (advisory flexible time)                                                      | IMPLEMENTED_END_TO_END | `POST /api/v1/recommendations/stay-times` (`apps/api/src/pricing/recommendation.controller.ts`) → `recommendationStayTimes` (`apps/api/src/pricing/recommendation.routes.ts`) → `searchRecommendations` (`apps/api/src/pricing/recommendation.service.ts`) walks `-60..+60` minutes in 15-minute steps, probes availability through `RecommendationRepository.isCandidateAvailable` (`apps/api/src/pricing/recommendation.repository.ts`), and probes coupons through `CouponRepository.evaluateForQuote`. Returns at most 3 candidates with category, savings, availability status. The web component `StayTimeRecommendations` renders them. Applying a candidate issues a new quote (the previous quote stays immutable). **This is a quote-coupled advisory, not a no-room pre-flight.** |
| 10  | Contact form (full name, email, phone)                                                                 | IMPLEMENTED_END_TO_END | `apps/web/src/components/quote-contact-form.tsx` validates `PHONE_PATTERN = /^\+[1-9]\d{7,14}$/`, `EMAIL_PATTERN`, and `NAME_PATTERN`. Posts to `POST /api/v1/public/quotes/{quoteId}/bookings` (`apps/api/src/booking/booking-hold.controller.ts`) → `BookingHoldService.issue` → `createBookingHoldWithRetry` (`@room/booking`) which writes a `bookings` row + `booking_contacts` row + inventory block.                                                                                                                                                                                                                                                                                                                                                                                  |
| 11  | HOLD creation                                                                                          | IMPLEMENTED_END_TO_END | `BookingHoldService.issue` returns `BookingHoldResponse` with `bookingId`, `bookingCode`, `status` (`HOLD`), `holdExpiresAt`, amount, currency, idempotent, optional coupon summary. Server-side `BOOKING_HOLD_DURATION_MS` defaults to 900_000 ms. Physical room allocation is **only** performed inside `createBookingHoldWithRetry`. The countdown is informational; HOLD expiry is DB-authoritative.                                                                                                                                                                                                                                                                                                                                                                                     |
| 12  | Payment readiness                                                                                      | IMPLEMENTED_END_TO_END | `GET /api/v1/public/payment-providers` (`apps/api/src/payment/payment-provider.controller.ts`) → `PaymentProviderSettingsService.listPublic` returns `displayName`, `displayOrder`, `checkoutExpiryMinutes`, `maintenanceMessage`, `enabled`, `unavailableReason`. MoMo returns `CONFIGURATION_REQUIRED` when credentials are absent; VNPAY reflects its environment. Web `bookingApi.listPaymentProviders` consumes it.                                                                                                                                                                                                                                                                                                                                                                     |
| 13  | Payment initiation (provider attempts)                                                                 | IMPLEMENTED_END_TO_END | `POST /api/v1/public/bookings/{bookingCode}/payments/momo/attempts` and `POST /api/v1/public/bookings/{bookingCode}/payments/vnpay/attempts` (`apps/api/src/payment/momo-payment.controller.ts`, `apps/api/src/payment/vnpay-payment.controller.ts`) return `{paymentId, paymentAttemptId, provider, status: 'PENDING', redirectUrl, expiresAt}`. Idempotency key header is honored.                                                                                                                                                                                                                                                                                                                                                                                                         |
| 14  | Payment status read-back                                                                               | IMPLEMENTED_END_TO_END | `GET /api/v1/public/bookings/{bookingCode}/payment` (`apps/api/src/payment/payment-status.controller.ts`) requires the `rm_guest_session_v1` cookie. Returns `PaymentStatusResponse` with the authoritative status.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 15  | Payment provider webhooks                                                                              | IMPLEMENTED_END_TO_END | `POST /api/v1/webhooks/momo` and `POST /api/v1/webhooks/vnpay` (`apps/api/src/payment/momo-webhook.controller.ts`, `apps/api/src/payment/vnpay-webhook.controller.ts`) verify provider signatures; `payment_provider_events` table is authoritative with a unique per-provider `(provider, event_key)` constraint. Webhook processing is the only settlement path; payment-return routes are non-settling.                                                                                                                                                                                                                                                                                                                                                                                   |
| 16  | Customer account (login, profile, settings, claim booking)                                             | IMPLEMENTED_END_TO_END | Better Auth–owned `POST /api/auth/*` (`apps/api/src/auth/auth.controller.ts`, allowlisted). `GET/POST /api/v1/customer/profile`, `GET /api/v1/customer/profile/session` (`apps/api/src/customer/customer-profile.controller.ts`). `GET /api/v1/customer/bookings`, `GET /api/v1/customer/bookings/{bookingCode}`, `POST /api/v1/customer/bookings/{bookingCode}/claim` (`apps/api/src/customer/customer-bookings.controller.ts`, `claim-booking.controller.ts`).                                                                                                                                                                                                                                                                                                                             |
| 17  | Guest OTP access (manage booking)                                                                      | IMPLEMENTED_END_TO_END | `POST /api/v1/public/guest-access/otp/request`, `POST /api/v1/public/guest-access/otp/verify`, `POST /api/v1/public/guest-access/logout` (`apps/api/src/booking/guest-access-otp.controller.ts`, `guest-access-logout.controller.ts`). IP and email digests are stored as 32-byte `bytea`; `rm_guest_session_v1` cookie is set on verify.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 18  | ADMIN room catalog (list/create/archive room types, rooms, amenities, tiers, maintenance)              | IMPLEMENTED_END_TO_END | `CatalogController` (`apps/api/src/catalog/catalog.controller.ts`) exposes 18 admin endpoints behind `AdminPermissionGuard` (`apps/api/src/auth/admin-permission.guard.ts`) with permissions `catalog.property.read/manage`, `catalog.price_tier.read/manage`, `catalog.room_type.read/manage`, `catalog.amenity.read/manage`, `catalog.room.read/manage`, `catalog.maintenance.read/manage`. All write paths produce `audit_events` (`PROPERTY_UPDATED`, `PRICE_TIER_CREATED`, `ROOM_TYPE_CREATED`, `ROOM_TYPE_AMENITY_ASSIGNED`, `ROOM_CREATED`, `ROOM_HOUSEKEEPING_UPDATED`, `MAINTENANCE_CREATED`, `MAINTENANCE_CANCELLED`, etc.).                                                                                                                                                       |
| 19  | ADMIN pricing catalog (rate plans: list/create/activate/inactivate/update price/update selection rule) | IMPLEMENTED_END_TO_END | `RatePlanController` (`apps/api/src/pricing/rate-plan.controller.ts`) behind `pricing.rate_plan.read`/`pricing.rate_plan.manage`. `RatePlanService` (`apps/api/src/pricing/rate-plan.service.ts`) is fully backed by the PostgreSQL `rate_plans` and `rate_plan_prices` tables. Admin UI `apps/web/src/components/rate-plan-manager.tsx` is wired.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 20  | ADMIN coupons (list/create/get/disable)                                                                | IMPLEMENTED_END_TO_END | `CouponController` (`apps/api/src/coupons/coupon.controller.ts`) behind `coupon.read`/`coupon.manage`. Admin UI `coupon-list.tsx`, `coupon-form.tsx`, `coupon-detail.tsx`. There is **no admin "edit coupon" endpoint** — coupons are immutable post-create except for `disable`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 21  | ADMIN payment providers (list/update)                                                                  | IMPLEMENTED_END_TO_END | `AdminPaymentProviderController` (`apps/api/src/payment/admin-payment-provider.controller.ts`) behind `catalog.property.manage` (permission inheritance is intentional, not a misroute). Updates `payment_provider_settings` only — merchant credentials remain environment-owned.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 22  | ADMIN booking operations (list/detail/cancel/check-in/check-out/no-show)                               | IMPLEMENTED_END_TO_END | `AdminBookingOperationsController` (`apps/api/src/booking/admin-booking-operations.controller.ts`) behind `booking.lifecycle.read`/`booking.lifecycle.manage`. Admin UI `apps/web/src/app/admin/bookings/page.tsx` and `[bookingCode]/page.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 23  | ADMIN operational reviews (paid-cancellation triage)                                                   | IMPLEMENTED_END_TO_END | Same controller, `booking.review.read`/`booking.review.manage`. The schema only allows `PAID_CANCELLATION` (`operationalReviewCategory` enum).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 24  | ADMIN room operations board + operational report                                                       | IMPLEMENTED_END_TO_END | `apps/api/src/booking/room-operations.controller.ts` (`/admin/room-operations`), `apps/api/src/reporting/admin-operational-report.controller.ts` (`/admin/operational-report`). Both behind admin permissions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 25  | Admin send-coupon-to-booking (delivery request queue)                                                  | IMPLEMENTED_END_TO_END | `POST /api/v1/admin/bookings/{bookingCode}/send-coupons` requires both `booking.lifecycle.manage` and `coupon.manage`. Uses idempotency key. Writes to `coupon_delivery_requests` (status `PENDING` → `SENT`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 26  | Optional: nearby room/time suggestions when exact availability is empty                                | NEW_PRODUCT_FEATURE    | See §6 — verdict `NEARBY_AVAILABILITY=MISSING_NEW_FEATURE`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

---

## 3. Database column matrices

Per column: `COLUMN`, `TYPE`, `NULLABLE`, `DEFAULT`, `CONSTRAINT`, `OWNER`,
`ADMIN_EDITABLE`, `PUBLICLY_EXPOSED`, `USED_BY_AVAILABILITY`,
`USED_BY_PRICING`, `USED_BY_ROOM_DETAIL`. All schema references below are from
`packages/database/src/schema.ts` unless otherwise noted.

### 3.1 `properties`

| COLUMN     | TYPE                | NULL | DEFAULT              | CONSTRAINT                            | OWNER | ADMIN_EDIT                                                                                                                                               | PUBLIC                             | AVAIL                                                                                                               | PRICING | ROOM_DETAIL |
| ---------- | ------------------- | ---- | -------------------- | ------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------- | ----------- |
| id         | uuid PK             | no   | defaultRandom        | —                                     | DB    | no (DB-managed)                                                                                                                                          | no                                 | n/a                                                                                                                 | n/a     | n/a         |
| code       | text                | no   | —                    | nonempty; unique `properties_code_uq` | DB    | yes (`PATCH /admin/property`)                                                                                                                            | yes (`propertySchema` includes it) | yes (selected by code via `PropertyContextService`)                                                                 | yes     | yes         |
| name       | text                | no   | —                    | nonempty                              | DB    | yes                                                                                                                                                      | yes                                | yes                                                                                                                 | yes     | yes         |
| timezone   | text                | no   | `'Asia/Ho_Chi_Minh'` | —                                     | DB    | **no** (not in `propertyCommandSchema` → no admin endpoint)                                                                                              | yes                                | yes                                                                                                                 | yes     | yes         |
| status     | catalog_status enum | no   | `'ACTIVE'`           | —                                     | DB    | **partial** — only via `PATCH /admin/property` body, but `propertyCommandSchema` does **not** include `status`. Status is effectively write-only by SQL. | yes                                | yes (`status='ACTIVE'` filter in `AvailabilityRepository`, `PublicRoomCatalogRepository`, `PropertyContextService`) | yes     | yes         |
| created_at | timestamptz         | no   | now                  | —                                     | DB    | no                                                                                                                                                       | yes                                | yes                                                                                                                 | yes     | yes         |
| updated_at | timestamptz         | no   | now                  | —                                     | DB    | no                                                                                                                                                       | yes                                | yes                                                                                                                 | yes     | yes         |

### 3.2 `room_types`

| COLUMN                  | TYPE           | NULL | DEFAULT       | CONSTRAINT                                                                                                                                            | OWNER | ADMIN_EDIT                                                                                                                    | PUBLIC                                                                | AVAIL                                                               | PRICING                               | ROOM_DETAIL |
| ----------------------- | -------------- | ---- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------- | ----------- |
| id                      | uuid PK        | no   | defaultRandom | —                                                                                                                                                     | DB    | no                                                                                                                            | yes (`publicRoomTypeSchema.id`)                                       | yes                                                                 | yes                                   | yes         |
| property_id             | uuid FK        | no   | —             | `room_types_property_fk`                                                                                                                              | DB    | no (derived from `PropertyContextService`)                                                                                    | no                                                                    | yes                                                                 | yes                                   | yes         |
| price_tier_id           | uuid FK        | no   | —             | composite FK `room_types_property_price_tier_fk` (`property_id`, `price_tier_id`) → `price_tiers`; check via `unique('room_types_property_id_id_uq')` | DB    | **partial** — required on create (`POST /admin/room-types`); no dedicated PATCH endpoint to retier; only archive is available | no                                                                    | yes                                                                 | yes (used to look up `priceTierCode`) | yes         |
| code                    | text           | no   | —             | nonempty; unique `room_types_property_code_uq`                                                                                                        | DB    | yes (set on create)                                                                                                           | no (only `id`/`name`/`description`/`capacity`/`amenities` are public) | yes                                                                 | yes                                   | yes         |
| name                    | text           | no   | —             | nonempty                                                                                                                                              | DB    | yes                                                                                                                           | yes                                                                   | yes                                                                 | yes                                   | yes         |
| description             | text           | yes  | `null`        | —                                                                                                                                                     | DB    | yes (`roomTypeCommandSchema.description` optional, ≤ 2 000)                                                                   | yes (`publicRoomTypeSchema.description`)                              | no                                                                  | no                                    | yes         |
| max_adults              | int            | no   | —             | check `room_types_capacity_ck` (≥ 1)                                                                                                                  | DB    | yes                                                                                                                           | yes (`maxAdults`)                                                     | yes (occupancy filter)                                              | no                                    | yes         |
| max_children            | int            | no   | `0`           | check (≥ 0)                                                                                                                                           | DB    | yes (default 0)                                                                                                               | yes (`maxChildren`)                                                   | yes                                                                 | no                                    | yes         |
| max_occupancy           | int            | no   | —             | check (≥ maxAdults and ≤ maxAdults+maxChildren)                                                                                                       | DB    | yes                                                                                                                           | yes (`maxOccupancy`)                                                  | yes                                                                 | no                                    | yes         |
| status                  | catalog_status | no   | `'ACTIVE'`    | —                                                                                                                                                     | DB    | **partial** — `POST /admin/room-types/:id/archive` flips to `INACTIVE`; no general PATCH; create defaults to ACTIVE           | no                                                                    | yes (filtered `status='ACTIVE'` in public catalog and availability) | yes                                   | yes         |
| created_at / updated_at | timestamptz    | no   | now           | —                                                                                                                                                     | DB    | no                                                                                                                            | yes                                                                   | yes                                                                 | yes                                   | yes         |

### 3.3 `rooms`

| COLUMN                  | TYPE                     | NULL | DEFAULT       | CONSTRAINT                                                                      | OWNER | ADMIN_EDIT                                                                                          | PUBLIC                                                    | AVAIL                                                                            | PRICING | ROOM_DETAIL        |
| ----------------------- | ------------------------ | ---- | ------------- | ------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- | ------- | ------------------ |
| id                      | uuid PK                  | no   | defaultRandom | `unique('rooms_property_id_uq')` and `unique('rooms_property_room_type_id_uq')` | DB    | no                                                                                                  | **no** (public catalog never returns room ids or numbers) | yes (id used only as a join blocker)                                             | no      | no                 |
| property_id             | uuid FK                  | no   | —             | `rooms_property_fk`                                                             | DB    | no                                                                                                  | no                                                        | yes                                                                              | yes     | yes (composite FK) |
| room_type_id            | uuid FK                  | no   | —             | `rooms_property_room_type_fk` composite FK; unique with `(property_id, id)`     | DB    | no (set on create only)                                                                             | no                                                        | yes                                                                              | no      | yes                |
| room_number             | text                     | no   | —             | nonempty; unique `rooms_property_room_number_uq`                                | DB    | yes (set on create; `PATCH /admin/rooms/:id/housekeeping` does not change it)                       | no                                                        | no (filtered to ACTIVE only)                                                     | no      | no                 |
| status                  | room_status enum         | no   | `'ACTIVE'`    | —                                                                               | DB    | **partial** — set on create; `POST /admin/rooms/:id/archive` flips to `INACTIVE`. No general PATCH. | no                                                        | yes (filtered `status='ACTIVE'`)                                                 | no      | no                 |
| housekeeping_status     | housekeeping_status enum | no   | `'CLEAN'`     | —                                                                               | DB    | yes (`PATCH /admin/rooms/:id/housekeeping`)                                                         | no                                                        | no (does not affect availability computation in `AvailabilityRepository.search`) | no      | no                 |
| created_at / updated_at | timestamptz              | no   | now           | —                                                                               | DB    | no                                                                                                  | no                                                        | yes (audit)                                                                      | no      | no                 |

**Important**: `rooms.housekeeping_status` is editable but the
`AvailabilityRepository.search` does **not** filter on it; only ACTIVE rooms are
counted. Housekeeping state is operational, not availability-binding.

### 3.4 `amenities`

| COLUMN                  | TYPE           | NULL | DEFAULT       | CONSTRAINT                    | OWNER | ADMIN_EDIT                          | PUBLIC                               | AVAIL          | PRICING | ROOM_DETAIL |
| ----------------------- | -------------- | ---- | ------------- | ----------------------------- | ----- | ----------------------------------- | ------------------------------------ | -------------- | ------- | ----------- |
| id                      | uuid PK        | no   | defaultRandom | unique per property           | DB    | no                                  | yes (`publicRoomAmenitySchema.name`) | yes            | no      | yes         |
| property_id             | uuid FK        | no   | —             | `amenities_property_fk`       | DB    | no                                  | no                                   | yes            | no      | yes         |
| code                    | text           | no   | —             | nonempty; unique per property | DB    | yes                                 | no                                   | yes            | no      | no          |
| name                    | text           | no   | —             | nonempty                      | DB    | yes                                 | yes                                  | yes            | no      | yes         |
| status                  | catalog_status | no   | `'ACTIVE'`    | —                             | DB    | **partial** — archive endpoint only | no                                   | yes (filtered) | no      | yes         |
| created_at / updated_at | timestamptz    | no   | now           | —                             | DB    | no                                  | no                                   | yes            | no      | yes         |

### 3.5 `room_type_amenities` (join)

`property_id`, `room_type_id`, `amenity_id`, `created_at`. Composite PK and
three composite FKs (property, room_type, amenity). Membership is created by
`POST /admin/room-types/:id/amenities` (idempotent `onConflictDoNothing`).
Membership removal is **not** exposed; only archive of room type or amenity
removes the visible association.

### 3.6 `price_tiers`

`id` (uuid PK), `property_id`, `code`, `name`, `sort_order` (default 0),
`status`, `created_at`, `updated_at`. Composite FK `price_tiers_property_fk`

- unique `(property_id, id)` + unique `(property_id, code)`. Two
  check constraints: `sort_order ≥ 0`, `code` nonempty, `name` nonempty.

ADMIN exposes GET / POST / PATCH / archive. Admin UI is
`apps/web/src/components/price-tier-manager.tsx`. There is **no public
exposure** of `price_tiers` (the schema and code base never serialise them in
public responses). The current property's `price_tier.code` is used
internally by `AvailabilityRepository` and `RecommendationRepository` to look
up rates.

### 3.7 `rate_plans`

`id`, `property_id`, `code`, `name`, `status` (`DRAFT|ACTIVE|INACTIVE`),
`included_duration_minutes`, `priority`, `is_base_plan`, optional
`min_check_in_minute_inclusive` / `max_check_in_minute_exclusive`, optional
`min_duration_minutes_inclusive` / `max_duration_minutes_inclusive`,
`source_evidence`, `created_at`, `updated_at`.

The 12+ SQL check constraints encode: code format `^[A-Z0-9_]{1,64}$`,
duration 60–1440 minutes in 15-minute increments, priority 0–1000,
`EXTRA_HOUR` must be non-base-plan, check-in window pair-or-both-null,
check-in window in 0..1425/15..1440 step 15, min < max, no cross-midnight
range, base plan requires a duration window, non-base plan must have no
selection window.

Admin exposes GET, POST (create), PATCH `:id/selection-rule`, PATCH/PUT
`:id/prices/:priceTierId`, POST `:id/activate`, POST `:id/inactivate`.
Rate plans are publicly consumed via `rate_plan_prices` joined with
`price_tiers`; the codes are exposed through `availabilityOfferSummarySchema`
(`planLabel`, which is `plan.name`, **not** `plan.code`) and through
`availabilityEligibleOfferSchema.planCode`.

### 3.8 `rate_plan_prices`

`id`, `property_id`, `rate_plan_id`, `price_tier_id`, `amount_vnd` (bigint,
`> 0`), `currency` (`'VND'`), `created_at`, `updated_at`. Composite FKs on
property + (plan, tier). Unique `(rate_plan_id, price_tier_id)`.

Public exposure: yes, indirectly through `availabilitySearchResponseSchema`
(items include authoritative `offer.amountVnd`) and `quoteSchema.pricing`
(line items).

ADMIN mutation: PATCH `:id/prices/:priceTierId` (`rate_plan_price_commandSchema`).
No POST/PUT for tier re-allocation.

### 3.9 `maintenance_blocks`

`id`, `property_id`, `room_id`, `starts_at`, `ends_at`, `reason`,
`status` (`ACTIVE|CANCELLED`), `cancelled_at`, `created_at`, `updated_at`.
Composite FK on `(property_id, room_id)`. CHECK `ends_at > starts_at`.

`POST /admin/maintenance-blocks` creates both the `maintenance_blocks` row
**and** a `room_inventory_blocks` row (`blockType='MAINTENANCE'`). Cancel
flips both to `RELEASED`/`CANCELLED`. Cancellation **does not** delete the
rows; it only marks them.

Public exposure: no direct serialization; maintenance blocks are filtered
into `room_inventory_blocks` which `AvailabilityRepository` uses to compute
`blockedRoomIds`.

### 3.10 `room_inventory_blocks`

`id`, `property_id`, `room_id`, `booking_id` (nullable), `maintenance_block_id`
(nullable), `block_type` (`BOOKING|MAINTENANCE`), `status` (`ACTIVE|RELEASED`),
`starts_at`, `ends_at`, `released_at`, `created_at`. CHECK `source_ck`
ensures a BOOKING row has `booking_id` and `MAINTENANCE` row has
`maintenance_block_id` (and the corresponding other is null). Unique per
`booking_id` and per `maintenance_block_id`.

This table is the single source of truth for occupancy contention during the
booking interval — `AvailabilityRepository.search` and
`RecommendationRepository.isCandidateAvailable` both filter on
`status='ACTIVE'` AND `starts_at < checkOut` AND `ends_at > checkIn`.

### 3.11 `coupons`

`id`, `property_id`, `normalized_code` (`^[A-Z0-9-]{4,32}$`, uppercased),
`status` (`ACTIVE|DISABLED`), `discount_type` (`FIXED|PERCENTAGE`),
`fixed_amount_vnd` (nullable bigint), `percentage_basis_points` (1..10000),
`maximum_discount_vnd` (nullable bigint, `> 0`),
`minimum_order_amount_vnd` (bigint, `>= 0`, default `0`),
`valid_from`, `valid_until`, `applies_to_all_room_types` (boolean),
`total_usage_limit` (nullable), `per_customer_limit` (nullable),
`first_referenced_at` (nullable), `disabled_at` (nullable), `created_at`,
`updated_at`.

CHECK `discount_shape_ck` enforces FIXED-shape vs PERCENTAGE-shape
non-overlap. CHECK `coupons_disabled_at_ck` enforces
`status='ACTIVE' ↔ disabled_at IS NULL`.

ADMIN exposes `GET /admin/coupons`, `GET /admin/coupons/:id`, `POST
/admin/coupons` (`adminCouponCreateSchema` discriminated union by
`discountType`), `POST /admin/coupons/:id/disable`. **No edit endpoint** —
the coupon row is intentionally immutable post-create.

Public exposure: **no**. There is no public `GET /api/v1/public/coupons`,
`POST /api/v1/public/coupons/preview`, or similar. The only public surface
that exercises coupons is `createQuoteRequestSchema.couponCode` and
`recommendationRequestSchema.couponCode`.

### 3.12 `coupon_room_types` (join)

`property_id`, `coupon_id`, `room_type_id`, `created_at`. PK
`(coupon_id, room_type_id)`. FKs are composite (property-bound) so the join
inherits the property context. Read by
`CouponRepository.evaluateForQuote` to gate `appliesToAllRoomTypes = false`.

---

## 4. ADMIN configuration matrix

For each room-related column or surface: `DB_COLUMN` / `SURFACE`,
`SHARED_CONTRACT`, `ADMIN_GET_API`, `ADMIN_MUTATION_API`,
`ADMIN_FORM_CONTROL`, `AUDIT_EVENT`, `PUBLIC_API`, `PUBLIC_WEB`. Status
classification:
`FULLY_CONFIGURABLE`, `API_ONLY`, `DB_ONLY`, `STATIC_WEB_CONTENT`, `MISSING`.

### 4.1 Property

| Surface    | Shared contract         | ADMIN GET                             | ADMIN MUTATION                          | ADMIN form                                    | Audit event        | Public API                      | Public web                                                                                                                   | Status                          |
| ---------- | ----------------------- | ------------------------------------- | --------------------------------------- | --------------------------------------------- | ------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `code`     | `propertySchema`        | `GET /admin/property` (`getProperty`) | `PATCH /admin/property`                 | `apps/web/src/components/property-editor.tsx` | `PROPERTY_UPDATED` | n/a                             | n/a (only via public catalog for property selection; `PropertyContextService.getCurrent` returns `code`, `name`, `timezone`) | FULLY_CONFIGURABLE              |
| `name`     | `propertySchema`        | same                                  | same                                    | same                                          | `PROPERTY_UPDATED` | n/a                             | same as `code`                                                                                                               | FULLY_CONFIGURABLE              |
| `timezone` | `propertySchema`        | same                                  | **no** (not in `propertyCommandSchema`) | —                                             | —                  | n/a                             | yes (returned via catalog availability)                                                                                      | API_ONLY (no mutation path)     |
| `status`   | `propertySchema.status` | returned but not exposed in admin UI  | **no**                                  | —                                             | —                  | implicit (filtered server-side) | yes (filtered server-side)                                                                                                   | DB_ONLY (read-only effectively) |

### 4.2 Price tiers

| Surface                      | Shared contract                             | ADMIN GET                | ADMIN MUTATION                                                                                   | ADMIN form                                       | Audit event                                                       | Public API | Public web                                                                | Status             |
| ---------------------------- | ------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ----------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------- | ------------------ |
| `code`, `name`, `sort_order` | `priceTierSchema`, `priceTierCommandSchema` | `GET /admin/price-tiers` | `POST /admin/price-tiers`, `PATCH /admin/price-tiers/:id`, `POST /admin/price-tiers/:id/archive` | `apps/web/src/components/price-tier-manager.tsx` | `PRICE_TIER_CREATED`, `PRICE_TIER_UPDATED`, `PRICE_TIER_ARCHIVED` | n/a        | none (used internally by `AvailabilityRepository` to compose the catalog) | FULLY_CONFIGURABLE |

### 4.3 Room types

| Surface                                       | Shared contract                           | ADMIN GET                                                         | ADMIN MUTATION                         | ADMIN form                                                    | Audit event                  | Public API | Public web                                                                               | Status                                                                    |
| --------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------- | ---------------------------- | ---------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `code`, `name`, `price_tier_id`               | `roomTypeSchema`, `roomTypeCommandSchema` | `GET /admin/room-types`                                           | `POST /admin/room-types` (create)      | `apps/web/src/components/room-type-manager.tsx` (create form) | `ROOM_TYPE_CREATED`          | n/a        | `GET /api/v1/public/room-types` returns `id`, `name`, `description`, capacity, amenities | FULLY_CONFIGURABLE (create only; no edit / update name / update tier)     |
| `description`                                 | `roomTypeSchema` (nullable)               | same                                                              | same                                   | (no description input in `room-type-manager`)                 | same                         | n/a        | yes (returned by public catalog)                                                         | API_ONLY                                                                  |
| `max_adults`, `max_children`, `max_occupancy` | same                                      | same                                                              | same                                   | hard-coded `2/0/2` in current admin UI                        | same                         | n/a        | yes                                                                                      | PARTIAL — API supports the field set, but admin form hard-codes capacity. |
| `status` (archive only)                       | n/a                                       | n/a                                                               | `POST /admin/room-types/:id/archive`   | yes                                                           | `ROOM_TYPE_ARCHIVED`         | filtered   | filtered                                                                                 | FULLY_CONFIGURABLE (archive only)                                         |
| `room_type_amenities` (assign amenity)        | `assignAmenityCommandSchema`              | implicit (read via `room_types.id` → amenities in public catalog) | `POST /admin/room-types/:id/amenities` | yes                                                           | `ROOM_TYPE_AMENITY_ASSIGNED` | n/a        | yes (joined by `public-room-catalog`)                                                    | FULLY_CONFIGURABLE (assign only; **removal missing**)                     |

### 4.4 Rooms

| Surface                       | Shared contract                               | ADMIN GET          | ADMIN MUTATION                        | ADMIN form                                                                                          | Audit event                 | Public API | Public web                                   | Status                                                               |
| ----------------------------- | --------------------------------------------- | ------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------- | ---------- | -------------------------------------------- | -------------------------------------------------------------------- |
| `room_number`, `room_type_id` | `roomSchema`, `roomCommandSchema`             | `GET /admin/rooms` | `POST /admin/rooms`                   | `apps/web/src/components/room-creator.tsx` + `apps/web/src/app/admin/rooms/page.tsx` (CatalogTable) | `ROOM_CREATED`              | n/a        | **none** (physical identity is never public) | FULLY_CONFIGURABLE (create only; no edit room number or change type) |
| `status` (archive only)       | n/a                                           | n/a                | `POST /admin/rooms/:id/archive`       | yes                                                                                                 | `ROOM_ARCHIVED`             | n/a        | n/a                                          | FULLY_CONFIGURABLE (archive only)                                    |
| `housekeeping_status`         | `roomSchema`, `roomHousekeepingCommandSchema` | returned in list   | `PATCH /admin/rooms/:id/housekeeping` | yes (`apps/web/src/components/room-housekeeping-manager.tsx`)                                       | `ROOM_HOUSEKEEPING_UPDATED` | n/a        | n/a                                          | FULLY_CONFIGURABLE                                                   |

### 4.5 Amenities

| Surface        | Shared contract                         | ADMIN GET              | ADMIN MUTATION                                               | ADMIN form                                    | Audit event                           | Public API | Public web                                  | Status                                              |
| -------------- | --------------------------------------- | ---------------------- | ------------------------------------------------------------ | --------------------------------------------- | ------------------------------------- | ---------- | ------------------------------------------- | --------------------------------------------------- |
| `code`, `name` | `amenitySchema`, `amenityCommandSchema` | `GET /admin/amenities` | `POST /admin/amenities`, `POST /admin/amenities/:id/archive` | `apps/web/src/components/amenity-manager.tsx` | `AMENITY_CREATED`, `AMENITY_ARCHIVED` | n/a        | yes (joined into public room type response) | FULLY_CONFIGURABLE (create/archive only; no rename) |

### 4.6 Maintenance blocks

| Surface                                     | Shared contract                                           | ADMIN GET                       | ADMIN MUTATION                                                                | ADMIN form                                        | Audit event                                    | Public API | Public web                                         | Status             |
| ------------------------------------------- | --------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------- | ---------- | -------------------------------------------------- | ------------------ |
| `room_id`, `starts_at`, `ends_at`, `reason` | `maintenanceBlockSchema`, `maintenanceBlockCommandSchema` | `GET /admin/maintenance-blocks` | `POST /admin/maintenance-blocks`, `POST /admin/maintenance-blocks/:id/cancel` | `apps/web/src/components/maintenance-manager.tsx` | `MAINTENANCE_CREATED`, `MAINTENANCE_CANCELLED` | n/a        | none (used internally via `room_inventory_blocks`) | FULLY_CONFIGURABLE |

### 4.7 Rate plans and prices

| Surface                                                                                                                                                                                                       | Shared contract                                                                                              | ADMIN GET                               | ADMIN MUTATION                                                                  | ADMIN form                                      | Audit event                                    | Public API                                                          | Public web                                                                             | Status             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------ |
| `code`, `name`, `included_duration_minutes`, `priority`, `is_base_plan`, `min_check_in_minute_inclusive`, `max_check_in_minute_exclusive`, `min_duration_minutes_inclusive`, `max_duration_minutes_inclusive` | `ratePlanSchema`, `selectionRuleSchema`, `ratePlanSelectionRuleCommandSchema`, `ratePlanCreateCommandSchema` | `GET /admin/rate-plans`                 | `POST /admin/rate-plans` (create), `PATCH /admin/rate-plans/:id/selection-rule` | `apps/web/src/components/rate-plan-manager.tsx` | `audit_events` written by `RatePlanService`    | yes (read via `availabilitySearchResponseSchema` and `quoteSchema`) | yes (rendered by `availability-search-results.tsx` and `room-detail-quote-action.tsx`) | FULLY_CONFIGURABLE |
| `amount_vnd` per `(rate_plan, price_tier)`                                                                                                                                                                    | `ratePlanPriceSchema`, `ratePlanPriceCommandSchema`                                                          | returned inside `ratePlanSchema.prices` | `PATCH/PUT /admin/rate-plans/:id/prices/:priceTierId`                           | `rate-plan-manager.tsx` (per-tier input)        | `RATE_PLAN_PRICE_UPDATED`                      | yes                                                                 | yes                                                                                    | FULLY_CONFIGURABLE |
| `status` (`DRAFT/ACTIVE/INACTIVE`)                                                                                                                                                                            | n/a                                                                                                          | returned                                | `POST /admin/rate-plans/:id/activate`, `POST /admin/rate-plans/:id/inactivate`  | `rate-plan-manager.tsx`                         | `RATE_PLAN_ACTIVATED`, `RATE_PLAN_INACTIVATED` | yes (filtered; inactive plans are excluded from candidates)         | yes (UI gates the price edit when `status='INACTIVE'`)                                 | FULLY_CONFIGURABLE |

### 4.8 Coupons

| Surface                                                                                                                                                                                                                                                       | Shared contract                                                   | ADMIN GET                                      | ADMIN MUTATION                    | ADMIN form                                                  | Audit event                                                                                            | Public API                                                   | Public web                                    | Status                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------- | --------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------- |
| Create `code`, `discount_type`, `fixed_amount_vnd` / `percentage_basis_points` / `maximum_discount_vnd`, `minimum_order_amount_vnd`, `valid_from`, `valid_until`, `roomTypes` (`{all:true}` or `{roomTypeIds:[]}`), `total_usage_limit`, `per_customer_limit` | `adminCouponCreateSchema` (discriminated union by `discountType`) | `GET /admin/coupons`, `GET /admin/coupons/:id` | `POST /admin/coupons`             | `coupon-form.tsx` + `coupon-list.tsx` + `coupon-detail.tsx` | (no audit-events writer in `CouponService` for create / disable — to be confirmed in code-level audit) | none (preview is **only** via quote issue or recommendation) | only via quote-issue and recommendation flows | FULLY_CONFIGURABLE for create; **no edit**; disable-only post-create |
| `status` `ACTIVE → DISABLED`                                                                                                                                                                                                                                  | n/a                                                               | returned                                       | `POST /admin/coupons/:id/disable` | yes                                                         | n/a above                                                                                              | implicit (filtered `status='ACTIVE'` in `evaluateForQuote`)  | implicit                                      | FULLY_CONFIGURABLE                                                   |

### 4.9 Payment provider settings

| Surface                                                                                 | Shared contract                                                     | ADMIN GET                      | ADMIN MUTATION                             | ADMIN form                     | Audit event              | Public API                             | Public web                                       | Status                                                                             |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------ | ------------------------------------------ | ------------------------------ | ------------------------ | -------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `enabled`, `displayName`, `displayOrder`, `checkoutExpiryMinutes`, `maintenanceMessage` | not exposed via `@room/contracts` (uses raw type in `admin-api.ts`) | `GET /admin/payment-providers` | `PATCH /admin/payment-providers/:provider` | `payment-provider-manager.tsx` | (none — not implemented) | `GET /api/v1/public/payment-providers` | yes (consumer `bookingApi.listPaymentProviders`) | FULLY_CONFIGURABLE (display side) — merchant credentials remain environment-owned. |

---

## 5. Endpoint and flow matrix

Runtime routes discovered by `node scripts/check-endpoints.mts`:
**80 runtime routes; 76 documented; 4 explicitly allowlisted** (the four
allowlisted are Better Auth framework-owned `GET/POST /api/auth/*` plus
`GET /api/v1/health/live` and `GET /api/v1/health/ready`). The complete CSV
inventory is at `docs/audit/phase-8d/endpoint-inventory.csv`.

Selected runtime endpoints relevant to this audit (METHOD, PATH, AUTH,
REQUEST/RESPONSE contract references, SIDE_EFFECT, CALLER, TEST_COVERAGE):

### 5.1 Public room / availability / pricing

| METHOD | PATH                                 | REQUEST_SCHEMA                                                           | RESPONSE_SCHEMA                                                                     | SIDE_EFFECT                                   | AUTH | CALLER                                                                                    | TEST_COVERAGE            |
| ------ | ------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------- | ---- | ----------------------------------------------------------------------------------------- | ------------------------ |
| GET    | `/api/v1/public/room-types`          | none                                                                     | `publicRoomCatalogResponseSchema` (`packages/contracts/src/public-room-catalog.ts`) | none                                          | none | `apps/web/src/lib/public-room-catalog.ts`                                                 | unit + integration       |
| POST   | `/api/v1/availability/search`        | `availabilitySearchRequestSchema` (= `publicIntervalSchema`)             | `availabilitySearchResponseSchema`                                                  | none                                          | none | `availability-search-results.tsx`, `landing-availability-search.tsx`                      | `pnpm test:availability` |
| POST   | `/api/v1/quotes/offers`              | `availabilityOfferRequestSchema` (`= publicIntervalSchema + roomTypeId`) | `availabilityOfferResponseSchema`                                                   | none (read-only projection)                   | none | `room-detail-quote-action.tsx`                                                            | unit + integration       |
| POST   | `/api/v1/quotes`                     | `createQuoteRequestSchema`                                               | `quoteSchema`                                                                       | **writes** a `quotes` row + `coupon_snapshot` | none | `room-detail-quote-action.tsx`, `stay-time-recommendations.tsx`, `quote-contact-form.tsx` | unit + integration       |
| GET    | `/api/v1/quotes/:id`                 | none                                                                     | `quoteSchema`                                                                       | none                                          | none | `quote-view.tsx`                                                                          | unit                     |
| POST   | `/api/v1/recommendations/stay-times` | `recommendationRequestSchema`                                            | `recommendationResponseSchema`                                                      | none — advisory, read-only                    | none | `stay-time-recommendations.tsx`                                                           | unit + integration       |

### 5.2 Public booking / payment

| METHOD | PATH                                                           | REQUEST_SCHEMA                                                      | RESPONSE_SCHEMA                                                                       | SIDE_EFFECT                                                                                                         | AUTH                                      | CALLER                                          | TEST_COVERAGE      |
| ------ | -------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------- | ------------------ |
| POST   | `/api/v1/public/quotes/:quoteId/bookings`                      | `createBookingHoldRequestSchema` (`contact {fullName,email,phone}`) | `BookingHoldResponse` (`@room/contracts/booking`)                                     | **writes** `bookings`, `booking_contacts`, `room_inventory_blocks(BOOKING)` — physical room allocation happens here | none (cookie optional for CUSTOMER claim) | `quote-contact-form.tsx`                        | integration + e2e  |
| POST   | `/api/v1/public/booking-holds/status`                          | `BookingHoldStatusRequest`                                          | `BookingHoldStatusResponse`                                                           | none                                                                                                                | none                                      | (countdown uses it for DB-authoritative status) | unit               |
| POST   | `/api/v1/public/guest-access/otp/request`                      | `GuestAccessOtpRequest`                                             | `GuestAccessOtpRequestResponse`                                                       | **writes** `guest_otp_challenges` (rate-limited)                                                                    | none                                      | `otp-request-panel.tsx`                         | unit               |
| POST   | `/api/v1/public/guest-access/otp/verify`                       | `GuestAccessOtpVerify`                                              | `GuestAccessOtpVerifyResponse` + `Set-Cookie: rm_guest_session_v1`                    | **writes** `guest_sessions`, consumes challenge                                                                     | none                                      | `otp-verify-panel.tsx`                          | unit + integration |
| POST   | `/api/v1/public/guest-access/logout`                           | empty                                                               | `GuestLogoutResponse`                                                                 | clears cookie + revokes session                                                                                     | none                                      | `booking-detail-panel.tsx`                      | unit               |
| GET    | `/api/v1/public/bookings/:bookingCode`                         | none                                                                | `BookingDetailResponse`                                                               | none                                                                                                                | `rm_guest_session_v1` cookie              | `booking-detail-panel.tsx`                      | integration        |
| GET    | `/api/v1/public/bookings/:bookingCode/payment`                 | none                                                                | `PaymentStatusResponse`                                                               | none                                                                                                                | `rm_guest_session_v1` cookie              | `payment-status-summary.tsx`                    | integration        |
| GET    | `/api/v1/public/payment-providers`                             | none                                                                | `PublicPaymentProvider[]` (`booking-api.ts` runtime validator)                        | none                                                                                                                | none                                      | `payment-provider-selector.tsx`                 | integration        |
| POST   | `/api/v1/public/bookings/:bookingCode/payments/momo/attempts`  | empty body, `idempotency-key` header                                | `{paymentId,paymentAttemptId,provider:'MOMO',status:'PENDING',redirectUrl,expiresAt}` | **writes** `payment_attempts`                                                                                       | `rm_guest_session_v1` cookie              | `payment-status-summary.tsx`                    | integration        |
| POST   | `/api/v1/public/bookings/:bookingCode/payments/vnpay/attempts` | empty body, `idempotency-key` header                                | same as MoMo                                                                          | **writes** `payment_attempts`                                                                                       | same                                      | same                                            | integration        |
| POST   | `/api/v1/webhooks/momo`                                        | MoMo IPN                                                            | `200 OK`                                                                              | **writes** `payment_provider_events` (authoritative)                                                                | MoMo signature                            | provider                                        | integration        |
| POST   | `/api/v1/webhooks/vnpay`                                       | VNPAY IPN                                                           | `200 OK`                                                                              | **writes** `payment_provider_events`                                                                                | VNPAY signature checksum                  | provider                                        | integration        |
| GET    | `/api/v1/payments/providers/momo/return`                       | query                                                               | redirect / state                                                                      | **no settlement** (webhook is authoritative)                                                                        | none                                      | browser                                         | integration        |
| GET    | `/api/v1/payments/providers/vnpay/return`                      | query                                                               | redirect / state                                                                      | **no settlement** (webhook is authoritative)                                                                        | none                                      | browser                                         | integration        |

### 5.3 Customer

| METHOD | PATH                                           | REQUEST_SCHEMA                | RESPONSE_SCHEMA                 | SIDE_EFFECT                                                        | AUTH            | CALLER                           | TEST_COVERAGE |
| ------ | ---------------------------------------------- | ----------------------------- | ------------------------------- | ------------------------------------------------------------------ | --------------- | -------------------------------- | ------------- |
| GET    | `/api/v1/customer/bookings`                    | none                          | `CustomerBookingsListResponse`  | none                                                               | customer cookie | `account/bookings` page          | integration   |
| GET    | `/api/v1/customer/bookings/:bookingCode`       | none                          | `CustomerBookingDetailResponse` | none                                                               | customer cookie | `account/bookings/[bookingCode]` | integration   |
| POST   | `/api/v1/customer/bookings/:bookingCode/claim` | none                          | `CustomerBookingClaimResponse`  | **binds** booking to customer (`bookings.customer_user_id`)        | customer cookie | `account/bookings/[bookingCode]` | integration   |
| GET    | `/api/v1/customer/profile`                     | none                          | `CustomerProfileResponse`       | none                                                               | customer cookie | `account/profile`                | integration   |
| GET    | `/api/v1/customer/profile/session`             | none                          | `CustomerProfileSession`        | none                                                               | customer cookie | `account/profile`                | integration   |
| PATCH  | `/api/v1/customer/profile`                     | `customerProfileUpdateSchema` | `CustomerProfileResponse`       | **writes** `customer_profiles`                                     | customer cookie | `account/profile`                | integration   |
| POST   | `/api/auth/*` (Better Auth)                    | framework-owned               | framework-owned                 | **writes** `users`, `sessions`, `accounts`, `verification_records` | framework       | `login`, account flow            | integration   |

### 5.4 Admin catalog / pricing / coupon / payment / bookings / reviews

All routes below are behind `AdminPermissionGuard`
(`apps/api/src/auth/admin-permission.guard.ts`). Permissions catalogued in
`packages/auth/src/permissions.ts`:

`catalog.property.read|manage`, `catalog.price_tier.read|manage`,
`catalog.room_type.read|manage`, `catalog.amenity.read|manage`,
`catalog.room.read|manage`, `catalog.maintenance.read|manage`,
`coupon.read|manage`, `pricing.rate_plan.read|manage`,
`booking.lifecycle.read|manage`, `booking.review.read|manage`.

| METHOD      | PATH                                                  | PERMISSION                                          | REQUEST_SCHEMA                                               | RESPONSE_SCHEMA                        | SIDE_EFFECT                                                                 | CALLER                                                   |
| ----------- | ----------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| GET         | `/api/v1/admin/me`                                    | (admin guard)                                       | none                                                         | `adminMeSchema`                        | none                                                                        | `admin-access-guard.tsx`                                 |
| GET         | `/api/v1/admin/property`                              | `catalog.property.read`                             | none                                                         | `propertySchema`                       | none                                                                        | `property-editor.tsx`                                    |
| PATCH       | `/api/v1/admin/property`                              | `catalog.property.manage`                           | `propertyCommandSchema`                                      | `propertySchema`                       | updates `properties.code/name` + audit                                      | same                                                     |
| GET         | `/api/v1/admin/price-tiers`                           | `catalog.price_tier.read`                           | `paginationQuerySchema`                                      | paginated `priceTierSchema[]`          | none                                                                        | `price-tier-manager.tsx`                                 |
| POST        | `/api/v1/admin/price-tiers`                           | `catalog.price_tier.manage`                         | `priceTierCommandSchema`                                     | `priceTierSchema`                      | inserts + audit                                                             | same                                                     |
| PATCH       | `/api/v1/admin/price-tiers/:id`                       | same                                                | same                                                         | same                                   | updates + audit                                                             | same                                                     |
| POST        | `/api/v1/admin/price-tiers/:id/archive`               | same                                                | `archiveCommandSchema`                                       | same                                   | updates status to INACTIVE + audit                                          | same                                                     |
| GET         | `/api/v1/admin/room-types`                            | `catalog.room_type.read`                            | pagination                                                   | paginated `roomTypeSchema[]`           | none                                                                        | `room-type-manager.tsx`                                  |
| POST        | `/api/v1/admin/room-types`                            | `catalog.room_type.manage`                          | `roomTypeCommandSchema`                                      | `roomTypeSchema`                       | inserts + audit                                                             | same                                                     |
| POST        | `/api/v1/admin/room-types/:id/archive`                | same                                                | `archiveCommandSchema`                                       | same                                   | updates + audit                                                             | same                                                     |
| POST        | `/api/v1/admin/room-types/:id/amenities`              | same                                                | `assignAmenityCommandSchema`                                 | none                                   | upsert into `room_type_amenities` + audit                                   | same                                                     |
| GET         | `/api/v1/admin/amenities`                             | `catalog.amenity.read`                              | pagination                                                   | paginated `amenitySchema[]`            | none                                                                        | `amenity-manager.tsx`                                    |
| POST        | `/api/v1/admin/amenities`                             | `catalog.amenity.manage`                            | `amenityCommandSchema`                                       | `amenitySchema`                        | inserts + audit                                                             | same                                                     |
| POST        | `/api/v1/admin/amenities/:id/archive`                 | same                                                | `archiveCommandSchema`                                       | same                                   | updates + audit                                                             | same                                                     |
| GET         | `/api/v1/admin/rooms`                                 | `catalog.room.read`                                 | pagination                                                   | paginated `roomSchema[]`               | none                                                                        | `apps/web/src/app/admin/rooms/page.tsx`                  |
| POST        | `/api/v1/admin/rooms`                                 | `catalog.room.manage`                               | `roomCommandSchema`                                          | `roomSchema`                           | inserts + audit                                                             | same                                                     |
| POST        | `/api/v1/admin/rooms/:id/archive`                     | same                                                | `archiveCommandSchema`                                       | same                                   | updates + audit                                                             | same                                                     |
| PATCH       | `/api/v1/admin/rooms/:id/housekeeping`                | same                                                | `roomHousekeepingCommandSchema`                              | `roomSchema`                           | updates `housekeeping_status` + audit                                       | `room-housekeeping-manager.tsx`                          |
| GET         | `/api/v1/admin/maintenance-blocks`                    | `catalog.maintenance.read`                          | pagination                                                   | paginated `maintenanceBlockSchema[]`   | none                                                                        | `maintenance-manager.tsx`                                |
| POST        | `/api/v1/admin/maintenance-blocks`                    | `catalog.maintenance.manage`                        | `maintenanceBlockCommandSchema`                              | `maintenanceBlockSchema`               | inserts `maintenance_blocks` + `room_inventory_blocks(MAINTENANCE)` + audit | same                                                     |
| POST        | `/api/v1/admin/maintenance-blocks/:id/cancel`         | same                                                | none                                                         | `maintenanceBlockSchema`               | cancels block + releases `room_inventory_blocks` + audit                    | same                                                     |
| GET         | `/api/v1/admin/rate-plans`                            | `pricing.rate_plan.read`                            | none                                                         | `{items: ratePlanSchema[]}`            | none                                                                        | `rate-plan-manager.tsx`                                  |
| POST        | `/api/v1/admin/rate-plans`                            | `pricing.rate_plan.manage`                          | `ratePlanCreateCommandSchema`                                | `ratePlanSchema`                       | inserts + audit                                                             | same                                                     |
| PATCH       | `/api/v1/admin/rate-plans/:id/selection-rule`         | same                                                | `ratePlanSelectionRuleCommandSchema`                         | `ratePlanSchema`                       | updates selection rule + audit                                              | same                                                     |
| PATCH / PUT | `/api/v1/admin/rate-plans/:id/prices/:priceTierId`    | same                                                | `ratePlanPriceCommandSchema`                                 | none (upsert)                          | updates `rate_plan_prices.amount_vnd` + audit                               | same                                                     |
| POST        | `/api/v1/admin/rate-plans/:id/activate`               | same                                                | `ratePlanActivationSchema`                                   | `ratePlanSchema`                       | updates status to ACTIVE + audit                                            | same                                                     |
| POST        | `/api/v1/admin/rate-plans/:id/inactivate`             | same                                                | none                                                         | `ratePlanSchema`                       | updates status to INACTIVE + audit                                          | same                                                     |
| GET         | `/api/v1/admin/coupons`                               | `coupon.read`                                       | pagination                                                   | paginated `couponSchema[]`             | none                                                                        | `coupon-list.tsx`                                        |
| GET         | `/api/v1/admin/coupons/:id`                           | same                                                | none                                                         | `couponSchema`                         | none                                                                        | `coupon-detail.tsx`                                      |
| POST        | `/api/v1/admin/coupons`                               | `coupon.manage`                                     | `adminCouponCreateSchema` (discriminated)                    | `couponSchema`                         | inserts `coupons` + `coupon_room_types` + counts                            | `coupon-form.tsx`                                        |
| POST        | `/api/v1/admin/coupons/:id/disable`                   | same                                                | none                                                         | `couponSchema`                         | updates status to DISABLED + `disabled_at`                                  | same                                                     |
| GET         | `/api/v1/admin/payment-providers`                     | `catalog.property.manage` (intentional inheritance) | none                                                         | `PaymentProviderAdmin[]`               | none                                                                        | `payment-provider-manager.tsx`                           |
| PATCH       | `/api/v1/admin/payment-providers/:provider`           | same                                                | runtime-validated `PaymentProviderUpdate`                    | `PaymentProviderAdmin`                 | updates `payment_provider_settings`                                         | same                                                     |
| GET         | `/api/v1/admin/bookings`                              | `booking.lifecycle.read`                            | query                                                        | `AdminBookingListResponse`             | none                                                                        | `apps/web/src/app/admin/bookings/page.tsx`               |
| GET         | `/api/v1/admin/bookings/:bookingCode`                 | same                                                | none                                                         | `AdminBookingDetailResponse`           | none                                                                        | `apps/web/src/app/admin/bookings/[bookingCode]/page.tsx` |
| POST        | `/api/v1/admin/bookings/:bookingCode/cancel`          | `booking.lifecycle.manage`                          | `{reason}`                                                   | `AdminBookingDetailResponse`           | mutates booking status                                                      | same                                                     |
| POST        | `/api/v1/admin/bookings/:bookingCode/check-in`        | same                                                | none                                                         | same                                   | mutates                                                                     | same                                                     |
| POST        | `/api/v1/admin/bookings/:bookingCode/check-out`       | same                                                | none                                                         | same                                   | mutates                                                                     | same                                                     |
| POST        | `/api/v1/admin/bookings/:bookingCode/no-show`         | same                                                | `{reason}`                                                   | same                                   | mutates                                                                     | same                                                     |
| POST        | `/api/v1/admin/bookings/:bookingCode/send-coupons`    | `booking.lifecycle.manage` & `coupon.manage`        | `adminBookingCouponDeliverySchema`, `idempotency-key` header | none (queue)                           | writes `coupon_delivery_requests` + audit                                   | `coupon-delivery-action.tsx`                             |
| GET         | `/api/v1/admin/operational-reviews`                   | `booking.review.read`                               | query                                                        | `AdminOperationalReviewListResponse`   | none                                                                        | `apps/web/src/app/admin/operational-reviews/page.tsx`    |
| GET         | `/api/v1/admin/operational-reviews/:reviewId`         | same                                                | none                                                         | `AdminOperationalReviewDetailResponse` | none                                                                        | same                                                     |
| POST        | `/api/v1/admin/operational-reviews/:reviewId/resolve` | `booking.review.manage`                             | `{note}`                                                     | same                                   | updates status                                                              | same                                                     |
| GET         | `/api/v1/admin/room-operations`                       | (admin guard)                                       | query                                                        | `AdminRoomOperationsResponse`          | none                                                                        | `room-operations-board.tsx`                              |
| GET         | `/api/v1/admin/operational-report`                    | (admin guard)                                       | query                                                        | `AdminOperationalReportResponse`       | none                                                                        | `operational-report-dashboard.tsx`                       |
| GET         | `/api/v1/admin/payments`                              | (admin guard)                                       | query                                                        | `AdminPaymentListResponse`             | none                                                                        | `apps/web/src/app/admin/payments/page.tsx`               |
| GET         | `/api/v1/admin/payments/:paymentId`                   | (admin guard)                                       | none                                                         | `AdminPaymentDetailResponse`           | none                                                                        | same                                                     |
| POST        | `/api/v1/admin/payments/:paymentId/reconcile`         | (admin guard)                                       | none                                                         | same                                   | mutates                                                                     | same                                                     |

---

## 6. Exact availability status

`EXACT_AVAILABILITY=IMPLEMENTED`

`POST /api/v1/availability/search` returns authoritative aggregate counts
(`availableRoomCount`) per ACTIVE room type for the requested interval, the
authoritative best offer per room type, and amenity list. Physical room IDs
are intentionally not serialised. Empty results return `{items: []}`. The web
client surfaces `search.noMatchTitle`/`search.noMatchHelp` empty state. The
client and server share `availabilitySearchResponseSchema` parsing.

---

## 7. Nearby availability verdict

`NEARBY_AVAILABILITY=MISSING_NEW_FEATURE`

Searched for: availability alternatives before a room is selected; nearby
room/time suggestions when exact availability is empty; room-search at a
broader radius.

What exists:

- `POST /api/v1/recommendations/stay-times` (`apps/api/src/pricing/recommendation.controller.ts`)
  walks **-60..+60 minutes in 15-minute steps** and returns up to three
  candidates with `category ∈ {CLOSEST_CHEAPER, CHEAPEST_NEARBY, PARETO_ALTERNATIVE}`,
  probed through `RecommendationRepository.isCandidateAvailable` and
  `CouponRepository.evaluateForQuote`. This endpoint is **quote-coupled**: it
  requires a `roomTypeId`, `adults`, `children`, an exact `checkIn`/`checkOut`,
  and throws `RecommendationUnavailableError` if there is no eligible base
  plan for the exact interval. **It does not propose a different room type.**
- `POST /api/v1/quotes/offers` is read-only and returns eligible plans for the
  exact interval; it does not propose nearby intervals or rooms.

What does not exist:

- A pre-room-selection room-or-time alternative surface. There is no public
  endpoint that, given `(checkIn, checkOut, adults, children)`, returns
  "no room types are available at the exact interval — try one of these
  nearby time slots or different room types".
- A multi-property search. The system selects a single active property
  deterministically (see §10).

Recommended contract only (NOT implemented in this audit):

```text
POST /api/v1/public/availability/nearby
REQUEST:
  { checkIn: ISO datetime (offset),
    checkOut: ISO datetime (offset),
    adults: 1..20,
    children: 0..20,
    expandMinutes?: number,        // default 60, max 120 (one-sided per side)
    stepMinutes?: number,          // default 15
    limit?: number                 // default 5 }
RESPONSE:
  {
    exactMatch: boolean,
    candidates: Array<{
      kind: "TIME_SHIFT" | "ROOM_ALTERNATIVE" | "BOTH",
      checkIn: ISO, checkOut: ISO,
      shiftMinutes?: number,
      roomTypeId?: uuid, roomTypeName?: string,
      availableRoomCount?: number,
      finalAmountVnd?: number,
      savingsVnd?: number,
      availabilityStatus: "AVAILABLE" | "UNKNOWN"
    }>
  }
```

This contract is **not** required by any existing endpoint. Reusing the
recommendation machinery would require either (a) widening its input to omit
`roomTypeId`, or (b) introducing a new orchestrator that loops over each
ACTIVE room type and calls `isCandidateAvailable` + `evaluatePricingCandidates`
on shifted intervals. Both touch the public surface and require a new contract
or new controller; either is out of scope for this audit and constitutes a
new product feature.

---

## 8. Coupon-preview verdict

`COUPON_PREVIEW=PARTIAL` (DB and service ready; public preview endpoint MISSING)

What exists:

- `CouponRepository.evaluateForQuote` (`apps/api/src/pricing/coupon.repository.ts`)
  is the canonical provisional evaluator. It validates `status='ACTIVE'`,
  validity window, room-type scoping (`appliesToAllRoomTypes` + `coupon_room_types`),
  and minimum order, then computes `discountAmountVnd` / `finalAmountVnd`
  using `calculateDiscount` (`@room/booking/coupon`). It does **not** consume
  quota.
- `QuoteService.issue` (line 149–156) calls `evaluateForQuote` when
  `createQuoteRequestSchema.couponCode` is present and the repository is wired.
  The resulting `ProvisionalCouponEvaluation` is persisted in `quotes.coupon_snapshot`
  JSONB and returned as `quoteSchema.coupon`.
- `recommendationStayTimes` (`apps/api/src/pricing/recommendation.routes.ts`
  lines 68–103) optionally probes coupons through `CouponPreviewer` when
  `request.couponCode` is present. The probe swallows domain errors and
  returns `0` on failure, so missing/wrong coupons never break the search.
- Admin full coupon CRUD is available: list, get, create (discriminated
  union by `discountType`), disable.

What does not exist:

- A standalone pre-quote "type a code, see the discount before commit"
  surface. The public can only see coupon outcomes by (a) issuing a quote
  with `couponCode` set, or (b) calling `recommendations/stay-times` with
  `couponCode` set. Neither is "type the code, see if it works without
  committing to a room type and a plan".
- A "validate coupon" endpoint. There is no `POST /public/coupons/validate`
  or equivalent.

Recommended contract only (NOT implemented in this audit):

```text
POST /api/v1/public/coupons/preview
REQUEST:
  { code: string,
    roomTypeId?: uuid,            // optional: without it, only base-shape validation
    checkIn?: ISO, checkOut?: ISO, // optional
    grossAmountVnd: number }
RESPONSE:
  { code: string,
    discountType: "FIXED" | "PERCENTAGE",
    grossAmountVnd: number,
    discountAmountVnd: number,
    finalAmountVnd: number,
    revalidationNotice: string,
    valid: boolean,
    reason?: "EXPIRED" | "DISABLED" | "MIN_NOT_MET" | "ROOM_TYPE_UNSUPPORTED" }
```

This contract is **not** required by any existing public endpoint. The
current quote/recommendation code paths already implement the evaluation
logic; promoting it to a public endpoint is a separate scope decision.

---

## 9. Public-content authority

`PUBLIC_CONTENT_AUTHORITY=AUTHORITATIVE_FOR_TYPE_LIST_AND_AVAILABILITY_EXCEPT_PROPERTY_BRANDING`

What the public catalog server-renders directly from the DB:

- `public-room-catalog`: ACTIVE room types of the earliest-created ACTIVE
  property. Includes `id`, `name`, `description`, `maxAdults`, `maxChildren`,
  `maxOccupancy`, and amenity names.
- `availability-search`: ACTIVE room types of the same property, with
  aggregate counts and authoritative best-offer summary.
- `eligible-offers`: per-room-type authoritative eligible plan list.
- `quote`, `recommendation`, `hold`, `booking-detail`, `payment-status`,
  `payment-providers`: authoritative DB responses.

What the public web renders from static content instead:

- Hero image, room images, brand copy, plan labels. The
  `publicRoomImage(roomTypeId)` function in
  `apps/web/src/lib/public-room-catalog.ts` selects one of three bundled PNG
  files by hashing the UUID. There is **no DB-driven image**.
- Plan copy: `landing-availability-search.tsx` and the public landing use
  translation keys (`landing.planThreeHours`, etc.) rather than rate-plan
  `name`. The actual server response uses `plan.name` as `planLabel`.

This means:

- Branding, hero image, room photos, plan marketing labels are **not**
  database-driven. They live in `apps/web/src/content/public-hospitality-content.ts`
  and `apps/web/src/lib/i18n/messages.ts`. Adding a new property or rebranding
  requires **frontend content changes**, not just data.
- Functional data (room types, amenities, counts, prices, plans, coupons,
  holds, payments) is DB-authoritative and survives single-property
  reconfiguration.

---

## 10. Property authority

`PROPERTY_AUTHORITY=SINGLE_ACTIVE_PROPERTY_DETERMINISTIC`

| Field                              | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ACTIVE_PROPERTY_COUNT`            | All public flows read **at most one** ACTIVE property, chosen deterministically. The seed creates exactly one (`DEMO_PROPERTY`). `PropertyContextService.getCurrent()` (`apps/api/src/catalog/property-context.service.ts`) orders by `createdAt ASC, id ASC` and filters `status='ACTIVE'`.                                                                                                                                                                                                                                                                                                                             |
| `PUBLIC_PROPERTY_SELECTION_RULE`   | Same as `getCurrent`; `AvailabilityRepository.search`, `PublicRoomCatalogRepository.list`, and `RecommendationRepository.isCandidateAvailable` all use `(status='ACTIVE', orderBy: createdAt ASC, id ASC)` and filter all subsequent queries by `property.id`.                                                                                                                                                                                                                                                                                                                                                           |
| `ADMIN_SELECTED_PROPERTY_RULE`     | All admin catalog endpoints (catalog controller, rate-plan controller) use `CatalogRepository.getCurrentProperty()` which orders by `createdAt ASC, id ASC` **without** filtering `status`. If an admin archived the current property, the admin catalog would still surface it for edits. **This is an existing inconsistency between admin and public.**                                                                                                                                                                                                                                                               |
| `BRANDING_PROPERTY_RULE`           | No branding table. Branding is `apps/web/src/content/public-hospitality-content.ts` and `apps/web/src/lib/i18n/messages.ts`. The web does not read `properties.code`/`name` for hero/footer; the property identity is purely functional.                                                                                                                                                                                                                                                                                                                                                                                 |
| `CROSS_PROPERTY_GUARDS`            | Present and enforced: every room/room-type/amenity/price-tier/rate-plan/quote/booking/coupon table is bound to `property_id`; composite FKs bind room type → price tier of same property, room → room type of same property, booking → room of same property; schema enforces single-property `bookings` (`bookings_property_room_id_uq`), `payment_attempts`, etc. `AvailabilityRepository` and `RecommendationRepository` filter by `property.id` derived from the public single-property selection, so a second ACTIVE property with distinct data is provably not leaked into the first property's public responses. |
| `SINGLE_PROPERTY_INVARIANT_STATUS` | ENFORCED — but only at the **public** surface. Admin surface reads via `getCurrentProperty()` (no status filter); see inconsistency note above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

Architecture verdict: **single-active-property deterministic** is the
intentional design; multi-property is structurally gated by composite FKs and
single-source reads but is not surfaced in any UI or API today. Adding a
multi-tenant switcher would require **new product surface** (a property-picker
component, a `?propertyId=...` parameter throughout, and a status-filter fix
in `CatalogRepository.getCurrentProperty`).

---

## 11. Architecture debt, gaps, and noteworthy inconsistencies

These are findings the audit surfaced. They are not part of the requested
flow's design, but they affect what is buildable from the existing surface.

1. **No public room-type detail endpoint.** `/api/v1/public/room-types/:id`
   does not exist. `loadPublicRoomType` re-uses the list endpoint and
   filters client-side. This is functional but not a true detail endpoint.
2. **No media/gallery model.** `publicRoomImage` is static.
3. **`getCurrentProperty` does not filter by `status`** while
   `PropertyContextService.getCurrent` does. Admin can still operate on an
   archived property.
4. **Admin room-type capacity is hard-coded** (`2/0/2`) in
   `apps/web/src/components/room-type-manager.tsx` despite the API accepting
   the full set. Admins cannot edit description, name, capacity, tier, or
   status (other than archive) once a room type is created.
5. **Admin room edits are create-only**: `room_number` and `room_type_id`
   cannot be changed post-create. No `PATCH /admin/rooms/:id` exists.
6. **Admin amenity/price-tier edits are create-only**: no rename or
   description mutation. Only archive.
7. **No coupon edit endpoint.** Coupons are intentionally immutable
   post-create; only `disable` is exposed. This is a deliberate product
   decision but worth flagging.
8. **Coupon preview is not standalone.** Public can only discover a coupon
   discount by issuing a quote with `couponCode` set.
9. **No nearby availability.** The recommendation endpoint is
   room-type-coupled; it cannot help a user before they pick a room type.
10. **No multi-property surfacing.** Branding is in `apps/web/src/content`
    (static) and in i18n keys. The public web never reads `properties.name`
    for display.
11. **`coupons.first_referenced_at`** is declared but not written anywhere
    observable in this audit — its semantics are not enforced or used.
12. **Audit events for coupon and payment-provider mutations** were not
    confirmed in this read-through; `CatalogService` writes audit events,
    but `CouponService` does not appear to write `audit_events`. Recommend
    verifying whether `coupon.*` and `payment_provider_settings.*` events
    are out of scope or missing.
13. **`room_inventory_blocks` rows are never deleted** — they only flip
    `status` to `RELEASED`. Long retention is by design; cleanup
    responsibilities belong to ops.

---

## 12. Migration requirements for the requested flow

`MIGRATION_REQUIRED_FOR_REQUESTED_FLOW=NO`

All requested flow steps (§2) can be served by the existing schema under
`phase-8d-client-acceptance-v1`. No new columns, tables, or migrations are
required for the items classified `IMPLEMENTED_END_TO_END` or `PARTIAL`.

If the optional nearby-availability feature (§7) is in scope, a new public
endpoint is needed but **no schema migration** is required — it can reuse
`room_inventory_blocks` + `rate_plans` + `coupons` + `room_types` + `rooms`.

If a standalone public coupon preview (§8) is in scope, no migration is
required — `coupons` + `coupon_room_types` already hold the needed data.

---

## 13. No-migration alternatives

For each non-fully-implemented item, the lowest-effort path that ships the
capability **without** a database migration:

| Gap                                                         | No-migration path                                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public room-type detail endpoint                            | Add a new `GET /api/v1/public/room-types/:id` controller method that reuses `PublicRoomCatalogRepository.list` and filters by `id`. The contract can reuse `publicRoomTypeSchema`. No DB change.                                                   |
| Coupon preview                                              | Add `POST /api/v1/public/coupons/preview` wired to the existing `CouponRepository.evaluateForQuote` with a synthetic `roomTypeId`/`grossAmountVnd` probe. No DB change.                                                                            |
| Nearby availability before room selection                   | Add `POST /api/v1/public/availability/nearby` that loops over ACTIVE room types of the current property and reuses the existing `RecommendationRepository.isCandidateAvailable` + `evaluatePricingCandidates` for shifted intervals. No DB change. |
| Admin room-type edit / name / description / capacity / tier | Add `PATCH /api/v1/admin/room-types/:id` that updates the mutable columns and writes an audit event. No DB change.                                                                                                                                 |
| Admin room rename / re-type / housekeeping beyond current   | Add `PATCH /api/v1/admin/rooms/:id` that updates mutable columns. No DB change.                                                                                                                                                                    |
| Property status switch                                      | Make `status` part of `propertyCommandSchema` and add audit `PROPERTY_STATUS_CHANGED`. No DB change.                                                                                                                                               |
| Multi-property branding                                     | Add a `property_branding` table (or store on `properties`). **This would be a migration** — out of scope here.                                                                                                                                     |
| Media / gallery                                             | Add a `room_type_media` table. **Migration required**.                                                                                                                                                                                             |

---

## 14. Recommended next implementation boundary

Given:

- The customer journey described (landing browse → exact availability →
  horizontal room-type cards → room detail → eligible plans → quote →
  recommendation → contact → HOLD → payment) is **fully implemented end-to-end**
  on the existing backend, schema, contracts, and web shell, except for:
  - Standalone public coupon preview (§8, PARTIAL).
  - Dedicated public room-type detail endpoint (currently reuses list).
  - Optional nearby availability (§7, MISSING_NEW_FEATURE).
- No database migration is required to complete the requested journey's
  primary path.

**Recommended next implementation boundary (single-scope cut)**:

If the goal is to ship a **new** surface called "nearby availability before
room selection" (the optional extension), propose the contract in §7 as a
**new endpoint** without touching the schema. Implementation must:

1. Live under a new controller `apps/api/src/public-catalog/nearby-availability.controller.ts`.
2. Reuse `PropertyContextService.getCurrent()`, `CouponRepository.evaluateForQuote`
   (no quota side effect), and `evaluatePricingCandidates` for price probing.
3. Probe each ACTIVE room type's ACTIVE rooms against the existing
   `room_inventory_blocks` table (no new table).
4. Stay behind no auth (public) and follow `ProblemDetails` error format.

If the goal is **only** to expose the existing recommendation endpoint on
the landing (no nearby-search-before-room-selection), the work is **UI
exposure only**:

- Add a `stay-time-recommendations`-style component to the public landing,
  triggered only when `availability-search` returns empty.
- The web's `publicApi.searchStayTimeRecommendations` already exists and
  targets the recommendation endpoint. A UI wrapper to call it from the
  landing when the search is empty, and loop across all ACTIVE room types,
  is a frontend-only change with **no backend or schema work**.

If the goal is **only** to add coupon preview, the work is **backend-only**:

- Add `POST /api/v1/public/coupons/preview` (contract in §8) wired to
  `CouponRepository.evaluateForQuote` with a synthetic probe. No DB change.

If the goal is **only** to give admins room-type and room edit, the work is
**backend-only**:

- Add `PATCH /api/v1/admin/room-types/:id` and `PATCH /api/v1/admin/rooms/:id`
  per §13. No DB change.

---

## 15. Final verdict

| Bucket                        | Verdict                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `READY_WITH_EXISTING_BACKEND` | The primary requested journey (landing → search → cards → detail → plans → quote → recommendation → contact → HOLD → payment) is **ready with existing backend** for rooms where the active property has at least one ACTIVE room type and rate-plan catalog.                                                                                                                                                    |
| `UI_EXPOSURE_ONLY`            | Wiring the recommendation endpoint as an "if empty, try nearby intervals and room types" fallback on the landing is **UI exposure only** if the loop-across-room-types logic lives client-side and just calls the existing `recommendations/stay-times` endpoint per room type.                                                                                                                                  |
| `NEW_BACKEND_REQUIRED`        | A standalone public `POST /api/v1/public/coupons/preview` and `POST /api/v1/public/availability/nearby` are **new backend surfaces** (no migration). The contract sketches are in §7 and §8.                                                                                                                                                                                                                     |
| `DATABASE_MIGRATION_REQUIRED` | None for the requested primary flow. **Required** only for multi-property branding (new `property_branding` or new columns on `properties`) and for media/gallery (new `room_type_media` table).                                                                                                                                                                                                                 |
| `PRODUCT_DECISION_REQUIRED`   | (a) Whether to expose a standalone public coupon preview at all (current product rule is "preview happens at quote issue"). (b) Whether nearby-search is part of the customer journey or a future feature. (c) Whether admin should be able to edit (rather than only archive) room types, rooms, amenities, and price tiers. (d) Whether to ship multi-tenant property selection now (requires migration + UI). |
