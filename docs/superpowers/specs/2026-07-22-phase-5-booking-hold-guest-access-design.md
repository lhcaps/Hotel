# Phase 5: Booking HOLD and secure guest access — Design

**Status**: Approved for implementation
**Date**: 2026-07-22
**Author**: Phase 5 execution agent
**Objective**: Convert Phase 4 quotes into transactional booking HOLDs with secure guest OTP access

---

## Executive summary

Phase 5 implements the first inventory-reserving booking state. It does not collect or confirm payment.

A public guest submits contact details against an unexpired Phase 4 quote. The system allocates one physical room transactionally, creates an ACTIVE inventory block, copies the quote price exactly, and delivers a booking code. The HOLD expires after 15 minutes unless confirmed by payment (Phase 7). Guest access requires booking code plus email plus OTP verification, establishing a booking-scoped HttpOnly session.

**Architecture decisions approved** (each verified against the current repository):

- PostgreSQL is the final allocation authority.
- READ COMMITTED isolation with deterministic explicit row locks.
- FOR UPDATE SKIP LOCKED for outbox claim and HOLD expiration sweeps.
- Existing GiST exclusion constraint `room_inventory_blocks_active_overlap_excl` is the final overlap guard.
- Transactional PostgreSQL outbox with explicit lease protocol.
- `bookings.quote_id` is nullable for historical rows; when present, a global partial unique index enforces that one quote may create at most one booking for its entire lifetime, regardless of the resulting booking status.
- Equivalent-contact retries on the same quote are idempotent; a materially different contact on an already-consumed quote is rejected.
- Raw OTP is never persisted; raw session token is never persisted.
- Guest session is bound to one booking.
- Worker owns its PostgreSQL Pool lifecycle.
- Actual database API:
  ```ts
  const pool = createDatabasePool(connection, options);
  const db = createDatabaseClient(pool);
  await pool.end();
  ```

**Roadmap**:

- Phase 6 — Coupon reservation and redemption
- Phase 7 — MoMo/VNPAY payment orchestration and HOLD → CONFIRMED

**Non-goals for Phase 5**:

- Coupons (Phase 6)
- Payment integration (Phase 7)
- Booking confirmation beyond HOLD (Phase 7)
- Guest cancellation
- ADMIN booking management UI

---

## A. Scope and non-goals

### In scope

- Public endpoint that consumes a Phase 4 quote into a HOLD booking.
- Transactional allocation of one physical room.
- Creation of one ACTIVE inventory block.
- Idempotent retry for equivalent normalized guest contact.
- Bounded-batch stale-HOLD cleanup before allocation.
- Outbox-driven HOLD confirmation email.
- Time-bound unverified-challenge coalescing with one active challenge per booking.
- Booked-guest OTP request, derivation, verification and re-issue.
- 30-minute guest session bound to one booking with HttpOnly cookie.
- Management page reachable from email via booking code plus email OTP.
- Mailpit/SMTP integration tests.

### Out of scope

- Coupons, loyalty, voucher redemption (Phase 6).
- Payment gateways, money movement, HOLD → CONFIRMED (Phase 7).
- ADMIN cancellation, modification or refund paths.
- Real-customer self-service cancellation UI.
- Any access to guest data from CUSTOMER or ADMIN roles.
- Maintenance admin tooling.
- Internationalization and multi-currency (currency remains VND only).

---

## B. Current repository facts (verified)

### Quote table (`packages/database/src/schema.ts:376–433`)

- `quotes.id`: uuid primary key.
- `quotes.property_id`, `quotes.room_type_id`: foreign keys.
- `quotes.base_amount_vnd`, `quotes.extra_amount_vnd`, `quotes.total_amount_vnd`: `bigint` columns. `quotes.currency` defaulted to `'VND'`. CHECK constraint `quotes_currency_vnd_ck` enforces VND.
- `quotes.pricing_snapshot`: `jsonb`, non-empty object. CHECK `quotes_pricing_snapshot_ck`.
- `quotes.expires_at > quotes.created_at` enforced by `quotes_expiry_ck`.
- `quotes_quarter_hour_ck`: 15-minute granularity for `check_in` and `check_out`.
- `quotes_duration_ck`: 60 minutes to 24 hours inclusive.
- Index `quotes_expiry_idx` on `expires_at`.
- Phase 4 trigger `quotes_reject_mutation` rejects every UPDATE and DELETE (`packages/database/drizzle/0004_natural_paper_doll.sql:36–47`). The quote row is therefore immutable.

### Booking table (`packages/database/src/schema.ts:436–510`)

- `bookings.id`, `bookings.booking_code`: uuid and text respectively.
- `bookings.status`: enum `booking_status` including `HOLD`, `CONFIRMED`, `EXPIRED`.
- Money fields are bigint: `gross_amount_vnd`, `discount_amount_vnd`, `final_amount_vnd`.
- `bookings.price_snapshot`: immutable `jsonb`.
- `bookings.hold_expires_at`: timestamptz, must be `> created_at`.
- `bookings.expired_at`: must be set iff status is `EXPIRED`.
- Unique index `bookings_property_booking_code_uq` on `(property_id, booking_code)`.
- Composite unique `bookings_property_room_id_uq` on `(property_id, room_id, id)`.
- Phase 2 trigger `bookings_reject_immutable_fact_mutation` rejects any change to `hold_expires_at` or `price_snapshot` (`packages/database/drizzle/0001_custom_invariants.sql:59–76`).
- Phase 5 does NOT add `original_hold_expires_at`. The single `hold_expires_at` column is the immutable original deadline; status transitions update `status`, `expired_at`, and `updated_at` only.

### Inventory exclusion constraint (`packages/database/drizzle/0001_custom_invariants.sql:5–11`)

- `room_inventory_blocks_active_overlap_excl` is a GiST EXCLUDE on `(room_id =, tstzrange(starts_at, ends_at, '[)') &&)` WHERE `status = 'ACTIVE'`.
- This is the final guard against double-allocation. Any second insert with overlapping ACTIVE interval for the same room raises `23P01 exclusion_violation`.

### Outbox schema (`packages/database/src/schema.ts:635–666`)

- `outbox_events` with `status` enum `PENDING | PUBLISHED | FAILED`.
- `attempt_count`, `available_at`, `published_at`, `last_error` text.
- Index `outbox_events_pending_available_idx` on `(available_at, created_at) WHERE status = 'PENDING'`.
- CHECK `outbox_events_published_at_ck` enforces published_at set iff PUBLISHED.

### Database factory (`packages/database/src/client.ts`)

- `createDatabasePool(connection, options): Pool` with `connectionString`, `application_name`, `connectionTimeoutMillis`, `idleTimeoutMillis`, `max`.
- `createDatabaseClient(pool): DatabaseClient` — no `pool` accessor.
- `withDatabasePool(...)` exists only for short-lived call sites.
- There is no `closeDatabasePool`. Lifecycle is `await pool.end()`.

### Worker lifecycle (`apps/worker/src/main.ts`, `apps/worker/src/lifecycle.ts`)

- `WorkerLifecycle` takes a `{ close: async () => void }` callback.
- SIGINT and SIGTERM trigger `shutdown(signal)`.
- Current worker only owns Redis. Phase 5 adds PostgreSQL ownership.
- Redis does not have a Phase 5 consumer; the design removes required Redis startup for Phase 5 unless explicitly toggled.

### Phase 4 money serialization (`packages/contracts/src/pricing.ts`)

- `amountVndSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)`.
- `currency: z.literal('VND')`.
- `baseAmountVnd`, `extraAmountVnd`, `totalAmountVnd` are emitted as `number`, not `bigint`. The wire form is JSON-safe.
- Phase 5 must match exactly: same field names, same currency literal, same bigint-as-number conversion at the API boundary; never emit raw bigint to JSON.

### Immutability policy inherited from prior phases

- `audit_events` is append-only via `audit_events_reject_mutation`.
- Quotes reject every UPDATE/DELETE.
- Bookings reject mutation of `hold_expires_at` and `price_snapshot`.
- Phase 5 widens the immutability surface for bookings to include `quote_id`, `booking_code`, `property_id`, `room_type_id`, `room_id`, `check_in`, `check_out`, `occupancy`, `currency`, `gross_amount_vnd`, `discount_amount_vnd`, `final_amount_vnd`, and `pricing_rule_version`.

---

## C. Quote consumption

### Data model decisions

- `bookings.quote_id` is **nullable**. It supports future historical booking rows that predate Phase 5.
- A global partial unique index ensures at most one booking per non-null quote, regardless of status:

  ```sql
  CREATE UNIQUE INDEX bookings_quote_id_uq
    ON bookings (quote_id)
    WHERE quote_id IS NOT NULL;
  ```

- Once a quote creates a booking, that quote can never create another booking, even after the first booking reaches `EXPIRED`, `CANCELLED`, or `NO_SHOW`.
- `bookings.pricing_rule_version` records the snapshot rule version that produced the quote.
- Quote snapshot fields are copied into booking snapshot fields with no discount:
  - `quotes.total_amount_vnd` → `bookings.gross_amount_vnd`
  - `0` → `bookings.discount_amount_vnd`
  - `quotes.total_amount_vnd` → `bookings.final_amount_vnd`
  - `quotes.currency` → `bookings.currency`
  - `quotes.pricing_snapshot` → `bookings.price_snapshot`
- Pricing is never recomputed during HOLD creation.

### Endpoint contract

- POST `/api/v1/public/quotes/{quoteId}/bookings`
- Request body:

  ```json
  {
    "contact": {
      "fullName": "string",
      "email": "string",
      "phone": "string"
    }
  }
  ```

- 200 response:

  ```json
  {
    "booking": {
      "id": "uuid-do-not-display-publicly",
      "bookingCode": "RM-XXXX-XXXX-XXXX",
      "status": "HOLD",
      "checkIn": "iso8601",
      "checkOut": "iso8601",
      "holdExpiresAt": "iso8601",
      "pricing": {
        "baseAmountVnd": 359000,
        "extraAmountVnd": 60000,
        "totalAmountVnd": 419000,
        "currency": "VND"
      }
    }
  }
  ```

- Errors use Problem Details (RFC 7807). Distinct error codes:
  - `QUOTE_NOT_FOUND`
  - `QUOTE_EXPIRED`
  - `ROOM_TYPE_UNAVAILABLE` — no available room after stale cleanup bound was hit by a non-stale cause.
  - `STALE_HOLD_CLEANUP_RETRY` — stale HOLDs remain after the bounded cleanup pass; the client may retry shortly.
  - `QUOTE_ALREADY_USED` — a different materially-incompatible contact attempted re-allocation.
  - `CONTACT_VALIDATION_FAILED`.

### Contact normalization and idempotency

- `fullName`: trim, NFC-normalize, collapse internal whitespace.
- `email`: trim, lowercase, RFC 5322 domain-validated, length-bounded.
- `phone`: E.164 via `libphonenumber-js`.
- Idempotency is enforced by the global quote unique index plus contact equivalence check within the transaction.

### Idempotency algorithm

Within the allocation transaction:

1. Lock the quote row: `SELECT ... FROM quotes WHERE id = $1 FOR UPDATE`.
2. Query existing booking: `SELECT ... FROM bookings WHERE quote_id = $1`.
3. If a booking exists:
   - Load its immutable contact from `booking_contacts`.
   - Compare normalized `fullName`, `email`, `phoneE164`.
   - If equivalent, return the existing booking (idempotent success).
   - If different, return `QUOTE_ALREADY_USED`.
4. If no booking exists, proceed with allocation.

No `contact_hash` column is required unless a proven query optimization demands it.

### Concurrent behavior (quote + equivalent normalized contact)

Two concurrent requests with the same normalized contact:

- Both lock the quote row.
- The first completes the booking insert; the global quote unique index ensures only one booking is created.
- The second transaction, after acquiring the quote lock, reads the newly committed booking, compares contacts, finds equivalence, and returns the same booking.
- No `QUOTE_ALREADY_USED` is reported.
- Exactly one row exists in `bookings`, exactly one in `booking_contacts`, exactly one ACTIVE inventory block.

### Concurrent behavior (quote + materially different contact)

Two concurrent requests with different normalized contacts:

- The first completes the booking insert.
- The second, after acquiring the quote lock, reads the committed booking, compares contacts, finds a mismatch, and returns `QUOTE_ALREADY_USED`.
- No phantom rows, no orphan blocks.

---

## D. Allocation transaction

### Transactional sequence

1. Lock quote: `SELECT ... FROM quotes WHERE id = $1 FOR UPDATE`. Reject if missing or expired.
2. Check existing booking by globally unique quote: `SELECT ... FROM bookings WHERE quote_id = $1`.
3. If booking exists, load immutable contact, compare normalized fields, return existing booking if equivalent, else `QUOTE_ALREADY_USED`.
4. Targeted stale-HOLD cleanup (bounded, see §E) affecting only this property, room type, and interval.
5. Select exactly one candidate room: `SELECT ... FROM rooms WHERE room_type_id = $1 AND status = 'ACTIVE' ORDER BY code ASC FOR UPDATE SKIP LOCKED LIMIT 1`. If no row returned, perform existence probe (§D.2) to classify the error.
6. `INSERT INTO bookings ...` with snapshot fields and `hold_expires_at = now() + interval '15 minutes'`.
7. `INSERT INTO booking_contacts ...` with normalized contact.
8. `INSERT INTO room_inventory_blocks (...) VALUES (...)` with `status = 'ACTIVE'`, referencing the booking.
9. `INSERT INTO audit_events ...` with `event_type = 'HOLD_CREATED'` (no PII).
10. `INSERT INTO outbox_events ...` with payload `{ "eventVersion": 1, "bookingId": ... }` (no PII).
11. `COMMIT`.

**Critical**: The booking and contact rows must be inserted before the inventory block, so the foreign key from `room_inventory_blocks.booking_id` is satisfied. If the GiST exclusion constraint fires at step 8, the entire transaction is aborted by PostgreSQL. The transaction is rolled back completely, leaving no orphan booking, contact, audit, or outbox rows. The allocation logic does not continue to a next candidate inside the aborted transaction.

### Lock order

The transaction acquires locks in this fixed order to prevent deadlocks:

1. `quotes` row (FOR UPDATE).
2. Existing booking row by quote (if any) via SELECT.
3. Candidate `rooms` rows in code order (FOR UPDATE SKIP LOCKED).
4. `bookings` insert.
5. `booking_contacts` insert.
6. `room_inventory_blocks` insert (references booking via foreign key).
7. `audit_events` and `outbox_events` inserts.

### Existence probe after selection failure

When `LIMIT 1` returns no rows, run an existence probe to classify the error:

```sql
SELECT COUNT(*) FROM rooms r
WHERE r.room_type_id = $roomTypeId
  AND r.property_id = $propertyId
  AND r.status = 'ACTIVE';
```

If the count is zero, return `ROOM_TYPE_UNAVAILABLE` (structural unavailability).

If the count is positive, return `ALLOCATION_BUSY` (all eligible rooms are currently locked by competing transactions; retryable).

### Errors mapped to API

| Database condition                                                          | API code                                                                                                                                                                |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quote row missing                                                           | `QUOTE_NOT_FOUND`                                                                                                                                                       |
| `quotes.expires_at <= now()`                                                | `QUOTE_EXPIRED`                                                                                                                                                         |
| FOR UPDATE SKIP LOCKED returned empty, existence probe shows positive count | `ALLOCATION_BUSY` (retryable)                                                                                                                                           |
| FOR UPDATE SKIP LOCKED returned empty, existence probe shows zero count     | `ROOM_TYPE_UNAVAILABLE`                                                                                                                                                 |
| `23P01` GiST exclusion, unresolved targeted stale rows remain               | `STALE_HOLD_CLEANUP_RETRY`                                                                                                                                              |
| `23P01` GiST exclusion, no stale rows remaining                             | `ALLOCATION_BUSY` (retryable: immediate loser during winner's transaction) or `ROOM_TYPE_UNAVAILABLE` (after winner commits and retry finds no structural availability) |
| Quote-bound booking with non-equivalent contact                             | `QUOTE_ALREADY_USED`                                                                                                                                                    |
| Check constraint violation                                                  | `VALIDATION_ERROR`                                                                                                                                                      |

### Rollback guarantees

- The transaction is fully atomic. A GiST exclusion constraint violation (`23P01`) at step 8 aborts the entire transaction. PostgreSQL does not allow continued execution inside an aborted transaction unless savepoints are used. Phase 5 does not use savepoints.
- The allocation logic returns a retryable error code. The client may retry the entire allocation with a fresh transaction. No orphan rows remain after rollback.

### Public input/output surface

- The physical room ID is **never** exposed in any Phase 5 public response.
- Only `bookingCode`, `status`, `holdExpiresAt` and totals are returned.

---

## E. Stale-HOLD cleanup

### Bounded targeted approach

A stale HOLD is a `bookings` row with `status = 'HOLD'` and `hold_expires_at <= now()` whose `room_inventory_blocks` row is still `ACTIVE`. Stale HOLDs may exist if a worker iteration was killed mid-transaction.

The allocation transaction performs **targeted cleanup** limited to stale HOLDs that can block the current request:

- Same property
- Same room type
- Overlapping check-in/check-out interval
- Affecting the specific candidate rooms under consideration

### Cleanup algorithm

- `batchSize = 50`
- `maxBatches = 4`
- Run only inside the allocation transaction as a bounded loop with targeted filtering:

  ```text
  for batchIndex in 0..3:
    staleIds := SELECT b.id FROM bookings b
                JOIN room_inventory_blocks rib ON rib.booking_id = b.id
                WHERE b.status = 'HOLD'
                  AND b.hold_expires_at <= now()
                  AND b.property_id = $propertyId
                  AND b.room_type_id = $roomTypeId
                  AND rib.room_id IN ($candidateRoomIds)
                  AND tstzrange(rib.starts_at, rib.ends_at, '[)') && tstzrange($checkIn, $checkOut, '[)')
                  AND rib.status = 'ACTIVE'
                ORDER BY b.hold_expires_at ASC, b.id ASC
                LIMIT 50
                FOR UPDATE OF b SKIP LOCKED;
    if staleIds is empty: break;
    UPDATE bookings
       SET status = 'EXPIRED', expired_at = now(), updated_at = now()
     WHERE id IN staleIds;
    UPDATE room_inventory_blocks
       SET status = 'RELEASED', released_at = now()
     WHERE booking_id IN staleIds AND status = 'ACTIVE';
    INSERT INTO audit_events ... event_type = 'HOLD_EXPIRED' ...
    INSERT INTO outbox_events ... event_type = 'booking.hold.expired' ...
  ```

- If after the fourth batch there remain stale rows that can still block allocation, return `STALE_HOLD_CLEANUP_RETRY`.
- If all stale rows are cleaned and no candidate room remains available, return `ROOM_TYPE_UNAVAILABLE`.
- The periodic worker performs global cleanup across all properties and room types.

### Safety properties

- SKIP LOCKED prevents two workers from racing over the same stale row.
- Updates against already-processed rows are idempotent because the `status = 'HOLD'` predicate gates them.
- A single batch is at most 50 rows, so transaction latency stays bounded.

### Allocation contention and availability semantics

The API distinguishes four states:

- `ALLOCATION_BUSY`: All structurally eligible rooms are currently locked by competing allocation transactions (FOR UPDATE SKIP LOCKED returned empty, existence probe shows positive count), or a GiST exclusion occurred during a concurrent winner's transaction. Client should retry immediately. This is not a structural availability problem.
- `STALE_HOLD_CLEANUP_RETRY`: Targeted cleanup hit the safety bound with remaining stale rows that can still block allocation. Client should retry after a brief delay.
- `ROOM_TYPE_UNAVAILABLE`: No structurally allocatable rooms exist (existence probe returned zero after targeted cleanup), or all rooms remain occupied after a concurrent winner commits and the retry finds no available room. Client should reconsider the interval or room type.
- `QUOTE_ALREADY_USED`: A materially different normalized contact attempted to consume the same quote.

### Last-room concurrency expectations

When two clients concurrently request the only available room:

- **During the winner's transaction**: The loser's `FOR UPDATE SKIP LOCKED` returns empty (the room is locked). The existence probe shows count=1 (the room exists). The loser receives `ALLOCATION_BUSY`.
- **After the winner commits**: The loser retries. Targeted cleanup has no stale rows to remove. `FOR UPDATE SKIP LOCKED` returns empty (no ACTIVE overlap exists, but the room now has a committed ACTIVE block). The existence probe shows count=1, but a structural availability check (not yet locked, but occupied by a committed block) would show zero free rooms. Phase 5 distinguishes this case via a GiST exclusion attempt: if the insert fails with `23P01` and no stale rows remain, return `ALLOCATION_BUSY` on first attempt, or `ROOM_TYPE_UNAVAILABLE` after the winner's commit is visible and no room remains available.

Exact test assertions:

- Immediate loser (during winner's transaction) → `ALLOCATION_BUSY`
- Retry after winner commits → `ROOM_TYPE_UNAVAILABLE`

These are documented in the public error catalog (`docs/contracts/errors.md`, added in Task 9).

---

## F. Booking-code generation

### Alphabet

```text
123456789ABCDEFGHJKMNPQRSTUVWXYZ
```

Exactly 32 characters. The alphabet excludes `0`, `O`, `I`, `L` to avoid human misreading.

### Format

```text
RM-XXXX-XXXX-XXXX
```

Where each `X` is one character of the 32-character alphabet. Twelve symbols total.

### Regex validation

```regex
^RM-[1-9A-HJKMNP-Z]{4}-[1-9A-HJKMNP-Z]{4}-[1-9A-HJKMNP-Z]{4}$
```

This regex explicitly excludes `0`, `O`, `I`, `L` from each character class.

### Entropy

- 12 symbols × log2(32) = 60 bits of entropy per code.

### RNG injection

```ts
export type RandomIndexSource = (upperExclusive: number) => number;
```

Production uses `crypto.randomInt`:

```ts
import { randomInt } from 'node:crypto';
const defaultRandomIndexSource: RandomIndexSource = (n) => randomInt(0, n);
```

Test code injects deterministic sources (linear congruential, fixed arrays) so that all randomness is reproducible.

### Pure generator

```ts
export function generateBookingCode(
  randomIndexSource: RandomIndexSource = defaultRandomIndexSource,
): string;
```

- Does not consult the database.
- Does not track state.
- Returns the canonical 17-character string.

### Normalizer

```ts
export function normalizeBookingCode(raw: string): string;
```

- Trims leading and trailing whitespace.
- Uppercases ASCII characters.
- Validates the exact `^RM-[1-9A-HJKMNP-Z]{4}-[1-9A-HJKMNP-Z]{4}-[1-9A-HJKMNP-Z]{4}$` format.
- Throws on invalid input or any excluded character (`0`, `O`, `I`, `L`).

### Storage

- The code is stored as-is, uppercased, in `bookings.booking_code` with a unique constraint `(property_id, booking_code)`.
- Uniqueness is enforced by the database, not by the generator.

---

## G. Complete transaction retry

### Wrapper

```ts
export async function createBookingHoldWithRetry(
  input: CreateBookingHoldInput,
  options?: { maxAttempts?: number },
): Promise<BookingHoldResult>;
```

Default `maxAttempts = 5`.

### Retry rules

Each attempt runs the full §D transaction. After each failed commit:

- If `sqlstate === '23505'` AND the violation is on the `bookings_property_booking_code_uq` index, generate a new booking code and retry.
- All other `23505` violations (quote uniqueness, contact uniqueness) **do not retry**.
- Exclusion-constraint failures (`23P01`) **do not retry**.
- Validation errors do not retry.
- Contact-mismatch errors do not retry.
- A retry never resumes inside an aborted transaction; each attempt opens a fresh `db.transaction(...)`.

### Deterministic collision injection tests

Task 4 uses an injected `RandomIndexSource` that returns a fixed sequence to deterministically force a collision on attempt 1 and 2, succeed on attempt 3.

---

## H. Digest representation

### Canonical representation

All digests are SHA-256 of a single canonical byte input. Stored as `BYTEA` of length exactly 32. A SQL named check enforces length:

```sql
CHECK (octet_length(<column>) = 32)
```

### Columns covered

| Logical name        | Column                                      | Domain label                       |
| ------------------- | ------------------------------------------- | ---------------------------------- |
| OTP nonce           | `guest_otp_challenges.nonce`                | `room-management/otp/v1`           |
| Email lookup        | `booking_contacts.email_digest`             | `room-management/email-lookup/v1`  |
| IP rate-limit       | `guest_otp_challenges.request_ip_digest`    | `room-management/ip-rate-limit/v1` |
| Guest session       | `guest_sessions.token_digest`               | `room-management/guest-session/v1` |
| Challenge reference | `guest_otp_challenges.challenge_ref_digest` | `room-management/challenge-ref/v1` |

### Domain-separated HMAC input

The HMAC input is constructed as the UTF-8 byte concatenation of:

```text
DOMAIN_LABEL || '\x1f' || <canonical serialization>
```

### Canonical serialization (no string concatenation of ambiguous types)

- UUID: 16 big-endian bytes.
- Nonce: 32 raw bytes.
- Epoch timestamp: 8 big-endian unsigned bytes (millisecond precision; bumpable to 16 if nanoseconds are introduced).
- Version byte.

`Buffer.concat([label, 0x1f, ...bytes])` is the only allowed construction site.

### OTP derivation

Phase 5 uses **unbiased rejection sampling** to derive a six-digit OTP:

```ts
function deriveOTP(input: OTPInput): string {
  const UINT32_RANGE = 2 ** 32;
  const OTP_SPACE = 1_000_000;
  const limit = Math.floor(UINT32_RANGE / OTP_SPACE) * OTP_SPACE;
  let counter = 0;

  while (counter < 100) {
    // safety bound
    const mac = hmacSha256(
      input.secretKey,
      Buffer.concat([input.labelByteSequence, Buffer.from([counter])]),
    );
    const offset = mac[mac.length - 1] & 0x0f;
    const candidate =
      ((mac[offset] & 0xff) << 24) |
      ((mac[offset + 1] & 0xff) << 16) |
      ((mac[offset + 2] & 0xff) << 8) |
      (mac[offset + 3] & 0xff);

    if (candidate < limit) {
      return (candidate % OTP_SPACE).toString().padStart(6, '0');
    }
    counter++;
  }

  throw new Error('OTP derivation exceeded retry limit');
}
```

This eliminates modulo bias by using the full unsigned 32-bit range. The first byte uses `& 0xff` (not `& 0x7f`) to preserve all 32 bits. Verification is constant-time via `timingSafeEqual` on exactly 6 ASCII bytes.

### Secret rotation

The `secretKey` is loaded from `env.GUEST_OTP_SECRET_V1`. Phase 5 supports a single active version. Rotation would require invalidating all pending challenges and sessions, which is acceptable because the absolute TTL is 30 minutes. The Phase 5 design does not implement multi-version rotation; that is deferred to Phase 8.

---

## I. OTP challenge contract

### Request endpoint

`POST /api/v1/public/guest-access/otp/request`

Request body:

```json
{
  "bookingCode": "RM-XXXX-XXXX-XXXX",
  "email": "lowercase@example.com"
}
```

Response: Always HTTP 202 with identical shape, regardless of validity:

```json
{
  "challengeRef": "opaque-base32-string",
  "message": "If the booking exists, an OTP has been sent.",
  "resendAvailableIn": 60
}
```

### Challenge reference design

The public `challengeRef` is deterministically derived from the internal challenge UUID:

```text
challengeRef = base32(
  truncate20(
    HMAC-SHA256(
      GUEST_CHALLENGE_REF_SECRET,
      "room-management/challenge-ref/v1" || challengeUuidBytes
    )
  )
)
```

This produces a 32-character Base32 string. Only the keyed digest (SHA-256 or HMAC) is stored in `guest_otp_challenges.challenge_ref_digest` for lookup.

Because the public ref is deterministic from the internal challenge ID, the server can re-derive the same ref during cooldown without storing plaintext.

### Behavior

For a valid `(bookingCode, email)` pair (booking exists, status is `HOLD` or `CONFIRMED`, contact email digest matches):

- A new `guest_otp_challenges` row is inserted with the challenge UUID and `challenge_ref_digest`.
- The deterministic `challengeRef` is computed and returned.
- An outbox event is emitted.

For an invalid pair:

- No challenge is inserted.
- A syntactically valid random non-resolving `challengeRef` is returned.
- The same JSON shape and HTTP 202 are returned.
- The same response latency is imposed.

### Verification endpoint

`POST /api/v1/public/guest-access/otp/verify`

Request body:

```json
{ "challengeRef": "opaque-base32-string", "otp": "123456" }
```

Response on success:

```json
{
  "authenticated": true,
  "bookingCode": "RM-XXXX-XXXX-XXXX"
}
```

The session token is delivered **only** via `Set-Cookie` header. It is never included in the JSON response body.

Errors (all external errors use generic code):

- `OTP_INVALID_OR_EXPIRED` — covers challenge not found, expired, consumed, replaced, or OTP mismatch
- `OTP_RATE_LIMITED` — attempt limit exceeded (may expose rate-limit state)

The external API does not distinguish between not-found, expired, consumed, replaced, or wrong OTP. Internal logs may record detailed failure reasons.

### Public identifiers

Database challenge UUID is never returned. The `challengeRef` is a 32-character base32 string with the same alphabet as booking codes.

### Storage constraints

- The `challengeRef` is never logged.
- It is held in component state only and posted back to the same endpoint to consume.
- It is never placed in URLs or `localStorage`.
- A booking-scoped session cookie is set immediately on verification success.

### Contracts

- Shared Zod schemas live in `packages/contracts/src/booking/otp.ts`.
- OpenAPI fragment authored in Task 9 from these schemas.

---

## J. One active OTP challenge

### Database constraint

```sql
CREATE UNIQUE INDEX guest_otp_challenges_one_active_booking_uq
  ON guest_otp_challenges (booking_id)
  WHERE consumed_at IS NULL
    AND replaced_at IS NULL;
```

### OTP-request transaction

1. Normalize `bookingCode` and `email` to canonical forms.
2. Resolve and lock the booking row: `SELECT ... FROM bookings WHERE booking_code = $1 FOR UPDATE`.
3. Verify the email digest matches the booking's contact email digest, applying rate limits keyed on `(booking_id, email_digest, created_at)` and `(request_ip_digest, created_at)` at database time.
4. Replace the previous active challenge for that booking: `UPDATE ... SET replaced_at = now() WHERE booking_id = $1 AND consumed_at IS NULL AND replaced_at IS NULL`.
5. Insert the new challenge with a fresh nonce.
6. Insert the outbox event with payload `{ "eventVersion": 1, "challengeId": ... }` (the database UUID is internal; the public challengeRef is the only externally visible identifier).
7. `COMMIT`.

### Concurrent behavior

Two concurrent OTP-request transactions on the same booking:

- The first acquires the row lock.
- The second waits.
- The first replaces previous, inserts new, commits.
- The second reads the new active challenge, replaces it, inserts its own, commits.
- The database returns both challenges under the partial index constraint; one becomes the active record for the second caller's reference.

If two requests race for the same booking within milliseconds, the second caller's challenge becomes the only active one — older challenges are marked `replaced_at`. The 60-second cooldown enforces a deterministic request budget on the public side.

---

## K. Rate limiting and OTP policy

### Fixed OTP policy

- OTP TTL: **10 minutes** from challenge creation
- Resend cooldown: **60 seconds** between requests for the same booking+email pair
- Request rate limit: **3 OTP requests per 15 minutes** for the same booking+email pair
- Verification attempt limit: **5 failed attempts** per challenge
- The 6th verification attempt fails even if the OTP is correct
- Per-IP rate limit: bounded and documented with a testable number (e.g., 20 requests per hour per IP)
- Cooldown behavior: during the 60-second cooldown, a valid booking+email pair returns the same deterministically re-derived `challengeRef` without inserting a new challenge or emitting a second email

### Concurrency and replacement

- A new OTP request for the same booking replaces the previous active challenge by marking it `replaced_at`.
- The replacement occurs only after the cooldown period expires or when the user explicitly requests a new OTP.
- During cooldown, the first caller's challenge remains active and usable.

### Required indexes

```sql
CREATE INDEX guest_otp_challenges_booking_email_created_idx
  ON guest_otp_challenges (booking_id, email_digest, created_at DESC);

CREATE INDEX guest_otp_challenges_ip_created_idx
  ON guest_otp_challenges (request_ip_digest, created_at DESC);

CREATE INDEX guest_otp_challenges_active_partial_idx
  ON guest_otp_challenges (booking_id)
  WHERE consumed_at IS NULL AND replaced_at IS NULL;
```

### Removed index

`booking_contacts_email_idx` does **not** exist. Public lookups start from the unique booking code and then check `email_digest = digest(lowercase_email)` in constant time.

---

## L. Guest session

### Token structure and storage

- 256 bits of randomness encoded as base32 in the cookie.
- Stored only as `token_digest = HMAC-SHA256(GUEST_SESSION_SECRET_V1, "room-management/guest-session/v1" || tokenBytes)`.
- `token_digest` has a `CHECK (octet_length(token_digest) = 32)` constraint.
- Raw session token is never persisted; only the digest is stored.

### Storage columns

- `guest_sessions.id`: uuid primary key.
- `guest_sessions.booking_id`: foreign key, NOT NULL.
- `guest_sessions.token_digest`: bytea, NOT NULL.
- `guest_sessions.expires_at`: timestamptz, NOT NULL, `> created_at`.
- `guest_sessions.revoked_at`: nullable.
- `guest_sessions.created_ip_digest`: bytea, optional.
- `guest_sessions.created_at`: timestamptz.

The design does not include `consumed_at` or `last_seen_at` unless an actual Phase 5 use case requires them.

### TTL semantics

- Absolute TTL of 30 minutes from issuance.
- No sliding extension. Re-issuance is allowed only after successful OTP re-verification.
- Revocation on logout.

### Cookie attributes

- `HttpOnly: true`
- `SameSite: Lax`
- `Secure: true` in production
- `Path: /` (must reach guest API endpoints under `/api/v1`)
- `Name: rm_guest_session_v1`
- `Max-Age: 1800` (30 minutes)

### Authorization scopes

- Guest sessions grant only `booking:read` and `booking:self-service` permissions.
- They grant no ADMIN or CUSTOMER permission.
- The session's `booking_id` is the bound target. Any operation on another booking is rejected.

---

## M. Worker database lifecycle

### Boot order

1. Load environment.
2. Create the PostgreSQL Pool:

   ```ts
   const pool = createDatabasePool(env.DATABASE_URL, {
     applicationName: 'room-management-worker',
     max: 5,
     idleTimeoutMillis: 30_000,
   });
   const db = createDatabaseClient(pool);
   ```

3. Create SMTP transport (Task 6).
4. Create rate-limit resources if any exist; Phase 5 does not require Redis.
5. Register shutdown handlers.

### Shutdown order

1. Stop scheduling new iterations (`draining = true`).
2. Mark the lifecycle as draining; existing iterations receive a `draining` flag and finish their current batch.
3. `await expirationIter` (if active).
4. `await outboxIter` (if active).
5. Close SMTP transport.
6. `await pool.end()`.
7. Close Redis resources **only if** Redis was actively used (none in Phase 5 baseline).

### Redis policy

If Redis has no active Phase 5 consumer, the design removes Redis from required worker startup. It can remain conditionally enabled via `WORKER_ENABLE_REDIS=true` and is closed last.

---

## N. Outbox lease protocol

### Schema additions (in Phase 5 migration)

```text
outbox_events.lease_id          uuid NULL
outbox_events.claimed_at        timestamptz NULL
outbox_events.lease_expires_at  timestamptz NULL
outbox_events.last_error_category text NULL
```

`status` ('PENDING', 'PUBLISHED', 'FAILED') is implicit processing status; 'PENDING' rows are either claimable or in-flight, distinguished by `lease_expires_at`.

### Transaction A — claim

```ts
async function claimOutboxBatch(input: ClaimOutboxBatchInput): Promise<OutboxClaimRow[]>;
```

1. `reclaimExpiredOutboxLeases(workerId, leaseTtl)`: mark stale leases back to `PENDING`, `available_at = now()`, `last_error_category = 'LEASE_TIMEOUT'`.
2. `SELECT id, event_type, aggregate_id, payload FROM outbox_events WHERE status='PENDING' AND available_at <= now() AND (lease_expires_at IS NULL OR lease_expires_at <= now()) ORDER BY available_at ASC, id ASC LIMIT $batchSize FOR UPDATE SKIP LOCKED`.
3. For each selected row:
   - `UPDATE outbox_events SET lease_id = $workerId, claimed_at = now(), lease_expires_at = now() + leaseTtl, attempt_count = attempt_count + 1 WHERE id = $rowId`.
4. `COMMIT`.
5. Return claimed rows with their load hints.

### Transaction B — finalize

```ts
async function finalizeOutboxSuccess(input: FinalizeSuccessInput): Promise<void>;
async function finalizeOutboxFailure(input: FinalizeFailureInput): Promise<void>;
```

- Success: `UPDATE outbox_events SET status='PUBLISHED', published_at = now(), lease_id = NULL, claimed_at = NULL, lease_expires_at = NULL WHERE id = $eventId AND lease_id = $leaseId AND status = 'PENDING'`.
- Failure: `UPDATE outbox_events SET status='PENDING', lease_id = NULL, claimed_at = NULL, lease_expires_at = NULL, last_error_category = $category, available_at = now() + backoff, attempt_count = attempt_count WHERE id = $eventId AND lease_id = $leaseId AND status = 'PENDING'`.
- A worker that lost the lease cannot finalize the row (compare-and-swap on `lease_id`).
- Backoff: `1s * 2^(attempt_count - 1)` capped at 5 minutes.
- Error categories: `SMTP_TIMEOUT`, `SMTP_CONNECT`, `TEMPLATE_RENDER`, `BOOKING_GONE`, `CHALLENGE_GONE`, `LEASE_TIMEOUT`. No raw exception text is persisted.

### Delivery semantics

- At-least-once delivery.
- `Message-ID = <{outbox_event_id}@roommanagement.example.com>` for SMTP.
- Duplicate delivery remains possible; the consumer (guest) is the source of truth.
- No exactly-once claim.

---

## O. Email actionability

### HOLD confirmation

- Worker loads booking + contact.
- If `bookings.status = 'EXPIRED'`, skip sending. The template wording must not imply an active HOLD after expiry.
- For `HOLD` and `CONFIRMED` states, send the confirmation template with the booking code and hold deadline.

### OTP delivery

- Worker loads the challenge.
- Skip if `replaced_at IS NOT NULL`, `consumed_at IS NOT NULL`, or `expires_at <= now()` or `attempts_used >= 5`.
- The template renders only the derived OTP and the booking code; no PII other than the booking code.

### Outbox payload rule

- `outbox_events.payload` is JSONB with keys: `eventVersion`, `aggregate_id`, `expires_at` if needed.
- No `email`, no `phone`, no `fullName`, no `otp`.

### Message-ID

- Stable Message-ID derived from outbox event id.
- Mailpit accepts and displays it.

---

## P. SMTP dependency decision

### Decision

Phase 5 introduces a narrow, stable SMTP client. No SMTP implementation is hand-written.

### Package

- **Package**: `nodemailer`.
- **Version range to pin at implementation time**: `^7.x` (compatible with Node.js 24 LTS).
- **Rationale**:
  - Stable, broadly audited.
  - Supports SMTP directly without bundling an HTTP layer.
  - Compatible with Mailpit's SMTP listener on `127.0.0.1:1025`.
  - Zero coupling to specific providers.
- **Dependencies to be installed**: the `nodemailer` package and its declared runtime dependencies only.

### Audit requirement

Before installing:

- `pnpm audit` (Task 9) to confirm no known advisories in the selected version range.
- Dependency review at implementation time.

### Installation scope

The package install is **not** part of the documentation correction and will happen during Task 6 implementation.

---

## Q. HOLD success UI and status recheck

### Approved flow

1. The guest completes the contact form on `/quote/[id]` (Phase 4 quote page).
2. Submission calls `POST /api/v1/public/quotes/{quoteId}/bookings`.
3. On 200, the response renders inline on the same page as the HOLD success view.
4. The booking code is shown in the page body, plus the countdown and the management page entry.
5. A confirmation email is sent with the booking code.
6. After reload, recovery uses `/booking/manage` with booking code plus email and OTP verification.

### Storage rules

- `bookingCode`, `contact`, `challengeRef`, `token` are not stored in:
  - URL paths
  - query strings
  - `localStorage`
  - `sessionStorage`
- They live only in component state and in HttpOnly cookies (session token).

### Countdown and status recheck

- Server-time offset is computed once when the HOLD succeeds.
- A countdown UI ticks every second based on `serverNow + offset`.
- At countdown zero, the UI issues a secure server recheck and updates state.

### Status recheck endpoint

`POST /api/v1/public/booking-holds/status`

Request body (held only in component state):

```json
{
  "bookingCode": "RM-XXXX-XXXX-XXXX",
  "email": "guest@example.com"
}
```

Response (only status information, no booking details before OTP verification):

```json
{
  "status": "HOLD",
  "holdExpiresAt": "iso8601",
  "serverTime": "iso8601"
}
```

For a mismatched booking code + email pair, return a generic unavailable response. Do not return booking details before OTP verification.

### Accessibility/Storybook

- Phase 5 requires Storybook stories for HOLD success, contact form, OTP request, OTP verification, management page, countdown zero state.
- Playwright scenarios cover keyboard navigation, focus order, aria-live region for countdown expiry.

---

## R. Money serialization

### Phase 4 contract (verified at `packages/contracts/src/pricing.ts:20`)

- `amountVndSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)`.
- `currency: z.literal('VND')`.
- Fields: `baseAmountVnd`, `extraAmountVnd`, `totalAmountVnd`.

### Phase 5 rule

- Booking responses **must** reuse the exact Phase 4 schema structure.
- Public booking response includes a `pricing` object with the full Phase 4 breakdown:

  ```json
  {
    "pricing": {
      "baseAmountVnd": 359000,
      "extraAmountVnd": 60000,
      "totalAmountVnd": 419000,
      "currency": "VND"
    }
  }
  ```

- Database mapping:
  - `quotes.total_amount_vnd` → `bookings.gross_amount_vnd`
  - `0` → `bookings.discount_amount_vnd`
  - `quotes.total_amount_vnd` → `bookings.final_amount_vnd`
- The full Phase 4 breakdown is preserved in immutable `bookings.price_snapshot` (JSONB).
- No `BigInt` is serialized into JSON directly.
- No independent pricing formula runs in Phase 5. The booking snapshot is a verbatim copy of the quote snapshot.

### Contract test

- Task 9 includes a test that compares a Phase 4 quote response and the corresponding Phase 5 booking response and asserts:
  - same field names
  - same currency literal
  - same numeric representation
  - identical numeric values

---

## S. Migration design

### Harness

- Tests use the **guarded disposable database** harness from Phase 0. Concrete options:
  - `databaseTestHarness.createIsolated()` — creates a `room_management_test_<uuid>` database, runs `migrate`, then drops on teardown.
- Production schema migrations are **not** run as RED tests.

### Required tests

- Migrate from empty database.
- Migrate from Phase 4 schema (`phase-4-pricing-availability-v1`).
- Run migration a second time to confirm idempotency at the journal layer.
- Readiness version assertion: `schema_metadata.schema_version = 'phase-5-booking-hold-guest-access-v1'`.

### Migration files

- File name is produced by the repository's migration generator (Drizzle journal). The Phase 5 plan does not assume a specific filename; it queries `pnpm drizzle-kit generate` and uses its output.
- The plan uses the journal/snapshot workflow rather than raw SQL edits.

### Migration contents (generated)

- ALTER `bookings`:
  - ADD `quote_id uuid NULL`.
  - CREATE global partial unique index: `CREATE UNIQUE INDEX bookings_quote_id_uq ON bookings (quote_id) WHERE quote_id IS NOT NULL;`
  - Widen immutability trigger for new immutable fields.
- CREATE `booking_contacts` with email/phone normalized columns and `email_digest BYTEA CHECK (octet_length(email_digest)=32)`.
- No `contact_hash` column is added to `bookings` or `booking_contacts`.
- CREATE `guest_otp_challenges` with:
  - `nonce BYTEA CHECK (octet_length(nonce)=32)`
  - `email_digest BYTEA CHECK (octet_length(email_digest)=32)`
  - `request_ip_digest BYTEA CHECK (octet_length(request_ip_digest)=32)`
  - `challenge_ref_digest BYTEA CHECK (octet_length(challenge_ref_digest)=32)`
  - Partial unique index: `CREATE UNIQUE INDEX guest_otp_challenges_one_active_booking_uq ON guest_otp_challenges (booking_id) WHERE consumed_at IS NULL AND replaced_at IS NULL;`
- No separate `guest_otp_challenge_refs` table is created.
- CREATE `guest_sessions` with `token_digest BYTEA CHECK (octet_length(token_digest)=32)`.
- ALTER `outbox_events`:
  - ADD `lease_id uuid NULL`, `claimed_at timestamptz NULL`, `lease_expires_at timestamptz NULL`, `last_error_category text NULL`.
- Insert `schema_metadata` row update `'phase-5-booking-hold-guest-access-v1'`.
- No `original_hold_expires_at` column is added.

### What Phase 5 does **not** modify

- No edits to Phase 0–4 migration files.
- No edits to the GiST exclusion constraint.
- No edits to the audit append-only trigger.
- No edits to the booking immutability trigger logic except documented widening.

---

## T. Immutability

### Existing protections (preserved)

- Audit events append-only.
- Quotes reject every UPDATE/DELETE.
- Booking immutability of `hold_expires_at` and `price_snapshot`.

### Phase 5 widened immutability

Trigger `bookings_reject_immutable_fact_mutation` is extended to reject changes to:

- `quote_id`
- `booking_code`
- `property_id`
- `room_type_id`
- `room_id`
- `check_in`
- `check_out`
- `adults`, `children`
- `currency`
- `gross_amount_vnd`, `discount_amount_vnd`, `final_amount_vnd`
- `pricing_rule_version`
- `hold_expires_at` (already immutable in Phase 2)

Editable after creation:

- `status` (with explicit transition list)
- `expired_at` (set iff `status = 'EXPIRED'`)
- `updated_at` (always)

There is no `original_hold_expires_at` column. The single `hold_expires_at` is the immutable original deadline.

### Phase 5 contact immutability

`booking_contacts` rows are immutable: every UPDATE/DELETE is rejected at the database level. A row is created exactly once per booking. This is enforced via a separate trigger added in Phase 5.

---

## End of design

Status header: Approved for implementation.

Correctness hinges on:

- Bounded batch stale-HOLD cleanup (§E)
- Whole-transaction booking-code retry (§G)
- Outbox lease protocol (§N)
- One-active-challenge partial unique index (§J)
- Booking immutability widening (§T)

Continue to the implementation plan: [2026-07-22-phase-5-booking-hold-guest-access.md](../plans/2026-07-22-phase-5-booking-hold-guest-access.md)
