# Phase 7G — ADMIN booking operations and operational review design

**Status:** Locked for Phase 7G implementation
**Date:** 2026-07-27
**Mission:** deliver a complete ADMIN booking-operations vertical that controls
the HOLD → CANCELLED, CONFIRMED → {CANCELLED, CHECKED_IN, NO_SHOW} and
CHECKED_IN → CHECKED_OUT transitions transactionally, plus an operational
review model for paid cancellations.

## Reused architecture (no duplication)

| Concern                | Existing module                                                                   | Reused as-is?                                                                        |
| ---------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Booking state machine  | `docs/domain/booking-state-machine.md` STM-001..008                               | yes — extended with STM-009..013                                                     |
| Catalog property       | `apps/api/src/catalog/catalog.service.ts`                                         | yes (read-only)                                                                      |
| Inventory blocks       | `packages/booking/src/repository/booking-repository.ts` + `room_inventory_blocks` | yes                                                                                  |
| Audit repository       | `apps/api/src/catalog/audit.repository.ts`                                        | yes (`AuditRepositoryPort`)                                                          |
| Outbox                 | `outbox_events`                                                                   | yes (no new event types required)                                                    |
| Actor context          | `apps/api/src/auth/actor-context.ts`                                              | yes                                                                                  |
| ADMIN permission guard | `apps/api/src/auth/admin-permission.guard.ts`                                     | yes (new `booking.lifecycle.manage`, `booking.review.manage`, `booking.review.read`) |
| Booking repository     | `packages/booking/src/repository/booking-repository.ts`                           | yes (extend `BookingRow` + lock helper)                                              |
| Database client        | `packages/database/src/client.ts`                                                 | yes                                                                                  |
| Problem-details filter | `apps/api/src/errors/problem-details.filter.ts`                                   | extend with two new error classes                                                    |
| Contracts package      | `packages/contracts/src/admin.ts`                                                 | extend (no new tables on existing models)                                            |
| Customer profiles      | `customer_profiles` (Phase 7F)                                                    | yes                                                                                  |
| Booking ownership      | `bookings.customer_user_id` (Phase 7F)                                            | yes — list filter continues to use it                                                |
| AUTH/RBAC policy       | `docs/security/AUTH_RBAC_POLICY.md`                                               | extend with two new permissions                                                      |
| Admin Web shell        | `apps/web/src/app/admin/layout.tsx` + sidebar                                     | yes                                                                                  |

## Booking transition matrix (locked)

Allowed:

| ID      | From       | Event                         | To          |
| ------- | ---------- | ----------------------------- | ----------- |
| STM-004 | HOLD       | `ADMIN_CANCEL`                | CANCELLED   |
| STM-005 | CONFIRMED  | `ADMIN_CANCEL_BEFORE_CHECKIN` | CANCELLED   |
| STM-006 | CONFIRMED  | `ADMIN_CHECK_IN`              | CHECKED_IN  |
| STM-007 | CONFIRMED  | `ADMIN_MARK_NO_SHOW`          | NO_SHOW     |
| STM-008 | CHECKED_IN | `ADMIN_CHECK_OUT`             | CHECKED_OUT |

Rejected (must throw `BOOKING_TRANSITION_NOT_ALLOWED`, 409):

- HOLD → CHECKED_IN, HOLD → CHECKED_OUT
- EXPIRED → CONFIRMED, EXPIRED → CHECKED_IN
- CANCELLED → CHECKED_IN, CANCELLED → CONFIRMED
- NO_SHOW → CHECKED_IN
- CHECKED_OUT → CHECKED_IN
- CONFIRMED → CHECKED_OUT
- CHECKED_IN → CANCELLED

`STM-003` (HOLD → EXPIRED) is owned by the worker, not the API.
Each API command determines its transition server-side from the current
booking state; the browser never sends a target status.

## Transactional rules (locked)

Every mutation must:

1. authenticate active ADMIN with the required permission;
2. begin a real PostgreSQL transaction;
3. lock the booking row (`SELECT ... FOR UPDATE`);
4. reload booking, allocation, coupon application, payment and review state;
5. validate the current state matches the expected transition;
6. perform exactly one transition;
7. apply inventory + coupon effects;
8. append scrubbed audit (`actorType: 'ADMIN'`);
9. enqueue outbox event where the existing payment-core pipeline already does
   so for `booking.confirmed` (Phase 7G reuses the same event type);
10. commit;
11. return a safe DTO.

Redis is never authoritative. The transition uses PostgreSQL locks only.

### Cancel HOLD (STM-004)

- `reason` required (1–500 chars, trimmed);
- booking becomes CANCELLED; `cancelledAt = now`;
- inventory block released (`status = RELEASED`, `releasedAt = now`);
- coupon application, if present, becomes `RELEASED` (`releasedAt = now`);
- audit `BOOKING_CANCELLED` with `{ bookingCode, from: 'HOLD', reason, by: 'ADMIN' }`;
- if the booking is later targeted by a verified provider success (MoMo/VNPAY),
  the Phase 7C payment core's `BOOKING_CANCELLED` review gate must absorb it
  via `INVENTORY_RELEASED` + `PAYMENT_BOOKING_STATE`. We add a check that
  re-validates `inventory.status === 'RELEASED'` and `booking.status !== 'HOLD'`
  to ensure late successes become `REVIEW_REQUIRED` and never re-open
  CANCELLED.

### Cancel CONFIRMED (STM-005)

- `reason` required;
- booking becomes CANCELLED; `cancelledAt = now`;
- inventory block released;
- SUCCEEDED payment remains SUCCEEDED (payment truth is **not** mutated);
- redeemed coupon remains REDEEMED;
- audit `BOOKING_CANCELLED` with `{ from: 'CONFIRMED', paid: true|false }`;
- exactly **one** `OPEN` operational review is created for paid
  cancellations (`payments.status = 'SUCCEEDED'`).

### Check-in (STM-006)

- `CONFIRMED` only;
- `checkedInAt = now`;
- inventory block stays ACTIVE (the physical room remains blocked);
- audit `BOOKING_CHECKED_IN`;
- no coupon, payment, or outbox effect.

### Check-out (STM-008)

- `CHECKED_IN` only;
- `checkedOutAt = now`;
- inventory block released;
- audit `BOOKING_CHECKED_OUT`.

### No-show (STM-007)

- `CONFIRMED` only;
- server time must be `>= booking.checkIn`;
- `reason` required;
- `noShowAt = now`;
- inventory block released;
- SUCCEEDED payment remains SUCCEEDED;
- audit `BOOKING_NO_SHOW` with `lateBySeconds`.

### Idempotency

- Duplicate HOLD cancellation = single business effect (booking already CANCELLED
  → 409 `BOOKING_TRANSITION_NOT_ALLOWED` with `reason: 'ALREADY_CANCELLED'`).
- Duplicate paid cancellation = no second review row.
- Duplicate check-out on a `CHECKED_OUT` booking = 409.
- Late verified provider success on a CANCELLED booking is accepted by the
  payment core but recorded as `REVIEW_REQUIRED` (no re-confirm).

## Operational review model

We add the minimum required model.

### `operational_reviews` (new table — migration `0015_phase7g_admin_booking_operations`)

| Column          | Type             | Notes                                         |
| --------------- | ---------------- | --------------------------------------------- |
| `id`            | uuid pk          | `defaultRandom()`                             |
| `property_id`   | uuid fk          | references `properties.id` ON DELETE restrict |
| `booking_id`    | uuid fk          | references `bookings.id` ON DELETE restrict   |
| `payment_id`    | uuid fk nullable | references `payments.id` ON DELETE restrict   |
| `category`      | enum             | `PAID_CANCELLATION` (locked for Phase 7G)     |
| `status`        | enum             | `OPEN`, `RESOLVED`                            |
| `opened_at`     | timestamptz      | `not null default now()`                      |
| `opened_reason` | text             | `not null`, trim non-empty, ≤1000             |
| `resolved_at`   | timestamptz null |                                               |
| `resolver_id`   | uuid null        | references `users.id` (ADMIN)                 |
| `resolved_note` | text null        | trim non-empty, ≤2000                         |
| `created_at`    | timestamptz      | default now()                                 |
| `updated_at`    | timestamptz      | default now()                                 |

Constraints:

- unique `(`booking_id`, `category`)` where `status = 'OPEN'`.
- `RESOLVED` rows must have `resolved_at IS NOT NULL`,
  `resolver_id IS NOT NULL`, `resolved_note IS NOT NULL`.
- `OPEN` rows must have `resolved_at IS NULL`,
  `resolver_id IS NULL`, `resolved_note IS NULL`.

### Payment-truth separation

The operational review must **never** mutate the `payments` table or the
`payment_attempts` table. Resolution is operator-side bookkeeping only.

### Resolve rules

- `OPEN` only; otherwise 409 `OPERATIONAL_REVIEW_ALREADY_RESOLVED`.
- Active ADMIN with `booking.review.manage`.
- Non-empty `note` required (≤2000 chars).
- Server fills `resolved_at`, `resolver_id` from the actor context.
- Idempotent: a second resolve against the same OPEN row fails with the same
  conflict error after the first row wins (atomic transaction). Two
  concurrent resolves result in exactly one winner (the other gets
  `OPERATIONAL_REVIEW_ALREADY_RESOLVED`).

## Inventory and coupon effects (locked)

| Transition               | Inventory             | Coupon application             |
| ------------------------ | --------------------- | ------------------------------ |
| HOLD → CANCELLED         | release BOOKING block | `RESERVED → RELEASED` (if any) |
| CONFIRMED → CANCELLED    | release BOOKING block | `REDEEMED` stays REDEEMED      |
| CONFIRMED → CHECKED_IN   | block stays ACTIVE    | unchanged                      |
| CONFIRMED → NO_SHOW      | release BOOKING block | `REDEEMED` stays REDEEMED      |
| CHECKED_IN → CHECKED_OUT | release BOOKING block | unchanged                      |

## Audit & outbox behavior (locked)

Each successful mutation appends one scrubbed `audit_events` row:

| Transition               | `eventType`           | Payload keys                                     |
| ------------------------ | --------------------- | ------------------------------------------------ |
| HOLD → CANCELLED         | `BOOKING_CANCELLED`   | `bookingCode, from: 'HOLD', reason, paid: false` |
| CONFIRMED → CANCELLED    | `BOOKING_CANCELLED`   | `bookingCode, from: 'CONFIRMED', paid, reason`   |
| CONFIRMED → CHECKED_IN   | `BOOKING_CHECKED_IN`  | `bookingCode`                                    |
| CONFIRMED → NO_SHOW      | `BOOKING_NO_SHOW`     | `bookingCode, reason, lateBySeconds`             |
| CHECKED_IN → CHECKED_OUT | `BOOKING_CHECKED_OUT` | `bookingCode`                                    |

The paid-cancel path also appends one `OPERATIONAL_REVIEW_OPENED` event
with `category: 'PAID_CANCELLATION'` (no payment secret or raw payload).
Resolution appends `OPERATIONAL_REVIEW_RESOLVED`.

Outbox:

- `booking.checked_in`, `booking.checked_out`, `booking.no_show`,
  `booking.cancelled` are enqueued (idempotent — the existing
  `booking.hold.created` template applies).
- `OPERATIONAL_REVIEW_OPENED` is appended to the `audit_events` table only;
  it is **not** enqueued to outbox (the operator workflow is in-app).

## API contract (locked, versioned under `/api/v1`)

```
GET    /api/v1/admin/bookings
GET    /api/v1/admin/bookings/:bookingCode
POST   /api/v1/admin/bookings/:bookingCode/cancel
POST   /api/v1/admin/bookings/:bookingCode/check-in
POST   /api/v1/admin/bookings/:bookingCode/check-out
POST   /api/v1/admin/bookings/:bookingCode/no-show

GET    /api/v1/admin/operational-reviews
GET    /api/v1/admin/operational-reviews/:reviewId
POST   /api/v1/admin/operational-reviews/:reviewId/resolve
```

### Permissions

| Route                                         | Permission                 |
| --------------------------------------------- | -------------------------- |
| `GET /admin/bookings`                         | `booking.lifecycle.read`   |
| `GET /admin/bookings/:bookingCode`            | `booking.lifecycle.read`   |
| `POST /admin/bookings/:code/cancel`           | `booking.lifecycle.manage` |
| `POST /admin/bookings/:code/check-in`         | `booking.lifecycle.manage` |
| `POST /admin/bookings/:code/check-out`        | `booking.lifecycle.manage` |
| `POST /admin/bookings/:code/no-show`          | `booking.lifecycle.manage` |
| `GET /admin/operational-reviews`              | `booking.review.read`      |
| `GET /admin/operational-reviews/:id`          | `booking.review.read`      |
| `POST /admin/operational-reviews/:id/resolve` | `booking.review.manage`    |

`booking.lifecycle.read` and `booking.lifecycle.manage` are added to the
`ADMIN` permission set; `booking.review.read` and `booking.review.manage`
are added to the same set. CUSTOMER continues to have zero ADMIN
permissions.

### Request/response shapes

`GET /admin/bookings?page=1&pageSize=20&q=<code>&status=<status>&paymentStatus=<status>&roomTypeId=<id>&checkInFrom=<ts>&checkInTo=<ts>&reviewPresence=<open|any|none>`

- server-side filtering;
- stable order: `bookings.created_at DESC, bookings.id DESC`;
- bounded pagination `pageSize ≤ 100`.

Item fields (safe DTO):

```json
{
  "bookingCode": "RM-...",
  "status": "HOLD|CONFIRMED|...",
  "checkIn": "...",
  "checkOut": "...",
  "roomType": { "code": "...", "name": "..." },
  "room": { "id": "...", "roomNumber": "..." },
  "guestName": "...",
  "finalAmountVnd": 359000,
  "currency": "VND",
  "paymentStatus": "PENDING|SUCCEEDED|REVIEW_REQUIRED|CANCELLED|EXPIRED|NONE",
  "reviewPresence": "OPEN|RESOLVED|NONE",
  "createdAt": "..."
}
```

Booking detail adds:

- contact snapshot (`fullName`, masked email, masked phone) — never raw;
- pricing snapshot: `grossAmountVnd`, `discountAmountVnd`, `finalAmountVnd`,
  `coupon.code`, `coupon.discountType`, `coupon.grossAmountVnd`,
  `coupon.discountAmountVnd`, `coupon.finalAmountVnd`;
- payment summary (`status`, `amountVnd`, `confirmationSource`,
  `succeededAt` — no provider secrets, no provider payload, no
  `providerOrderId`, no `providerTransactionId`);
- physical room: `{ id, roomNumber }`;
- transition timeline (audit events filtered to `aggregateType = 'BOOKING'`,
  scrubbed to `eventType`, `actorType`, `actorId`, `occurredAt`,
  safe payload keys; no PII, no provider secrets);
- server-authoritative `availableActions` list (derived from the current
  booking state).

Available actions (server-authoritative):

| Current status | Available actions               |
| -------------- | ------------------------------- |
| HOLD           | `cancel`                        |
| CONFIRMED      | `cancel`, `check-in`, `no-show` |
| CHECKED_IN     | `check-out`                     |
| CANCELLED      | `[]`                            |
| NO_SHOW        | `[]`                            |
| CHECKED_OUT    | `[]`                            |
| EXPIRED        | `[]`                            |

The browser must never submit a target status. The browser only POSTs the
operation name and the reason (where required).

### Mutation contracts

`POST /admin/bookings/:bookingCode/cancel` body:

```json
{ "reason": "Guest requested before check-in" }
```

Response: 200 with the updated safe DTO, OR 409 with
`BOOKING_TRANSITION_NOT_ALLOWED`/`code: 'ALREADY_CANCELLED'`.

`POST /admin/bookings/:bookingCode/check-in` body: `{}`.
`POST /admin/bookings/:bookingCode/check-out` body: `{}`.
`POST /admin/bookings/:bookingCode/no-show` body:

```json
{ "reason": "..." }
```

If `now < checkIn`, the response is 409 `NO_SHOW_BEFORE_CHECK_IN`.

### Error codes

| Code                                  | HTTP | Public `type`                         |
| ------------------------------------- | ---- | ------------------------------------- |
| `BOOKING_NOT_FOUND`                   | 404  | `booking-not-found`                   |
| `BOOKING_TRANSITION_NOT_ALLOWED`      | 409  | `booking-transition-not-allowed`      |
| `NO_SHOW_BEFORE_CHECK_IN`             | 409  | `booking-no-show-before-check-in`     |
| `OPERATIONAL_REVIEW_NOT_FOUND`        | 404  | `operational-review-not-found`        |
| `OPERATIONAL_REVIEW_ALREADY_RESOLVED` | 409  | `operational-review-already-resolved` |
| `REVIEW_REASON_REQUIRED`              | 400  | `validation-error`                    |

## Database impact

Migration: `0015_phase7g_admin_booking_operations.sql` (forward-only).
Adds:

- enum `operational_review_category` (`PAID_CANCELLATION`);
- enum `operational_review_status` (`OPEN`, `RESOLVED`);
- table `operational_reviews` per the schema above.

Additions to `bookings` (no destructive changes):

- `cancelled_at timestamptz null` (CHECK: if status='CANCELLED' then cancelled_at IS NOT NULL, else NULL);
- `checked_in_at timestamptz null` (CHECK: status='CHECKED_IN' ↔ checked_in_at IS NOT NULL);
- `checked_out_at timestamptz null` (CHECK: status='CHECKED_OUT' ↔ checked_out_at IS NOT NULL);
- `no_show_at timestamptz null` (CHECK: status='NO_SHOW' ↔ no_show_at IS NOT NULL);
- `cancellation_reason text null` (trim non-empty when present, ≤1000).

Schema bump: `phase-7g-admin-booking-operations-v1`.

`pnpm db:check`, `pnpm db:test`, `pnpm db:status` and the
`historical-migration-identity.test.ts` suite are extended to assert the
new migration number and the new version.

## Authorization matrix (locked)

| Actor                    | Read admin/bookings | Mutate booking lifecycle | Read reviews | Resolve review |
| ------------------------ | ------------------- | ------------------------ | ------------ | -------------- |
| Unauthenticated          | 401                 | 401                      | 401          | 401            |
| CUSTOMER (any status)    | 403                 | 403                      | 403          | 403            |
| Guest session            | 401                 | 401                      | 401          | 401            |
| SYSTEM_WORKER identity   | 403                 | 403                      | 403          | 403            |
| DISABLED ADMIN           | 403                 | 403                      | 403          | 403            |
| ADMIN without permission | 403                 | 403                      | 403          | 403            |
| ADMIN with permission    | 200                 | 200/409                  | 200          | 200/409        |

The browser must not supply actor id, role, target booking status,
authoritative payment status, amount, resolver id, or physical-room
reassignment.

## API integration cases (locked)

- 401 unauthenticated
- 403 CUSTOMER
- 401 guest session
- 403 DISABLED ADMIN
- 403 missing permission
- 200 ADMIN with permission
- 200 list filters
- 200 stable pagination
- 200 safe detail (no SQL detail, no stack trace)
- 409 illegal transition
- 400 reason validation
- 200 provider-data redaction
- 200/403 review-resolution authorization

## Concurrency test matrix (locked)

Use **separate real PostgreSQL connections** for races. No fake concurrency
through one transaction/client.

1. HOLD cancel releases allocation.
2. HOLD cancel releases coupon reservation (when coupon was RESERVED).
3. Duplicate HOLD cancel = one business effect (second is 409).
4. CONFIRMED cancel preserves SUCCEEDED payment.
5. CONFIRMED cancel preserves redeemed coupon.
6. Paid CONFIRMED cancel creates exactly one OPEN review.
7. Duplicate paid cancel creates no second review.
8. Check-in preserves inventory blocking.
9. Check-out releases inventory.
10. No-show before expected check-in is rejected.
11. No-show exactly at expected check-in succeeds.
12. No-show releases allocation.
13. Cancel vs check-in race has exactly one winner.
14. Check-in vs no-show race has exactly one winner.
15. Duplicate check-out = one business effect (second is 409).
16. Late verified payment cannot confirm a CANCELLED booking
    (Phase 7C REVIEW_REQUIRED path).
17. Audit failure rolls back the complete mutation (simulate by injecting
    a constraint violation inside the audit insert).
18. Review resolution is idempotent (single actor resolves once; second
    call returns `OPERATIONAL_REVIEW_ALREADY_RESOLVED`).
19. Concurrent review resolution = exactly one winner.
20. Historical bookings remain readable (Phase 7G mutates only
    forward-facing bookings; historical rows have null timestamps).
21. Contact snapshots remain immutable.
22. Physical-room overlap protection remains valid.

## Web vertical (locked)

Routes:

- `/admin/bookings` — list with filters and pagination
- `/admin/bookings/[bookingCode]` — detail with action panels
- `/admin/operational-reviews` — list (default `status=OPEN`)
- `/admin/operational-reviews/[reviewId]` — detail + resolve form

Shared components reuse existing design tokens:

- `catalog-table.tsx` pattern for list tables;
- `admin-logout-button.tsx`, `admin-layout.tsx`, `loading.tsx`;
- `AdminApiError` and `adminApi` client in `apps/web/src/lib/admin-api.ts`.

Detail UI:

- immutable contact panel (masked email/phone);
- occupancy + interval panel;
- pricing snapshot panel;
- coupon summary panel;
- payment summary panel (status, succeededAt, amount — no provider fields);
- physical-room panel (roomNumber only — never the room id sent by ADMIN);
- review state panel;
- transition timeline (server-authoritative audit list);
- action panels — only the available actions are rendered.

Confirmation + reason:

- Cancel HOLD: reason textarea, confirm dialog, double-submit guard.
- Cancel CONFIRMED: same + explicit warning when `paymentStatus = 'SUCCEEDED'`.
- No-show: reason textarea, confirm dialog.
- Resolve review: required note, confirm dialog, double-submit guard.

After every mutation the page reloads via `adminApi.getBooking(code)` so
the UI never optimistically invents final state.

## Playwright matrix (locked)

Focused Phase 7G browser suite runs with `workers=1`, `retries=0`,
`reporter=line` and exercises (in order):

1. ADMIN login.
2. Open booking list.
3. Filter by booking code.
4. Open detail (verify assigned physical room number is visible to ADMIN).
5. Cancel HOLD with reason; verify status `CANCELLED` and timeline entry.
6. Open CONFIRMED booking.
7. Check in; verify status `CHECKED_IN` and timeline entry.
8. Check out; verify status `CHECKED_OUT`, room becomes available.
9. Open another CONFIRMED booking.
10. Mark NO_SHOW with reason; verify timeline.
11. Cancel a paid CONFIRMED booking with reason; verify status `CANCELLED`.
12. Open `/admin/operational-reviews`; verify one OPEN review row.
13. Open the review; resolve with note.
14. Verify payment remains `SUCCEEDED`.
15. Verify booking remains `CANCELLED`.
16. CUSTOMER cookie cannot access `/admin/bookings` (redirected by middleware).
17. No page, console, or hydration errors.
18. No unexplained 5xx.

After focused Phase 7G passes:

- focused Phase 7F identity browser suite;
- focused affected legacy admin/public specs (admin-coupon, payment-provider-operations, public-booking-vertical-flow, customer-identity-browser);
- complete Playwright wrapper.

## Demo lifecycle (locked)

`pnpm demo:lifecycle-test` must continue to run 18/18 and prove:

1. room type and room exist;
2. availability works;
3. quote created;
4. HOLD created;
5. deterministic existing settlement confirms booking;
6. ADMIN opens booking;
7. **ADMIN checks in** (Phase 7G);
8. **ADMIN checks out** (Phase 7G);
9. lifecycle audit is correct (timeline contains `BOOKING_CHECKED_IN`
   and `BOOKING_CHECKED_OUT`);
10. room becomes available after check-out.

Also prove:

- cancelled HOLD releases room;
- cancelled HOLD releases coupon reservation;
- paid confirmed cancellation creates review (Phase 7G);
- review resolution preserves payment truth (Phase 7G);
- guest OTP remains green;
- CUSTOMER ownership remains green;
- Google-disabled demo remains green;
- MoMo and VNPAY implementation remains unchanged.

No production payment bypass is introduced.

## Validation gates (locked)

Run, capture exit code, captured passed/failed/skipped/duration:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm build`
- `pnpm check:openapi`
- `pnpm db:check`
- `pnpm db:status`
- `pnpm db:test`
- `pnpm --filter @room/database test:unit`
- `pnpm --filter @room/booking test:unit`
- `pnpm --filter @room/api test:unit`
- `pnpm --filter @room/api test:integration` (booking lifecycle,
  payment lifecycle, customer lifecycle)
- `pnpm --filter @room/web test:unit`
- `pnpm demo:preflight`
- `pnpm demo:lifecycle-test` (15/15, then 18/18 with Phase 7G steps)
- `pnpm demo:smoke`
- `pnpm exec playwright test tests/e2e/admin-booking-operations.spec.ts`
  (focused Phase 7G)
- `pnpm exec playwright test tests/e2e/customer-identity-browser.spec.ts`
  (focused Phase 7F regression)
- `node scripts/run-playwright.mjs` (full wrapper)

## Documentation deliverables

- `docs/architecture/adr/ADR-0009-admin-booking-lifecycle.md`
- `docs/handoffs/phase-7g-admin-booking-operations.md`
- `docs/handoffs/phase-7g-verdicts.md`
- `docs/audit/phase-7g-validation-report.md`
- `docs/runbooks/phase-7g-admin-operations-demo.md`
- `docs/security/AUTH_RBAC_POLICY.md` (extend with new permissions)
- `docs/engineering/admin-api-contract.md` (extend route matrix)
- generated OpenAPI artifacts (admin + public)

## Exclusions (locked)

No automatic refunds; no customer cancellation; no customer booking
modification; no date/time rescheduling; no room reassignment; no local
CUSTOMER passwords; no translation; no coupon email campaigns; no
MANAGER/RECEPTIONIST roles; no deployment; no SSL automation; no
multi-property expansion; no microservices; no Kafka; no event sourcing;
no mobile app.

## Out-of-scope items intentionally unchanged

- Better Auth, ADMIN auth, CUSTOMER Google identity (Phase 7F).
- MoMo / VNPAY provider adapters (Phases 7D/7E).
- Pricing/availability/quote (Phase 4).
- Coupon core (Phase 6).
- Booking HOLD (Phase 5).
