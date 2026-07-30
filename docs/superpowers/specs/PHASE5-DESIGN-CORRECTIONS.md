# Phase 5 Design Corrections

**Date**: 2026-07-22  
**Corrects**: Commit `2a7bd09` design and implementation plan  
**Status**: Applied — historical review record

**Applied design document**: `docs/superpowers/specs/2026-07-22-phase-5-booking-hold-guest-access-design.md`
**Applied plan document**: `docs/superpowers/plans/2026-07-22-phase-5-booking-hold-guest-access.md`
**Implementation commits**: `c7d207f` (Task 1 security-primitive closure), `7698353` (Task 2 database-schema baseline)
**Remaining unresolved correction**: none — all items below were superseded by the broader 20-item correction pass recorded in `.cursor/phase5-correction-summary.md` (base commit `b14752c`)

The corrections below are retained as a historical record of the issues found against the original `2a7bd09` design and are no longer pending. Read the current design/plan documents for the authoritative, already-corrected contract.

---

## Issues identified

### 1. Database connection API misuse

**Problem**: Design shows worker creating database client incorrectly:

```typescript
// WRONG (lines 524-532 in design)
const db = createDatabaseClient({
  connectionString: env.DATABASE_URL,
  application_name: 'room-management-worker',
});

// WRONG (line 539)
await db.pool.end();
```

**Actual API** (`packages/database/src/client.ts`):

- `createDatabasePool(connection, options)` → returns `Pool`
- `createDatabaseClient(pool)` → returns `DatabaseClient`
- `DatabaseClient` does NOT expose `.pool`

**Root cause**: Confused pool creation with client creation

---

### 2. Worker lifecycle ownership

**Problem**: Worker doesn't own pool lifecycle properly

**Correct pattern**:

```typescript
const pool = createDatabasePool(env.DATABASE_URL, {
  applicationName: 'room-management-worker',
  max: 5,
});
const db = createDatabaseClient(pool);

lifecycle.close = async () => {
  await Promise.all([
    pool.end(), // Close pool, not db.pool
    redis.quit(),
  ]);
};
```

---

### 3. Task 1 incomplete test structure

**Problem**: Task 1 shows booking-code tests but missing:

- OTP derivation tests (no raw storage verification)
- Guest token tests (digest verification)
- Contact normalization tests
- Email masking tests

**Impact**: Cannot verify "no raw OTP storage" requirement without complete tests

---

### 4. Migration task missing inspection steps

**Problem**: Task 2 jumps to migration generation without:

1. Reading existing booking schema constraints
2. Verifying booking_code column exists
3. Checking immutability trigger targets
4. Confirming seed data has zero bookings

**Risk**: Migration might conflict with existing constraints

---

### 5. Concurrency test structure incomplete

**Problem**: Task 4 describes "last-room race" but doesn't show:

- How to create two Pool connections
- How to simulate true concurrency with `Promise.all()`
- How to verify exactly one winner
- How to verify loser gets UNAVAILABLE (not constraint error)

---

### 6. Email template design missing

**Problem**: Outbox design shows:

```typescript
payload: {
  bookingId: booking.id;
} // No PII/OTP
```

But doesn't specify:

- How worker derives OTP from challenge
- How worker loads booking contact
- Template structure
- Subject line
- From address
- Mailpit SMTP config

---

### 7. Guest OTP table schema contradiction

**Problem**: Design shows:

```sql
nonce BYTEA NOT NULL,
CHECK (length(nonce) >= 32)
```

But `length(BYTEA)` returns byte count, not minimum generation requirement.

**Correct**: `CHECK (octet_length(nonce) >= 32)`

---

### 8. Booking code collision retry location

**Problem**: Design shows retry in booking code generator, but actual retry should be in repository layer where unique constraint is enforced.

**Reason**: Generator is pure function; database constraint enforcement happens at insert time.

---

## Corrections required

### Design document fixes

**File**: `docs/superpowers/specs/2026-07-22-phase-5-booking-hold-guest-access-design.md`

#### Section: Worker architecture → Worker main process (lines 521-576)

Replace entire code block with:

```typescript
import { createDatabasePool, createDatabaseClient } from '@room/database'
import { expireStaleHolds } from './expire-holds.js'
import { processOutboxEvents } from './process-outbox.js'

async function bootstrap() {
  const pool = createDatabasePool(env.DATABASE_URL, {
    applicationName: 'room-management-worker',
    max: 5, // Worker-appropriate pool size
    idleTimeoutMillis: 30_000
  })

  const db = createDatabaseClient(pool)
  const redis = new Redis(env.REDIS_URL, ...)

  const lifecycle = new WorkerLifecycle({
    close: async () => {
      clearInterval(expirationInterval)
      clearInterval(outboxInterval)
      await Promise.all([
        pool.end(),
        redis.quit()
      ])
    }
  })

  // Periodic HOLD expiration (30s interval, non-overlapping)
  let expirationRunning = false
  const expirationInterval = setInterval(async () => {
    if (expirationRunning) return
    expirationRunning = true
    try {
      await expireStaleHolds(db)
    } catch (error) {
      logger.error({ err: error }, 'HOLD expiration failed')
    } finally {
      expirationRunning = false
    }
  }, 30_000)

  // Periodic outbox processing (10s interval, non-overlapping)
  let outboxRunning = false
  const outboxInterval = setInterval(async () => {
    if (outboxRunning) return
    outboxRunning = true
    try {
      await processOutboxEvents(db)
    } catch (error) {
      logger.error({ err: error }, 'Outbox processing failed')
    } finally {
      outboxRunning = false
    }
  }, 10_000)

  lifecycle.onShutdown(() => {
    // Intervals cleared in lifecycle.close
  })

  logger.info('Worker started with database and Redis')
}
```

**Changes**:

1. ✅ Use `createDatabasePool()` then `createDatabaseClient(pool)`
2. ✅ Close `pool.end()` not `db.pool.end()`
3. ✅ Add error handling to intervals
4. ✅ Move interval cleanup into lifecycle.close
5. ✅ Add worker-appropriate pool sizing

---

#### Section: Booking code generation (lines 427-467)

**Remove collision retry from generator**. Update to:

```typescript
export function generateBookingCode(): string {
  const alphabet = '123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford Base32 minus ambiguous
  const segments: string[] = [];

  for (let i = 0; i < 3; i++) {
    const segment: string[] = [];
    for (let j = 0; j < 4; j++) {
      const randomIndex = crypto.randomInt(0, alphabet.length);
      segment.push(alphabet[randomIndex]);
    }
    segments.push(segment.join(''));
  }

  return `RM-${segments.join('-')}`;
}

export function normalizeBookingCode(input: string): string {
  return input.toUpperCase().trim();
}
```

**Add collision retry to repository**:

```typescript
// In booking repository
async function insertBookingWithCodeRetry(data: BookingInsert): Promise<Booking> {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateBookingCode();
    try {
      return await db
        .insert(bookings)
        .values({
          ...data,
          bookingCode: code.toUpperCase(),
        })
        .returning();
    } catch (error) {
      if (isUniqueViolation(error, 'bookings_booking_code_key') && attempt < maxAttempts - 1) {
        continue; // Retry with new code
      }
      throw error;
    }
  }
  throw new Error('Failed to generate unique booking code after maximum attempts');
}
```

---

#### Section: Guest OTP challenges table (line 429)

Change constraint from:

```sql
CONSTRAINT guest_otp_challenges_nonce_nonempty_ck CHECK (length(nonce) >= 32),
```

To:

```sql
CONSTRAINT guest_otp_challenges_nonce_nonempty_ck CHECK (octet_length(nonce) >= 32),
```

---

#### Section: Email delivery (new subsection after line 638)

Add missing email template specification:

````markdown
### Email templates

#### HOLD confirmation email

**Subject**: `Your Room Management booking HOLD: {bookingCode}`

**From**: `noreply@roommanagement.example.com`

**Template structure**:

```html
<h1>Booking HOLD Created</h1>
<p>Booking Code: <strong>{bookingCode}</strong></p>
<p>Check-in: {checkIn}</p>
<p>Check-out: {checkOut}</p>
<p>Room Type: {roomTypeName}</p>
<p>Total: {totalAmount} VND</p>
<p><strong>This HOLD expires at {holdExpiresAt}</strong></p>
<p>Your HOLD will be released after 15 minutes unless confirmed by payment.</p>
```
````

**Worker loads**:

- Booking from `bookingId` in outbox payload
- Contact from `booking_contacts` via booking FK
- Sends to `contact.email`

**No PII in outbox**: Outbox contains only `{ bookingId }`, worker loads contact transiently

---

#### OTP request email

**Subject**: `Your booking access code`

**Template**:

```html
<h1>Your Booking Access Code</h1>
<p>Booking Code: <strong>{bookingCode}</strong></p>
<p>Your 6-digit OTP: <strong>{derivedOTP}</strong></p>
<p>This code expires in 10 minutes.</p>
<p>Do not share this code.</p>
```

**Worker derives OTP**:

```typescript
const challenge = await loadOTPChallenge(challengeId);
const otp = deriveOTP({
  secret: env.GUEST_OTP_SECRET,
  challengeId: challenge.id,
  nonce: challenge.nonce,
  bookingId: challenge.bookingId,
  expiresAt: challenge.expiresAt,
});
```

**Mailpit SMTP config** (test environment):

```typescript
{
  host: 'localhost',
  port: 1025,
  secure: false,
  auth: undefined // Mailpit doesn't require auth
}
```

````

---

### Implementation plan fixes

**File**: `docs/superpowers/plans/2026-07-22-phase-5-booking-hold-guest-access.md`

#### Task 1: Add missing test files

After line 68, add complete test structure:

```markdown
### Complete test structure

**booking-code.test.ts**:
- ✅ Format validation
- ✅ Uniqueness across 1000 iterations
- ✅ No ambiguous characters
- ✅ Case normalization

**otp.test.ts**:
- [ ] Derives deterministic OTP from challenge + secret
- [ ] Same inputs produce same OTP
- [ ] Different nonce produces different OTP
- [ ] Expired challenge rejected
- [ ] Constant-time verification
- [ ] No raw OTP in memory after derivation

**guest-token.test.ts**:
- [ ] Generates 256-bit token
- [ ] Digest is deterministic
- [ ] Same token produces same digest
- [ ] Different tokens produce different digests
- [ ] Token not recoverable from digest

**contact.test.ts**:
- [ ] Normalizes email to lowercase
- [ ] Trims whitespace
- [ ] Validates email format
- [ ] Normalizes phone to E.164
- [ ] Masks email (gu***@example.com)
- [ ] Rejects empty full_name
````

---

#### Task 2: Add schema inspection before migration

Before line 163 "RED test", add:

````markdown
### Pre-migration inspection

```bash
# Verify booking table structure
psql $DATABASE_URL -c "\d bookings"

# Confirm booking_code column exists
psql $DATABASE_URL -c "SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'bookings' AND column_name = 'booking_code'"

# Check immutability trigger
psql $DATABASE_URL -c "SELECT tgname, tgtype, tgenabled
FROM pg_trigger
WHERE tgrelid = 'bookings'::regclass"

# Verify zero booking rows
psql $DATABASE_URL -c "SELECT COUNT(*) FROM bookings"
```
````

**Expected**:

- booking_code: TEXT NOT NULL with unique constraint
- Immutability trigger: `prevent_booking_immutable_field_updates`
- Row count: 0

````

---

#### Task 4: Add concurrency test implementation

Replace vague description with:

```typescript
// packages/database/test/integration/hold-allocation-concurrency.test.ts
import { Pool } from 'pg'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

describe('HOLD allocation concurrency', () => {
  let pool1: Pool
  let pool2: Pool

  beforeAll(async () => {
    pool1 = createDatabasePool(env.DATABASE_URL, { applicationName: 'test-conn-1' })
    pool2 = createDatabasePool(env.DATABASE_URL, { applicationName: 'test-conn-2' })
  })

  afterAll(async () => {
    await pool1.end()
    await pool2.end()
  })

  it('last-room race: one succeeds, one UNAVAILABLE', async () => {
    // Setup: one quote, one room
    await insertCatalogFixture(pool1)
    const quote1 = await insertQuote(pool1, { roomTypeId })
    const quote2 = await insertQuote(pool1, { roomTypeId })

    // Act: two concurrent HOLD requests
    const [result1, result2] = await Promise.all([
      createBookingHold(createDatabaseClient(pool1), { quoteId: quote1.id, guest: contact1 }),
      createBookingHold(createDatabaseClient(pool2), { quoteId: quote2.id, guest: contact2 })
    ])

    // Assert: exactly one succeeded
    const succeeded = [result1, result2].filter(r => r.status === 'HOLD')
    const unavailable = [result1, result2].filter(r => r.error?.code === 'ROOM_TYPE_UNAVAILABLE')

    expect(succeeded).toHaveLength(1)
    expect(unavailable).toHaveLength(1)

    // Verify winner allocated the room
    const blocks = await pool1.query('SELECT * FROM room_inventory_blocks WHERE status = $1', ['ACTIVE'])
    expect(blocks.rowCount).toBe(1)
  })

  it('two-room race: both succeed with different rooms', async () => {
    // Setup: two quotes, two rooms of same type
    const quote1 = await insertQuote(pool1, { roomTypeId })
    const quote2 = await insertQuote(pool1, { roomTypeId })

    // Act
    const [result1, result2] = await Promise.all([
      createBookingHold(createDatabaseClient(pool1), { quoteId: quote1.id, guest: contact1 }),
      createBookingHold(createDatabaseClient(pool2), { quoteId: quote2.id, guest: contact2 })
    ])

    // Assert: both succeeded with different rooms
    expect(result1.status).toBe('HOLD')
    expect(result2.status).toBe('HOLD')
    expect(result1.roomId).not.toBe(result2.roomId)
  })
})
````

---

## Summary of corrections

| Issue                     | Location             | Fix                                                       |
| ------------------------- | -------------------- | --------------------------------------------------------- |
| Database connection API   | Design line 524-543  | Use `createDatabasePool()` + `createDatabaseClient(pool)` |
| Pool lifecycle            | Design line 539      | Close `pool.end()` not `db.pool.end()`                    |
| Booking code retry        | Design line 453-467  | Move to repository layer                                  |
| BYTEA constraint          | Design line 429      | Use `octet_length()` not `length()`                       |
| Missing email templates   | Design (new section) | Add template specs + Mailpit config                       |
| Incomplete Task 1 tests   | Plan line 70-100     | Add OTP/token/contact test specs                          |
| Missing schema inspection | Plan Task 2          | Add pre-migration verification                            |
| Vague concurrency tests   | Plan Task 4          | Add complete implementation example                       |

---

## Next steps (historical — already executed)

1. ~~Apply these corrections to both documents~~ — done, folded into the broader 20-item correction pass in `.cursor/phase5-correction-summary.md`.
2. ~~Create new commit: `docs: correct phase 5 design architecture`~~ — superseded by the corrected design/plan documents committed ahead of `c7d207f`.
3. `2a7bd09` was not amended, per the original constraint.
4. Task 1 implementation proceeded and closed at `c7d207f`; Task 2 closed at `7698353`.

---

**Correction author**: Phase 5 design review  
**Review date**: 2026-07-22 11:24 AM UTC+7
