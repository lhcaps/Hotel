# Phase 6C: Authoritative Coupon Core — Design

**Status:** Approved for implementation  
**Date:** 2026-07-25  
**Starting baseline:** `fa6726283da3772f117b63c4c8380ee2cda3ba3f`  
**Branch:** `phase5-booking-hold-guest-access`

## 1. Objective and boundary

Phase 6C adds deterministic VND coupon calculation, provisional quote evaluation, PostgreSQL-authoritative HOLD reservation, expiration release, internal idempotent redemption, ADMIN coupon APIs, public quote UI, audit, contracts, and OpenAPI.

It does not add payment attempts, gateways, return routes, webhooks/IPN, fake verified payment, booking confirmation, OAuth/profile work, coupon email distribution, refund automation, deployment, or production SMTP/TLS work.

## 2. Verified repository baseline

- PostgreSQL is the transactional authority; Redis is non-authoritative.
- Quote rows are immutable and currently store gross pricing in `base_amount_vnd`, `extra_amount_vnd`, and `total_amount_vnd`, with a JSONB pricing snapshot.
- Booking rows already have immutable bigint `gross_amount_vnd`, `discount_amount_vnd`, `final_amount_vnd`, and `price_snapshot` fields.
- HOLD creation begins with PostgreSQL time, locks the quote, checks quote idempotency, performs targeted stale-HOLD cleanup, locks a room, and writes booking/contact/inventory/audit/outbox atomically.
- Guest identity already uses a keyed normalized-email digest stored as exactly 32 bytes.
- Global expiration uses bounded `FOR UPDATE SKIP LOCKED` batches and atomically transitions booking, inventory, audit, and outbox.
- ADMIN catalog APIs use server-side permission guards, a service/repository split, database transactions, and append-only audit events.
- Released migrations `0000` through `0006` are byte-identical to commit `7698353`.
- No production coupon implementation exists. `docs/domain/coupon-rules.md` is documentation only.

## 3. Locked domain model

### 3.1 Coupon definition

`coupons` stores administrative/economic configuration. Stored lifecycle is only:

- `ACTIVE`
- `DISABLED`

`EXPIRED` is derived from PostgreSQL time and `valid_until`; no bulk expiry transition exists.

A coupon belongs to the current property and has one normalized ASCII code unique within that property. Economic configuration is fixed/percentage discount, optional percentage cap, minimum gross amount, validity window, room-type scope, and nullable global/customer limits.

### 3.2 Booking coupon application

`booking_coupon_applications` stores one immutable economic snapshot per booking and a mutable lifecycle:

- `ASSOCIATED`: unlimited coupon; no quota slot is held.
- `RESERVED`: at least one limit is configured and the slot is held by the HOLD.
- `REDEEMED`: a future verified-payment caller consumed the association/reservation once.
- `RELEASED`: HOLD expiry or an approved pre-payment cancellation released it.

A global coupon row never becomes `RESERVED` or `REDEEMED`. Multiple bookings may concurrently have different application states for the same definition.

`quota_reserved` is true only while a limited application is `RESERVED`, and remains true for a limited `REDEEMED` application to record that the redeemed use consumes quota. On `RELEASED`, it becomes false. `reserved_at` remains populated after release to retain lifecycle evidence. Unlimited applications retain `quota_reserved=false` through `ASSOCIATED`, `REDEEMED`, or `RELEASED`.

## 4. Coupon code and money

Coupon code normalization is dependency-free and locale-independent:

1. trim outer whitespace;
2. reject any non-ASCII input;
3. uppercase ASCII `a-z` explicitly;
4. require `^[A-Z0-9-]{4,32}$`.

Raw public codes are not written to structured logs or metrics. ADMIN/customer responses may show the normalized display code; internal operational references use coupon UUID.

All money is integer VND. The pure calculator converts safe integer inputs to `bigint` before multiplication.

- Fixed: `discount = min(fixedAmount, gross)`.
- Percentage: `raw = floor(gross * basisPoints / 10000)` and `discount = min(raw, optionalMaximum, gross)`.
- Final: `gross - discount`.
- Percentage basis points are integers in `1..10000`.
- Minimum order compares against gross before discount.
- Currency is exactly `VND`.

The pure module owns code normalization, economic-shape validation, static property/room/minimum applicability, one-coupon stacking, and deterministic calculation. Repositories own database time, status, locking, and quota.

## 5. Database design

### 5.1 `coupons`

Columns:

- UUID primary key and property FK;
- normalized code;
- `ACTIVE | DISABLED` status;
- `FIXED | PERCENTAGE` type;
- nullable fixed amount bigint;
- nullable percentage basis points integer;
- nullable maximum discount bigint;
- non-negative minimum gross bigint;
- `valid_from`, `valid_until` timestamptz;
- explicit `applies_to_all_room_types` boolean;
- nullable positive total/customer limits;
- `disabled_at`, `created_at`, `updated_at`.

Named checks enforce validity order, economic shape, positive/nullable caps and limits, and status/disabled timestamp consistency. `(property_id, normalized_code)` is unique. A composite `(property_id, id)` unique key supports property-consistent foreign keys.

### 5.2 `coupon_room_types`

The join table stores `property_id`, `coupon_id`, and `room_type_id`. Composite foreign keys enforce that coupon and room type belong to the same property. The primary key prevents duplicates. `applies_to_all_room_types=true` means no join rows are required; `false` requires at least one row at coupon creation. ADMIN creation writes definition and scope in one transaction.

Database triggers reject join-row insertion for an all-room coupon and reject changing/deleting room scope after first quote/application reference. Application validation also rejects a scoped coupon with no matching room row, so an empty set never means both “all” and “none”.

### 5.3 Quote reference

Add nullable `quotes.coupon_id` and nullable non-empty `quotes.coupon_snapshot` JSONB. No application/reservation row is created by quote. Existing `quotes.total_amount_vnd` remains gross; this avoids changing Phase 4 semantics. The immutable JSON snapshot contains coupon ID, normalized display code, definition values used, gross, discount, final, and rule version.

The existing quote mutation trigger protects both columns because it rejects every update/delete.

### 5.4 `booking_coupon_applications`

Columns include UUID, property/booking/coupon FKs, unique booking ID, 32-byte customer email digest, lifecycle status, quota flag, immutable discount/configuration snapshots, gross/discount/final bigint snapshots, normalized display-code snapshot, lifecycle timestamps, unique nullable redemption event key, and creation time.

Named checks enforce:

- one application per booking;
- digest length 32;
- snapshot shape by discount type;
- `0 <= discount <= gross` and `final = gross - discount`;
- ASSOCIATED/RESERVED/REDEEMED/RELEASED timestamp and quota semantics;
- redemption event key only for REDEEMED.

Indexes support consuming quota counts by `(coupon_id, application_status)`, customer counts by `(coupon_id, customer_email_digest, application_status)`, booking lookup, release, and idempotency.

A trigger rejects mutation of all economic/identity snapshot fields. Only lifecycle fields may transition through approved repository functions. Coupon economic fields and room scope cannot change after first quote/application reference; disabling remains allowed.

### 5.5 Migration strategy

Create generated forward migration `0007` and a custom-invariant migration `0008`. Do not edit `0000..0006`. Advance `schema_metadata.schema_version` to `phase-6-coupon-core-v1`. Validate fresh migration and Phase 5 upgrade using guarded disposable loopback PostgreSQL.

## 6. Quote behavior

The public request adds only optional `couponCode`. It never accepts coupon ID, discount/final amounts, state, usage, limits, percentage, or cap.

Quote sequence:

1. validate request and calculate authoritative gross using existing pricing rules;
2. obtain PostgreSQL current time;
3. if no code, issue the existing quote with discount zero and coupon null;
4. normalize code and load definition by property/code;
5. require ACTIVE and current validity;
6. validate property, room type, and minimum gross;
7. calculate exact provisional discount/final;
8. insert immutable quote and coupon snapshot in the same database operation.

Quote creates no `booking_coupon_applications` row and changes no quota count. Customer quota is not evaluated because contact is not yet collected. Quote responses explicitly state that applicability and quota are revalidated at HOLD.

## 7. HOLD transaction and lock order

Preserve Phase 5 idempotency ordering. Within one PostgreSQL transaction:

1. read PostgreSQL timestamp;
2. lock quote `FOR UPDATE`;
3. find existing booking by quote;
4. for an existing booking, compare immutable contact and return the existing booking/application result when equivalent, or `QUOTE_ALREADY_USED` when different; do not revalidate current coupon state;
5. validate quote expiry and snapshot;
6. compute `holdExpiresAt` from database time;
7. if coupon exists, lock its row `FOR UPDATE`;
8. revalidate ACTIVE status, validity, property, room scope, minimum gross, and `validUntil >= holdExpiresAt`;
9. count `RESERVED` and `REDEEMED` applications under the same row lock; filter by email digest for customer quota;
10. recalculate from gross and compare with immutable quote coupon snapshot; drift returns `COUPON_REQUOTE_REQUIRED`;
11. perform existing bounded targeted stale-HOLD cleanup, including coupon release for cleaned bookings;
12. lock/select room;
13. insert booking with authoritative gross/discount/final and combined snapshot;
14. insert contact and ACTIVE inventory block;
15. insert ASSOCIATED for no limits, otherwise RESERVED;
16. insert booking and coupon audit events plus existing outbox event;
17. commit.

Same-coupon HOLDs serialize on the coupon row. Different coupons lock different rows. Unlimited coupons also lock only their own row for revalidation but perform no quota count/reservation. PostgreSQL counts, not Redis/cached counters, are authoritative.

Quota rejection is represented as a transaction outcome rather than an exception before commit: the transaction writes the safe rejection audit event, commits no booking-side rows, then the service raises the domain error outside the transaction.

## 8. Expiration release

Both targeted cleanup and the global worker release coupon applications in the same transaction as booking/inventory expiration:

- `RESERVED | ASSOCIATED -> RELEASED`;
- `quota_reserved=false`;
- `released_at=databaseNow`;
- one `COUPON_RELEASED` audit record.

Predicates make repeated iterations and two workers idempotent. `REDEEMED` is never released. Released rows do not count toward quota, making capacity immediately reusable if the definition is still ACTIVE and valid.

## 9. Internal redemption primitive

`redeemCouponApplication(tx, { bookingId, verifiedPaymentEventKey, databaseNow })` is an internal booking package repository/domain function, with no controller/route.

It locks the application. Missing application returns a no-coupon result. RESERVED/ASSOCIATED transitions once to REDEEMED, records event key/time, and writes one audit event. A duplicate call with the same event key returns the existing result. A different key after redemption cannot create another effect. RELEASED raises `COUPON_APPLICATION_NOT_REDEEMABLE`. It does not verify payment or change booking status.

## 10. ADMIN API

Add guarded routes:

- `POST /api/v1/admin/coupons`
- `GET /api/v1/admin/coupons`
- `GET /api/v1/admin/coupons/:couponId`
- `POST /api/v1/admin/coupons/:couponId/disable`

Use `catalog.coupon.read` and `catalog.coupon.manage` permissions. Create validates strict input and writes definition/scope/audit atomically. Disable is idempotent, updates only status/timestamps, writes one `COUPON_DISABLED` event on the first transition, and does not mutate existing applications. List/detail derive active-reserved, redeemed, and released counts and never expose email digests.

No update endpoint is added because create plus disable is the narrow safe contract and avoids economic mutation after usage.

## 11. Public contracts and UI

Quote response exposes normalized display code, type label, gross, discount, final, and provisional note. HOLD and guest-authenticated detail expose the same safe coupon summary without UUID, digest, or quota.

The public web sends only `couponCode`. Coupon state stays in component/form state, not URL or Web Storage. Changing or clearing a coupon issues a new quote; it never mutates an existing quote. HOLD errors `COUPON_REQUOTE_REQUIRED` and other coupon revalidation failures guide the user back to quote regeneration.

The ADMIN coupon UI is deferred; Phase 6C requires ADMIN APIs only.

## 12. Error and audit policy

Safe domain codes:

- `COUPON_NOT_FOUND_OR_UNAVAILABLE`
- `COUPON_EXPIRED`
- `COUPON_NOT_APPLICABLE`
- `COUPON_MINIMUM_NOT_MET`
- `COUPON_LIMIT_REACHED`
- `COUPON_CUSTOMER_LIMIT_REACHED`
- `COUPON_HOLD_WINDOW_INCOMPATIBLE`
- `COUPON_REQUOTE_REQUIRED`
- `COUPON_ALREADY_APPLIED`
- `COUPON_APPLICATION_NOT_REDEEMABLE`

Audit events: `COUPON_CREATED`, `COUPON_DISABLED`, `COUPON_RESERVED`, `COUPON_ASSOCIATED`, `COUPON_RELEASED`, `COUPON_REDEEMED`, `COUPON_LIMIT_REJECTED`, and `COUPON_CUSTOMER_LIMIT_REJECTED`.

Payloads contain IDs, lifecycle transition, amount snapshots, and correlation/event references only. No raw email, email digest, phone, recipient list, raw request body, or payment secret is logged. Arbitrary invalid public coupon-code probes are not audited to avoid flooding.

## 13. Critical acceptance evidence

The quota=1 race must use two independent `Pool` instances, each constrained to its own PostgreSQL connection. Exactly one transaction commits a booking plus RESERVED application; the loser receives the approved quota error; no loser booking/contact/inventory/audit/outbox rows remain.

A separate test must assert that repeated coupon quotes create zero rows in `booking_coupon_applications` and do not alter any consuming quota count.

Final acceptance also requires fixed/percentage boundary tests, per-customer race by keyed email digest, IP independence, unlimited ASSOCIATED behavior, atomic/idempotent release, redemption idempotency with no route, ADMIN disable preservation, migration identity, OpenAPI reproducibility/security, public UI evidence, full Playwright, dependency audit, and Phase 6B scheduler regression.

## 14. Phase 6D status (Public Coupon Web Stage I)

Phase 6D shipped the public coupon Web flow on top of `abf16be`
(starting HEAD). The implementation HEAD at closeout is `5a806a0`;
the original Phase 6D chain extends from `abf16be` through `78f6936`
on the `phase5-booking-hold-guest-access` branch. The optional
coupon input submits only `couponCode`; HOLD and detail responses
expose the same safe `coupon` summary the quote returns; HOLD-time
coupon revalidation maps to safe problem codes without exposing
quota, digest, or UUIDs. Real desktop and mobile Playwright vertical
flows plus an ADMIN-disable-before-HOLD scenario are committed.
Migrations `0000`–`0010` and Drizzle metadata are unchanged. Phase
6D closeout quality baseline (configured lint/typecheck green;
every Phase 6D changed file Prettier-clean and targeted-linted;
zero high dependency advisories; one moderate + one low esbuild
advisory; 80 pre-existing format-debt files outside Phase 6D; web
and booking test directories, plus root E2E, now have targeted
lint coverage via `apps/web/eslint.config.mjs` and
`tests/eslint.config.mjs`) is recorded in the
`docs/handoffs/phase-5-demo-handoff.md` "Phase 6 status snapshot"
section and `docs/runbooks/phase-5-demo.md` "Quality baseline at
Phase 6D closeout". Payment, ADMIN coupon Web, refund restoration,
and production SMTP/TLS remain deferred.
