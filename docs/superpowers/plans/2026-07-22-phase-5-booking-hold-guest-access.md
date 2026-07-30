# Phase 5: Booking HOLD and secure guest access — Implementation plan

**Date**: 2026-07-22
**Based on**: [Phase 5 Design](../specs/2026-07-22-phase-5-booking-hold-guest-access-design.md)
**Execution model**: Test-Driven Development with focused commits

---

## Prerequisites verified

- Phase 4 baseline: commit `54b5132`, tag `phase-4-pricing-availability`.
- Branch: `phase5-booking-hold-guest-access`.
- Schema version: `phase-4-pricing-availability-v1`.
- No existing booking rows with data (seed creates catalog only).
- Booking table has `booking_code` column.
- Existing immutability trigger protects `hold_expires_at` and `price_snapshot`.
- Worker package exists; it owns Redis but no PostgreSQL yet. Phase 5 adds PostgreSQL ownership and removes required Redis unless explicitly enabled.

## Implementation status

- Task 1 (security primitives) closed at commit `c7d207f`. `109c317` was a defective original attempt superseded by this closure; it is not the authoritative Task 1 state.
- Task 2 (database migration) accepted at commit `7698353` with documented baseline debt (see `docs/superpowers/specs/PHASE5-DESIGN-CORRECTIONS.md` for the historical review record and the Known debt note in this plan's Task 2 section).
- Task 3 (booking HOLD transaction, below) started at commit `e9f5cc1`, which was committed in an incomplete RED state. Commit `2343253` was a rejected independent-audit closure attempt and is superseded only by the new closure commit from the current execution.
- Execution stops before Task 4; Task 4 concurrency stress work, Task 5 expiration worker, Task 6 SMTP/outbox delivery, Task 7 OTP/session API, Task 8 public UI, and all later phases remain unstarted.

---

## Task 0: Plan-only commit

### Objective

Establish authoritative plan in git history with no behavior change.

### Files to modify

- `docs/superpowers/specs/2026-07-22-phase-5-booking-hold-guest-access-design.md` (rewritten)
- `docs/superpowers/plans/2026-07-22-phase-5-booking-hold-guest-access.md` (this document, freshly committed)

### RED/GREEN/regression/review/commands

This task intentionally has no RED or GREEN because it is documentation only. Review checkpoint: confirm both files render as Markdown cleanly, contain no `TODO`, `TBD`, `FIXME`, or unguarded ellipses.

### Focused commit

```text
docs: finalize phase 5 architecture and execution plan
```

---

## Task 1: Security and domain primitives (pure)

### Objective

Provide pure, deterministic, dependency-free primitives for booking code, challenge reference, OTP derivation, digest computation, contact normalization and masking.

### Exact files to create

```text
packages/booking/package.json
packages/booking/tsconfig.json
packages/booking/src/booking-code.ts
packages/booking/src/booking-code.test.ts
packages/booking/src/challenge-ref.ts
packages/booking/src/challenge-ref.test.ts
packages/booking/src/otp.ts
packages/booking/src/otp.test.ts
packages/booking/src/digest.ts
packages/booking/src/digest.test.ts
packages/booking/src/contact.ts
packages/booking/src/contact.test.ts
packages/booking/src/strings.ts
packages/booking/src/strings.test.ts
```

### Exported interfaces

```ts
export type RandomIndexSource = (upperExclusive: number) => number;
export function generateBookingCode(randomIndexSource?: RandomIndexSource): string;
export function normalizeBookingCode(raw: string): string;

export interface DeriveChallengeRefInput {
  readonly secretKey: Buffer;
  readonly challengeId: string;
}
export function deriveChallengeRef(input: DeriveChallengeRefInput): string;
export function digestChallengeRef(secretKey: Buffer, challengeRef: string): Buffer;

export type RandomBytesSource = (length: number) => Buffer;
export function generateDecoyChallengeRef(randomBytesSource?: RandomBytesSource): string;
export function normalizeChallengeRef(raw: string): string;

export interface OtpInput {
  readonly secretKey: Buffer;
  readonly labelByteSequence: Buffer;
}
export function deriveOtp(input: OtpInput): string;
export function verifyOtp(provided: string, expected: string): boolean;

export interface DigestInput {
  readonly secretKey: Buffer;
  readonly domainLabel: string;
  readonly parts: ReadonlyArray<Buffer>;
}
export function computeDigest(input: DigestInput): Buffer;

export interface ContactInput {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
}
export interface NormalizedContact {
  readonly fullName: string;
  readonly email: string;
  readonly phoneE164: string;
  readonly emailDigest: Buffer;
}
export function normalizeContact(contact: ContactInput, digestSecret: Buffer): NormalizedContact;
export function contactsAreEquivalent(a: NormalizedContact, b: NormalizedContact): boolean;
export function maskEmailForDisplay(email: string): string;
```

### Fixtures / fixture-factory interface

Test factory:

```ts
export interface RngSeq {
  readonly values: ReadonlyArray<number>;
  readonly cursor: { readonly i: number };
}
export function makeSequenceRandomIndexSource(seq: number[]): RandomIndexSource;

export function deterministicDigestSecret(): Buffer;
```

### RED test (RED file: `booking-code.test.ts`)

Cases:

1. `generateBookingCode` returns a string matching `^RM-[1-9A-HJKMNP-Z]{4}-[1-9A-HJKMNP-Z]{4}-[1-9A-HJKMNP-Z]{4}$`.
2. Two calls with the same injected `RandomIndexSource` produce identical strings.
3. `generateBookingCode` excludes `0`, `O`, `I`, `L` over 100 generations with a fixed seed.
4. `normalizeBookingCode('  rm-abcd-ef23-jkmn ')` returns `RM-ABCD-EF23-JKMN`.
5. `normalizeBookingCode('RM-ABCL-EFGH-JKMN')` throws (contains `L`).
6. `normalizeBookingCode('RM-ABC0-EFGH-JKMN')` throws (contains `0`).
7. `normalizeBookingCode('RM-ABCO-EFGH-JKMN')` throws (contains `O`).
8. `normalizeBookingCode('RM-ABCI-EFGH-JKMN')` throws (contains `I`).
9. Random-source injection test verifies deterministic collision-injection behavior (returns the same value with the same seed).
10. No probabilistic "1000 unique generations" is used as primary proof; uniqueness is enforced by the database partial unique index in Task 2.

### RED test (`otp.test.ts`)

1. `deriveOtp` returns a 6-digit zero-padded string.
2. Identical `OtpInput` yields identical OTPs.
3. Different `labelByteSequence` (different nonce) yields different OTPs.
4. Rejection sampling: test that values >= limit are rejected and the counter increments. Verify the limit is computed as `Math.floor((2 ** 32) / 1_000_000) * 1_000_000` and the candidate uses full 32-bit unsigned range (first byte `& 0xff`, not `& 0x7f`).
5. `verifyOtp` returns `true` for matching strings, `false` for non-matching strings.
6. `verifyOtp` uses `timingSafeEqual` (verified by code review; functional tests confirm behavior).
7. No wall-clock timing benchmark tests are included (constant-time property is verified by code review of `timingSafeEqual` usage).

### RED test (`challenge-ref.test.ts`)

1. `deriveChallengeRef` is deterministic for the same `secretKey`/`challengeId` and returns a 32-character string using the booking-code alphabet.
2. `deriveChallengeRef` produces different output for a different `challengeId` or a different `secretKey`, and rejects a malformed `challengeId`.
3. `digestChallengeRef` returns a 32-byte deterministic keyed digest of a derived reference, for use as the stored lookup value.
4. `generateDecoyChallengeRef` returns a value in the same 32-character format, is not derived from any `challengeId`, and never equals a real `deriveChallengeRef` output for the same secret.
5. `normalizeChallengeRef` rejects inputs of length < 32 or with excluded alphabet.

### RED test (`digest.test.ts`)

1. Same `DigestInput` produces identical 32-byte output.
2. Different `domainLabel` with identical `parts` produces different output.
3. UUID serialization in canonical input yields the same digest as a hand-rolled byte sequence (regression against accidental concatenation bugs).

### RED test (`contact.test.ts`)

1. `normalizeContact` lowercases email, trims whitespace, validates phone.
2. Different case email produces the same `emailDigest`.
3. `contactsAreEquivalent` returns `true` for two normalized contacts whose normalized fields all match.
4. `maskEmailForDisplay('nguyenvana@example.com')` returns `n******a@example.com`.

### Exact RED command

```bash
pnpm --filter @room/booking test:unit -- --reporter spec
```

### Expected RED failure

The new package has no compiled `src/` files; tests fail to import, e.g. `Cannot find module '../src/booking-code.js'`.

### Minimum GREEN implementation

Implement each module with:

- Pure functions only.
- Inputs validated with explicit error types.
- No `console` writes.
- No `Date.now()` or `Math.random()` calls; both are injected.
- Use `node:crypto.randomInt` only via `defaultRandomIndexSource` re-export.

### Exact GREEN command

```bash
pnpm --filter @room/booking test:unit -- --reporter spec
```

Expected: all listed tests pass.

### Regression command

```bash
pnpm --filter @room/booking lint && pnpm --filter @room/booking typecheck
```

### Security/concurrency review checkpoint

- Are all random sources injectable? Confirmed by signature check.
- Are OTP and challenge-ref labels domain-separated (different HMAC domain labels)? Yes.
- Does any module emit PII via `console`? No (lint disallows).
- Is there any claim about JavaScript immutable-string zeroization? No (removed by design).

### Focused commit

```text
feat(booking): pure security primitives for code, challenge ref, otp, digest, contact
```

---

## Task 2: Phase 5 database migration

### Objective

Add Phase 5 tables, columns, partial unique indices, digest size checks and trigger widening, all behind the guarded disposable database harness.

### Exact files to create / modify

```text
packages/database/drizzle/0005_ambiguous_blazing_skull.sql
packages/database/drizzle/0006_phase5_custom_invariants.sql
packages/database/drizzle/meta/0005_snapshot.json
packages/database/drizzle/meta/0006_snapshot.json
packages/database/drizzle/meta/_journal.json
packages/database/src/schema.ts (add new exports)
packages/database/src/schema-status.ts (bump schema version)
packages/database/test/integration/phase5-migration.test.ts
packages/database/test/integration/phase5-schema-integrity.test.ts
```

**As implemented (commit `7698353`):** the generator produced `packages/database/drizzle/0005_ambiguous_blazing_skull.sql` (new tables `booking_contacts`, `guest_otp_challenges`, `guest_sessions`; new columns `bookings.quote_id`, `bookings.pricing_rule_version`; new outbox lease fields `outbox_events.lease_id`/`claimed_at`/`lease_expires_at`/`last_error_category`, while preserving the existing `attempt_count`/`available_at`/`published_at`/`status` fields; partial unique indices `bookings_quote_id_uq` and `guest_otp_challenges_one_active_booking_uq`). The hand-written custom-invariant migration is `packages/database/drizzle/0006_phase5_custom_invariants.sql` (widens `reject_booking_immutable_fact_mutation()` to cover every HOLD-creation fact, adds the `booking_contacts` immutability trigger, and advances `schema_metadata.schema_version` to `phase-5-booking-hold-guest-access-v1`). No Phase 0–4 migration (`0000`–`0004`) was edited, reordered, or regenerated.

### Exported interfaces

```ts
export const bookingContacts = pgTable('booking_contacts' /* ... */);
export const guestOtpChallenges = pgTable('guest_otp_challenges' /* ... */);
export const guestSessions = pgTable('guest_sessions' /* ... */);
```

### Fixtures / fixture-factory interface

```ts
export interface IsolatedDatabase {
  readonly url: string;
  readonly schemaVersion: string;
  destroy(): Promise<void>;
}
export async function createIsolatedDatabase(): Promise<IsolatedDatabase>;
```

### RED test (`phase5-migration.test.ts`)

Cases:

1. Apply migration to an empty database and assert that the post-migration schema has all required tables and indices.
2. Apply migration over the Phase 4 schema (`phase-4-pricing-availability-v1`) and assert migration succeeds.
3. Run the migration twice and assert no-op on the second pass.
4. Assert `schema_metadata.schema_version = 'phase-5-booking-hold-guest-access-v1'`.
5. Cleanup only `room_management_test_<uuid>` databases (verified by isolation harness).

### RED test (`phase5-schema-integrity.test.ts`)

Cases:

1. `guest_otp_challenges_one_active_booking_uq` partial unique index rejects insertion of a second active challenge for the same booking.
2. `octet_length(guest_otp_challenges.nonce) = 32` rejects a 31-byte value.
3. `octet_length(guest_otp_challenges.challenge_ref_digest) = 32` rejects a 33-byte value.
4. `bookings_quote_id_uq` global unique index rejects a second booking for the same quote, regardless of the first booking's status.
5. Attempt to insert a booking with `status = 'EXPIRED'` after the same quote already created a booking with `status = 'HOLD'` fails with unique constraint violation.
6. `booking_contacts` immutability trigger rejects UPDATE.

### Exact RED command

```bash
pnpm --filter @room/database test:unit -- --reporter spec phase5-migration
```

### Expected RED failure

Tests fail because the migration has not been generated. `createIsolatedDatabase` will return a database with the Phase 4 schema and no Phase 5 tables/indices; assertions about new indices will fail.

### Minimum GREEN implementation

- Generate migration via `pnpm drizzle-kit generate`.
- Verify generated SQL contains the named indices and CHECKs.
- Run migration on the isolated database via the harness.
- Add the new schema exports to `packages/database/src/schema.ts`.

### Exact GREEN command

```bash
pnpm --filter @room/database test:unit -- --reporter spec phase5-migration phase5-schema-integrity
```

### Regression command

```bash
pnpm --filter @room/database test:unit -- --reporter spec
```

### Security/concurrency review checkpoint

- Are digest columns exactly 32 bytes? CHECKs enforce this; test verifies by attempted insert.
- Does the partial unique index cover only active challenges? Test asserts that a consumed challenge allows a new active one.
- Does the global quote unique index prevent any quote reuse? Test confirms second booking attempt (even with different status) fails.
- Does the migration drop or modify any Phase 0–4 migration? No, by repository convention.
- Is the schema version updated? Yes, `phase-5-booking-hold-guest-access-v1`.

### Known debt (accepted baseline)

- `phase5-schema-integrity.test.ts` and `booking-constraints.test.ts` assert the PostgreSQL SQLSTATE (`23514`, `P0001`) raised by each CHECK/trigger, but do not assert the exact exception message text for every case. This is accepted debt, not a correctness gap: the SQLSTATE identifies the constraint class precisely.
- `migration-readiness.test.ts` verifies forward migration application and `schema_metadata` transition, but there is no explicit test that a failed migration rolls back cleanly. No failure-injection test exists for the Phase 5 migration pair.
- Root `pnpm format:check` fails on files unrelated to Phase 5 Task 1/Task 2 production code (see Stage A validation evidence); this is pre-existing and not introduced by either task.

### Focused commit

```text
feat(database): phase 5 booking contacts, otp challenges, sessions, outbox leases
```

---

## Task 3: Booking HOLD transaction

### Objective

Implement the `createBookingHoldWithRetry` service and its repositories with full-transaction retry on booking-code collision only.

### Exact files to create

```text
packages/booking/src/repository/booking-repository.ts
packages/booking/src/repository/contact-repository.ts
packages/booking/src/repository/availability.ts
packages/booking/src/services/create-booking-hold.ts
packages/booking/src/services/create-booking-hold.test.ts
packages/booking/src/services/create-booking-hold.retry.test.ts
packages/booking/test/fixtures/booking-hold-fixtures.ts
```

### Exported interfaces

```ts
export interface CreateBookingHoldInput {
  readonly quoteId: string;
  readonly contact: NormalizedContact;
  readonly holdDurationMs: number;
  readonly correlationId: string;
}

export interface BookingHoldResult {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly status: 'HOLD';
  readonly checkIn: Date;
  readonly checkOut: Date;
  readonly holdExpiresAt: Date;
  readonly amountVnd: number;
  readonly currency: 'VND';
  readonly idempotent: boolean;
}

export async function createBookingHoldWithRetry(
  pool: Pool,
  input: CreateBookingHoldInput,
  options?: { readonly maxAttempts?: number; readonly randomIndexSource?: RandomIndexSource },
): Promise<BookingHoldResult>;

export interface AvailabilityProbe {
  readonly roomTypeId: string;
  readonly checkIn: Date;
  readonly checkOut: Date;
  readonly propertyId: string;
}
export async function findAllocatableRooms(
  pool: Pool,
  probe: AvailabilityProbe,
  limit: number,
  tx?: DbTransaction,
): Promise<readonly RoomCandidate[]>;
```

### Test-only fixture helpers

`seedBookingHoldFixture` and `lcgRandomIndexSource` are test-only helpers located under `packages/booking/test/fixtures/booking-hold-fixtures.ts`. They are not exported from `@room/booking`, are not part of the production package API, and are not imported by production source. Synthetic prices, identities, contacts, and catalog data exist only inside test scope. Fixture timestamps are explicit or derived by PostgreSQL `CURRENT_TIMESTAMP`, never by client wall-clock correctness logic.

### RED test (`create-booking-hold.test.ts`) cases

1. Happy path: single available room → booking created with deterministic snapshot match (verify `gross_amount_vnd = quote.total_amount_vnd`, `discount_amount_vnd = 0`, `final_amount_vnd = quote.total_amount_vnd`).
2. Quote expired → `QUOTE_EXPIRED`.
3. Quote missing → `QUOTE_NOT_FOUND`.
4. All structurally eligible rooms locked by concurrent transaction (FOR UPDATE SKIP LOCKED returns empty, existence probe shows positive count) → `ALLOCATION_BUSY`.
5. No structurally allocatable rooms exist (existence probe returns zero after targeted stale cleanup) → `ROOM_TYPE_UNAVAILABLE`.
6. Targeted cleanup hits bound with remaining stale rows → `STALE_HOLD_CLEANUP_RETRY`.
7. Idempotent equivalent retry with same normalized contact returns the existing booking with `idempotent = true`, including against an already-expired quote, before expiry, cleanup, allocation, or code generation.
8. Different contact on a quote-bound booking returns `QUOTE_ALREADY_USED`.
9. GiST exclusion during allocation attempt with no stale rows remaining → `ALLOCATION_BUSY` (retryable, transaction fully rolled back).
10. A locked targeted stale HOLD skipped by cleanup still returns `STALE_HOLD_CLEANUP_RETRY`; zero affected rows with zero remaining targeted rows returns `exhaustedSafetyBound = false`.
11. Expiry tests seed PostgreSQL-time-relative expired state and use no wall-clock sleep.

### RED test (`create-booking-hold.retry.test.ts`) cases

1. A contrived collision-injecting `RandomIndexSource` causes the first two attempts to collide; third attempt succeeds. Asserts exactly 3 attempts.
2. Any non-`23505-on-booking-code` failure (contact mismatch, validation, `23P01` exclusion) is **not** retried.
3. After a failed attempt (including `23P01` exclusion), the transaction is rolled back; no orphan booking, contact, audit, or outbox rows remain.
4. Each retry attempt opens a fresh transaction; no attempt resumes inside an aborted transaction. Fresh transaction identity evidence is gathered by test-owned pool/client instrumentation or PostgreSQL test instrumentation, never by a production callback or `txid_current()` query.

### Exact RED command

```bash
pnpm --filter @room/booking test:unit -- --reporter spec create-booking-hold
```

### Expected RED failure

`createBookingHoldWithRetry` does not exist; tests fail at import.

### Minimum GREEN implementation

- Repository functions only use parameterized SQL with explicit transaction boundaries.
- Production transaction services expose no arbitrary test callback. The first meaningful SQL after `BEGIN` is `SELECT CURRENT_TIMESTAMP`, followed by quote locking and the existing-booking idempotency check.
- Snapshot fields are copied with no discount: `gross_amount_vnd = quote.total_amount_vnd`, `discount_amount_vnd = 0`, `final_amount_vnd = quote.total_amount_vnd`.
- The immutable `price_snapshot` JSONB preserves the full Phase 4 breakdown.
- Idempotency is enforced by the global quote unique index plus contact equivalence comparison (no `contact_hash` column required).
- Audit and outbox rows are inserted with payloads containing only IDs and timestamps.
- Candidate room selection uses `LIMIT 1` with `FOR UPDATE SKIP LOCKED`. If no row is returned, an existence probe runs to classify the error (`ALLOCATION_BUSY` if rooms exist but are locked; `ROOM_TYPE_UNAVAILABLE` if no structurally eligible rooms exist).
- After every stale-cleanup batch shorter than `batchSize`, including zero, and after `maxBatches`, a non-locking targeted remaining-row probe distinguishes complete cleanup from skipped locked stale work. Remaining targeted work maps to `STALE_HOLD_CLEANUP_RETRY`.
- GiST exclusion (`23P01`) aborts the transaction; no continuation inside the aborted transaction occurs. The entire allocation returns `ALLOCATION_BUSY` (retryable).

### Exact GREEN command

```bash
pnpm --filter @room/booking test:unit -- --reporter spec create-booking-hold
```

### Regression command

```bash
pnpm --filter @room/booking lint && pnpm --filter @room/booking typecheck
```

### Security/concurrency review checkpoint

- Is idempotency enforced by global quote unique index? Yes.
- Does the implementation retry inside an aborted transaction? No — every attempt opens a new transaction.
- Is `expires_at > now()` enforced in SQL? Yes.
- Are money fields mapped correctly (no discount)? Yes (verified by test assertion).
- Is `bookings.pricing_rule_version` derived from `quotes.pricing_snapshot`? Yes (extracted at insertion).
- Does a GiST exclusion (`23P01`) abort the transaction completely? Yes. No orphan rows remain.
- Does the allocation logic correctly classify empty FOR UPDATE SKIP LOCKED results via existence probe? Yes.

### Focused commit

```text
feat(booking): transactional hold creation with bounded retry on code collision
```

### Final audit correction requirements

Task 3 closure must preserve the rejected commit `2343253` as evidence and supersede it only with a new closure commit. The closure must remove production transaction instrumentation and fixture exports, relocate fixture code to test scope, distinguish locked stale HOLDs from fully cleaned targets, and replace expiry sleeps with PostgreSQL-time-relative fixtures. No Task 4 implementation begins until this closure is independently accepted.

---

## Task 4: PostgreSQL concurrency invariants

### Objective

Prove the allocation transaction's concurrency properties against real PostgreSQL.

### Exact files to create

```text
packages/booking/test/concurrency/last-room-race.test.ts
packages/booking/test/concurrency/two-room-race.test.ts
packages/booking/test/concurrency/same-quote-equivalent-contact.test.ts
packages/booking/test/concurrency/same-quote-different-contact.test.ts
packages/booking/test/concurrency/touching-interval.test.ts
packages/booking/test/concurrency/maintenance-block.test.ts
packages/booking/test/concurrency/exclusion-rollback.test.ts
packages/booking/test/concurrency/stale-cleanup-batches.test.ts
packages/booking/test/concurrency/expiration-vs-allocation.test.ts
packages/booking/test/concurrency/concurrency-fixtures.ts
```

### Exported interfaces used

The implementations consume `createBookingHoldWithRetry`, `markRoomMaintenance`, `cleanupStaleHolds` and `findAllocatableRooms`.

### Fixture-factory interface

```ts
export interface MultiRoomFixture {
  readonly propertyId: string;
  readonly roomTypeId: string;
  readonly quoteIds: string[];
  readonly roomIds: string[];
}
export async function seedMultiRoomFixture(
  pool: Pool,
  layout: 'oneRoom' | 'twoRooms',
): Promise<MultiRoomFixture>;
```

### RED test cases (per file)

- `last-room-race.test.ts`: two concurrent quotes, one room, no stale rows → exactly one booking succeeds. Loser receives `ALLOCATION_BUSY` during winner's transaction (existence probe shows room exists but is locked). After winner commits and loser retries, loser receives `ROOM_TYPE_UNAVAILABLE` (no free room remains). Test has two phases: immediate concurrent attempt, then retry after winner commits.
- `two-room-race.test.ts`: two concurrent quotes, two rooms → both bookings succeed with distinct rooms (assert via separate connections).
- `same-quote-equivalent-contact.test.ts`: same normalized contact concurrently → exactly one booking row created, both callers may return it, no `QUOTE_ALREADY_USED`.
- `same-quote-different-contact.test.ts`: different normalized contacts → one booking created, loser sees `QUOTE_ALREADY_USED`.
- `touching-interval.test.ts`: back-to-back intervals (end of A == start of B) → both succeed (GiST EXCLUDE uses `[)`).
- `maintenance-block.test.ts`: room with overlapping maintenance block → allocation returns `ROOM_TYPE_UNAVAILABLE` after targeted stale cleanup completes.
- `exclusion-rollback.test.ts`: when GiST exclusion fires after INSERT into `room_inventory_blocks`, the entire transaction is aborted; booking, contact, audit, and outbox inserts all roll back; verified via `SELECT COUNT(*) FROM bookings`, `SELECT COUNT(*) FROM booking_contacts`, `SELECT COUNT(*) FROM audit_events`, `SELECT COUNT(*) FROM outbox_events`.
- `stale-cleanup-batches.test.ts`: 250 targeted stale HOLDs → first allocation cleans up 4 batches of 50 then returns `STALE_HOLD_CLEANUP_RETRY`; a second allocation completes the remaining 50 and succeeds or fails based on actual room availability.
- `expiration-vs-allocation.test.ts`: scheduled expiration sweep on one connection races allocation on another; SKIP LOCKED ensures no double-update.
- `allocation-busy.test.ts`: all candidate rooms locked by FOR UPDATE SKIP LOCKED → existence probe shows positive count → return `ALLOCATION_BUSY` (retryable, not structural unavailability).

### Exact RED command

```bash
pnpm --filter @room/booking test:unit -- --reporter spec concurrency
```

### Expected RED failure

Concurrency behaviors are not yet implemented; tests cannot even seed the multi-room fixture reliably until `createBookingHoldWithRetry` and the cleanup function exist.

### Minimum GREEN implementation

- Targeted `cleanupStaleHolds(pool, options: { propertyId, roomTypeId, candidateRoomIds, checkIn, checkOut, batchSize: 50, maxBatches: 4 }): Promise<StaleCleanupResult>` returns `{ removedBookings, exhaustedSafetyBound: boolean }`.
- `findAllocatableRooms` orders by `r.code ASC` and uses `FOR UPDATE SKIP LOCKED LIMIT 1`.
- Existence probe is a separate query: `SELECT COUNT(*) FROM rooms WHERE room_type_id = $1 AND property_id = $2 AND status = 'ACTIVE'`.
- Two `Pool` instances used per test (`poolA`, `poolB`) created via `createDatabasePool(env.DATABASE_URL!, { applicationName: 'concurrency-A', max: 1 })` and `concurrency-B`.
- GiST exclusion aborts the transaction; allocation logic returns `ALLOCATION_BUSY` without attempting a second candidate.

### Exact GREEN command

```bash
pnpm --filter @room/booking test:unit -- --reporter spec concurrency
```

### Regression command

```bash
pnpm --filter @room/booking test:unit -- --reporter spec
```

### Concurrency review checkpoint

- Every multi-connection test uses two `Pool` instances from the same `createIsolatedDatabase()` result, never the global test pool.
- Locks are acquired in the documented order (quote → existing booking check → candidate rooms → inserts).
- FOR UPDATE SKIP LOCKED is used in candidate room selection and cleanup sweep.

### Focused commit

```text
test(booking): prove allocation concurrency with two independent pools
```

---

## Task 5: HOLD expiration worker

### Objective

Run bounded-batch HOLD expiration from the worker process, cooperatively with allocation.

### Exact files to create

```text
apps/worker/src/jobs/expire-stale-holds.ts
apps/worker/src/jobs/expire-stale-holds.test.ts
apps/worker/src/jobs/expire-fixtures.ts
apps/worker/src/jobs/job-fixtures.ts
```

### Exported interfaces

```ts
export interface ExpireStaleHoldsOptions {
  readonly pool: Pool;
  readonly batchSize: number;
  readonly maxBatches: number;
}
export interface ExpireStaleHoldsResult {
  readonly processed: number;
  readonly exhaustedSafetyBound: boolean;
}
export async function expireStaleHolds(
  options: ExpireStaleHoldsOptions,
): Promise<ExpireStaleHoldsResult>;
```

### Fixture-factory interface

```ts
export interface HoldFixtureSeed {
  readonly roomTypeId: string;
  readonly roomId: string;
  readonly totalHolds: number;
  readonly expired: number;
  readonly deadlineOffsetMs: number;
}
export async function seedHoldFixture(
  pool: Pool,
  seed: HoldFixtureSeed,
): Promise<readonly string[]>;
```

### RED test cases (`expire-stale-holds.test.ts`)

1. Mixed ACTIVE and stale HOLDs → only stale rows transition, ACTIVE ones remain.
2. Two-worker concurrency test: 100 stale rows, two workers → all transitions recorded, no double-update (verified via audit row count).
3. Idempotency: running the job twice does not double-process.
4. `hold_expires_at` is immutable and preserved on transition (never modified).
5. `expired_at = statement_timestamp()` and `status = 'EXPIRED'` are set when transitioning.
6. Inventory block status set to `RELEASED` with `released_at`.
7. Audit event `HOLD_EXPIRED` and outbox event `booking.hold.expired` both emitted.
8. Active-iteration shutdown drain test: a long-running iteration receives a drain flag and finishes before returning.

### Exact RED command

```bash
pnpm --filter @room/worker test:unit -- --reporter spec expire-stale-holds
```

### Expected RED failure

`expireStaleHolds` does not exist; tests cannot import.

### Minimum GREEN implementation

- Reuses the SQL primitives from Task 4.
- Exposes a `runIteration()` method used by both production scheduler and tests.
- Holds the structured logger from `@room/observability` for lifecycle events.

### Exact GREEN command

```bash
pnpm --filter @room/worker test:unit -- --reporter spec expire-stale-holds
```

### Regression command

```bash
pnpm --filter @room/worker test:run -- --reporter spec
```

### Concurrency review checkpoint

- Is the iteration safe under SIGTERM during a batch? Yes: drain flag and single-batch `COMMIT`.
- Are inventory releases committed in the same transaction as the booking transition? Yes.
- Are audit/outbox inserts atomic with the transitions? Yes.

### Focused commit

```text
feat(worker): bounded-batch hold expiration with cooperative drain
```

---

## Task 6: Outbox and SMTP

### Objective

Implement the lease-protocol outbox claim and SMTP delivery, with Mailpit integration tests.

### Exact files to create

```text
apps/worker/src/outbox/claim-outbox-batch.ts
apps/worker/src/outbox/claim-outbox-batch.test.ts
apps/worker/src/outbox/finalize-outbox.ts
apps/worker/src/outbox/finalize-outbox.test.ts
apps/worker/src/outbox/reclaim-expired-leases.ts
apps/worker/src/outbox/reclaim-expired-leases.test.ts
apps/worker/src/email/smtp-transport.ts
apps/worker/src/email/templates/hold-confirmation.ts
apps/worker/src/email/templates/hold-confirmation.test.ts
apps/worker/src/email/templates/otp-delivery.ts
apps/worker/src/email/templates/otp-delivery.test.ts
apps/worker/src/email/skip-rules.ts
apps/worker/src/email/skip-rules.test.ts
apps/worker/src/email/message-id.ts
apps/worker/src/email/message-id.test.ts
apps/worker/src/jobs/process-outbox.ts
apps/worker/src/jobs/process-outbox.test.ts
apps/worker/src/jobs/outbox-fixtures.ts
```

### Exported interfaces

```ts
export interface ClaimOutboxBatchInput {
  readonly pool: Pool;
  readonly workerId: string;
  readonly leaseTtlMs: number;
  readonly batchSize: number;
}
export interface OutboxClaimRow {
  readonly id: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly attemptCount: number;
  readonly leaseId: string;
  readonly leaseExpiresAt: Date;
}
export async function claimOutboxBatch(
  input: ClaimOutboxBatchInput,
): Promise<readonly OutboxClaimRow[]>;

export async function reclaimExpiredOutboxLeases(input: ClaimOutboxBatchInput): Promise<number>;

export interface FinalizeSuccessInput {
  readonly pool: Pool;
  readonly claim: OutboxClaimRow;
}
export async function finalizeOutboxSuccess(input: FinalizeSuccessInput): Promise<void>;

export type OutboxErrorCategory =
  | 'SMTP_TIMEOUT'
  | 'SMTP_CONNECT'
  | 'TEMPLATE_RENDER'
  | 'BOOKING_GONE'
  | 'CHALLENGE_GONE'
  | 'LEASE_TIMEOUT';
export interface FinalizeFailureInput {
  readonly pool: Pool;
  readonly claim: OutboxClaimRow;
  readonly category: OutboxErrorCategory;
  readonly baseBackoffMs: number;
  readonly maxBackoffMs: number;
}
export async function finalizeOutboxFailure(input: FinalizeFailureInput): Promise<void>;

export interface OutboxProcessorOptions {
  readonly claimInput: ClaimOutboxBatchInput;
  readonly send: (msg: SMTPMessage) => Promise<void>;
  readonly loadContext: (
    row: OutboxClaimRow,
  ) => Promise<OutboxContext | { skip: true; reason: SkipReason }>;
  readonly intervals: ReadonlyArray<number>;
  readonly onResult?: (r: OutboxIterationSummary) => void;
}
export async function processOutbox(options: OutboxProcessorOptions): Promise<void>;
```

### RED test cases (`claim-outbox-batch.test.ts`)

1. Single-worker claim: SELECT returns expected rows with proper WHERE clause including `(lease_expires_at IS NULL OR lease_expires_at <= now())`, then UPDATE sets `lease_id`.
2. Two-worker race: each row goes to exactly one worker.
3. Reclaim: an expired lease can be reclaimed by another worker.
4. Out-of-order availability: `available_at > now()` rows are not claimed.
5. `attempt_count` increments per claim.
6. Rows with active leases (lease_expires_at > now()) are not claimed by a second worker.

### RED test cases (`finalize-outbox-success.test.ts`)

1. `status='PUBLISHED'`, `published_at` set, `lease_id` cleared.
2. Idempotent finalize: a second SUCCESS finalization does not flip timestamps.

### RED test cases (`finalize-outbox-failure.test.ts`)

1. `status='PENDING'`, `available_at` advanced with bounded exponential backoff, `attempt_count` incremented.
2. `last_error_category` is stored; no raw exception text.
3. Cap test: `available_at` does not exceed `now() + maxBackoffMs`.
4. Lost lease: finalize with wrong `lease_id` does not update the row (CAS failure).

### RED test cases (`process-outbox.test.ts`)

1. Happy path: status transitions to `PUBLISHED` for each row.
2. Stale booking skip: booking already `EXPIRED` → success row finalized but email skipped.
3. Replaced OTP challenge skip: email not sent when `replaced_at IS NOT NULL`.
4. Mailpit integration: emails actually appear in Mailpit inbox (verified via HTTP API to `127.0.0.1:8025`).
5. Stable `Message-ID`: format `<{outbox_event_id}@roommanagement.example.com>`.
6. Multi-worker test: two workers run concurrently, each claimed row has correct `lease_id`, no worker finalizes another's row (CAS enforcement).

### Exact RED command

```bash
pnpm --filter @room/worker test:unit -- --reporter spec outbox
```

### Expected RED failure

Outbox lease columns do not yet exist on the schema (added in Task 2); `claimOutboxBatch` is undefined.

### Minimum GREEN implementation

- Use `nodemailer` package (selection documented in §P).
- Use the `stream` transport for tests so emails are captured in-memory.
- Mailpit integration test uses the live SMTP listener at `127.0.0.1:1025`.
- Skip rules apply per §O.

### Exact GREEN command

```bash
pnpm --filter @room/worker test:unit -- --reporter spec outbox
```

### Regression command

```bash
pnpm --filter @room/worker test:run -- --reporter spec
```

### Concurrency/email review checkpoint

- Are email templates free of PII other than booking code? Yes (verified by inspect).
- Is Mailpit verified visible? Yes (via `GET /api/v1/messages`).
- Are duplicates possible and accepted? Yes; `Message-ID` is stable.

### Focused commit

```text
feat(worker): outbox lease claim, finalize, and mailpit-integrated smtp
```

---

## Task 7: Guest OTP and session API

### Objective

Implement the public endpoints and the server-time-correctness primitives.

### Exact files to create / modify

```text
apps/api/src/modules/booking/booking.routes.ts
apps/api/src/modules/booking/create-booking-hold.route.ts
apps/api/src/modules/booking/booking-status.route.ts
apps/api/src/modules/booking/otp-request.route.ts
apps/api/src/modules/booking/otp-verify.route.ts
apps/api/src/modules/booking/guest-session-store.ts
apps/api/src/modules/booking/email-lookup.ts
apps/api/src/modules/booking/cooldown.ts
apps/api/src/modules/booking/routes.test.ts
apps/api/src/modules/booking/email-lookup.test.ts
apps/api/src/modules/booking/cooldown.test.ts
packages/contracts/src/booking.ts
packages/contracts/src/booking.test.ts
```

### Exported interfaces

```ts
export interface CreateBookingHoldRequest {
  readonly contact: ContactInput;
}
export interface OtpRequestRequest {
  readonly email: string;
}
export interface OtpRequestResponse {
  readonly challengeRef: string;
  readonly message: string;
  readonly resendAvailableIn: number;
}
export interface OtpVerifyRequest {
  readonly challengeRef: string;
  readonly otp: string;
}
export interface OtpVerifyResponse {
  readonly authenticated: true;
  readonly bookingCode: string;
}
```

### RED test cases

- Create booking → returns inline HOLD result with full pricing breakdown matching Phase 4 contract; no PII echoed back beyond aggregate totals.
- Create booking with same quote + same normalized contact twice → idempotent (same booking returned).
- OTP request with valid `(bookingCode, email)` produces a resolvable challenge; with invalid input, identical shape and HTTP 202 with a non-resolving `challengeRef`.
- Concurrent OTP-request race on same booking → exactly one active challenge at conclusion (verified by re-reading `guest_otp_challenges`).
- Cooldown: a second OTP request within 60s for a valid pair returns the same deterministically re-derived `challengeRef` without inserting a new challenge or emitting a second email.
- IP rate limit: 21st request within an hour from the same IP returns `OTP_RATE_LIMITED`.
- Pair rate limit: 6th OTP request within 15 minutes for the same booking+email returns rate-limited response.
- 5 failed OTP verification attempts: the challenge remains active, 6th attempt (even with correct OTP) returns `OTP_INVALID_OR_EXPIRED`.
- Expired challenge verification → `OTP_INVALID_OR_EXPIRED`.
- Replaced challenge verification → `OTP_INVALID_OR_EXPIRED`.
- Successful OTP verification returns `authenticated: true` and `bookingCode` in JSON; session token delivered only via `Set-Cookie` header, never in JSON body.
- Booking-scoped session: a request for booking A's endpoint with a session cookie for booking B is rejected.
- Cookie attributes verified: HttpOnly, SameSite=Lax, Secure in production env, Path=/, Max-Age=1800.
- Logout: revocation succeeds, subsequent requests with the same cookie fail.

### Exact RED command

```bash
pnpm --filter @room/api test:unit -- --reporter spec booking
```

### Expected RED failure

`booking.routes.ts` does not exist; tests fail at route registration.

### Minimum GREEN implementation

- Routes use Fastify, validated by Zod schemas.
- Cookie set via `reply.setCookie(...)`.
- Guest session token generated by `generateGuestSessionToken()` from `@room/booking`.

### Exact GREEN command

```bash
pnpm --filter @room/api test:unit -- --reporter spec booking
```

### Regression command

```bash
pnpm --filter @room/api test:unit -- --reporter spec
```

### Security review checkpoint

- Do API responses ever echo raw OTP? No.
- Is logging free of OTPs? Yes (verified by a structured-log assertion).
- Is the session token only stored as a digest? Yes.
- Is the public API surface the only way to obtain a session? Yes.

### Focused commit

```text
feat(api): public booking hold, otp challenge, and guest session endpoints
```

---

## Task 8: Public UI

### Objective

Implement inline HOLD success, contact form, server-time countdown, OTP request and verify, and the management page.

### Exact files to create / modify

```text
apps/web/src/app/quote/[quoteId]/page.tsx (modify)
apps/web/src/app/quote/[quoteId]/quote-contact-form.tsx
apps/web/src/app/quote/[quoteId]/hold-success-panel.tsx
apps/web/src/app/quote/[quoteId]/server-time-offset.ts
apps/web/src/app/booking/manage/page.tsx
apps/web/src/app/booking/manage/otp-request-panel.tsx
apps/web/src/app/booking/manage/otp-verify-panel.tsx
apps/web/src/app/booking/manage/booking-detail-panel.tsx
apps/web/src/lib/booking/hold-success.story.tsx
apps/web/src/lib/booking/quote-contact-form.story.tsx
apps/web/src/lib/booking/otp-flow.story.tsx
tests/e2e/booking-hold-success.spec.ts
tests/e2e/booking-otp-flow.spec.ts
tests/e2e/booking-recovery.spec.ts
```

### Exported interfaces

- `<QuoteContactForm quoteId={...} onSuccess={...}/>`
- `<HoldSuccessPanel response={...} serverNow={...}/>`
- `<OtpRequestPanel bookingCode={...} onResolved={...}/>`
- `<OtpVerifyPanel onAuthenticated={...}/>`

### RED test cases (Vitest + Playwright)

Vitest:

1. The success panel renders only data the server returned (full pricing breakdown with Phase 4 contract).
2. Server-time offset is computed via a single `Date` header fetch; the countdown component renders `MM:SS` decreasing at the right cadence.
3. At countdown zero, the panel issues a secure recheck (`POST /api/v1/public/booking-holds/status` with body) and updates state.

Playwright:

4. End-to-end: full booking hold → email arrives in Mailpit → recovery via `/booking/manage` works.
5. Accessibility: keyboard-tab order covers only logical controls; aria-live region announces countdown expiry.
6. Disabled/sanitized tracing for the OTP flow (verified by checking that no `playwright.trace` HTTP request contains `otp=`).

### Exact RED command

```bash
pnpm --filter @room/web test:unit -- --reporter spec booking
pnpm exec playwright test tests/e2e/booking-hold-success.spec.ts --project=chromium
```

### Expected RED failure

New components do not exist; tests fail at import.

### Minimum GREEN implementation

- Use Next.js 16 app router conventions.
- Booking code and OTP input are held only in component state.
- No `localStorage`/`sessionStorage` writes for booking code, contact, challenge ref or token.
- Cookie is read via the existing auth helper.

### Exact GREEN command

```bash
pnpm --filter @room/web test:unit -- --reporter spec booking
pnpm exec playwright test tests/e2e/booking-hold-success.spec.ts --project=chromium
```

### Regression command

```bash
pnpm --filter @room/web test:unit -- --reporter spec
```

### UI review checkpoint

- Are booking code, contact, challengeRef or token ever written to URL/`localStorage`? No (verified by lint rule and Playwright assertion).
- Does the countdown recheck the server at zero? Yes.
- Is there a Storybook story for each state? Yes.

### Focused commit

```text
feat(web): inline hold success, otp flow, and recovery management page
```

---

## Task 9: Contracts, OpenAPI, CI commands and docs

### Objective

Publish Zod-derived OpenAPI, ensure CI commands match local commands, and document the public error catalog.

**Documented drift to correct here**: `docs/openapi/admin-v1.json` currently bundles public, unauthenticated routes (`/api/v1/availability/search`, `/api/v1/quotes`, `/api/v1/quotes/{id}`) into an artifact named `admin-v1`, even though those routes carry no admin authorization requirement. Task 9 must either split the public booking/availability/quote routes into a separate public OpenAPI artifact or rename `admin-v1` to reflect its mixed content. This is not corrected in Stage A or Task 3; it is out of scope until this task.

### Exact files to create / modify

```text
packages/contracts/src/booking.ts
packages/contracts/src/errors.ts
packages/contracts/src/booking.test.ts
docs/contracts/errors.md
docs/runbooks/phase-5.md
.github/workflows/quality.yml (add Phase 5 commands if missing)
```

### Exported interfaces

- Re-exports of booking request/response types.
- `errorCodes` constant listing `QUOTE_NOT_FOUND`, `QUOTE_EXPIRED`, `ROOM_TYPE_UNAVAILABLE`, `ALLOCATION_BUSY`, `STALE_HOLD_CLEANUP_RETRY`, `QUOTE_ALREADY_USED`, `CONTACT_VALIDATION_FAILED`, `OTP_INVALID_OR_EXPIRED`, `OTP_RATE_LIMITED`.

### RED test cases

1. OpenAPI generation from Zod schemas includes all booking endpoints and the public error codes.
2. The Phase 4→Phase 5 contract test: a quote response and its corresponding booking response have identical pricing breakdown structure (baseAmountVnd, extraAmountVnd, totalAmountVnd) and identical currency literal.

### Exact RED command

```bash
pnpm --filter @room/contracts test:unit
```

### Expected RED failure

`packages/contracts/src/booking.ts` does not exist; contract test fails because no Phase 5 booking schemas exist yet.

### Minimum GREEN implementation

- Hand-craft the Zod schemas parallel to the API surface.
- Compose OpenAPI generation in `packages/contracts/src/openapi.ts`.

### Exact GREEN command

```bash
pnpm --filter @room/contracts test:unit
```

### Regression command

```bash
pnpm --filter @room/contracts test:unit
```

### Documentation review checkpoint

- Does the contract test exist? Yes (in `packages/contracts/test/phase4-phase5-snapshot.test.ts`).
- Are error codes aligned with public API? Yes (generic external errors, detailed internal logs).

### Focused commit

```text
feat(contracts): phase 5 booking schemas and openapi fragments
```

---

## Task 10: Final audit and quality gates

### Objective

Run every validation, then produce the final audit report.

### Exact commands to run

```bash
# Local validation commands in their actual package paths
pnpm --filter @room/booking test:unit
pnpm --filter @room/booking lint
pnpm --filter @room/booking typecheck
pnpm --filter @room/database test:unit
pnpm --filter @room/database lint
pnpm --filter @room/database typecheck
pnpm --filter @room/worker test:unit
pnpm --filter @room/worker lint
pnpm --filter @room/worker typecheck
pnpm --filter @room/api test:unit
pnpm --filter @room/api lint
pnpm --filter @room/api typecheck
pnpm --filter @room/web test:unit
pnpm --filter @room/web lint
pnpm --filter @room/web typecheck
pnpm --filter @room/contracts test:unit
docker run --rm -v "$(pwd):/scan" zricethezav/gitleaks:latest detect --source /scan --no-banner
pnpm audit --prod
pnpm exec playwright test --project=chromium
```

### Acceptance criteria

- All Vitest test suites green.
- All `lint` and `typecheck` exit zero.
- `gitleaks` Docker scan reports zero findings.
- `pnpm audit --prod` reports no high or critical advisories.
- Playwright reports `failed=0` on `chromium` project.
- No production code outside the approved scope was modified.

### Final audit document

Write `docs/audit/phase-5-final-audit.md` with:

- Total test count per package (Vitest totals).
- Total Playwright scenario pass count.
- Gitleaks result (paste command exit code).
- Audit result (paste summary line).
- Schema version confirmation.
- Worker process exit confirmation.
- Mailpit summary (`GET /api/v1/messages`).
- Scope-review checklist (only the approved paths were modified).

### Focused commit

```text
docs: phase 5 final audit report
```

---

## End of plan

Each task ends with a review checkpoint and a focused commit. Pseudocode has been replaced by concrete exported interfaces, declared fixtures and named test cases. No `...`, `differentContact`, `targetRoomId` or `roomTypeId` placeholders remain in test descriptions. Implementation does not begin before this plan is reviewed.
