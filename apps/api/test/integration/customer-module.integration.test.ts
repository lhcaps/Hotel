import { Buffer } from 'node:buffer';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

import { computeDigest, DIGEST_DOMAIN_LABELS, deriveOtpForChallenge } from '@room/booking';
import {
  createDatabaseClient,
  migrateDatabase,
  type DatabaseClient,
  type DatabasePool,
} from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import { CustomerAuditAdapter } from '../../src/customer/customer-audit.adapter.js';
import { CustomerBookingService } from '../../src/customer/customer-booking.service.js';
import { ClaimBookingService } from '../../src/customer/claim-booking.service.js';
import { CustomerProfileService } from '../../src/customer/customer-profile.service.js';
import { GuestAccessOtpRequestService } from '../../src/booking/services/guest-access-otp-request.service.js';
import { GuestAccessOtpVerifyService } from '../../src/booking/services/guest-access-otp-verify.service.js';
import { GuestAccessRepository } from '../../src/booking/repositories/guest-access.repository.js';
import { digestSessionToken } from '../../src/booking/repositories/guest-session.repository.js';

const PROPERTY_ID = '550e8400-e29b-41d4-a716-446655440210';
const TIER_ID = '550e8400-e29b-41d4-a716-446655440220';
const ROOM_TYPE_ID = '550e8400-e29b-41d4-a716-446655440230';
const ROOM_ID = '550e8400-e29b-41d4-a716-446655440240';
const PLAN_ID = '550e8400-e29b-41d4-a716-446655440250';
const PRICE_ID = '550e8400-e29b-41d4-a716-446655440260';

const SECRETS = {
  otpSecret: Buffer.from('a'.repeat(48), 'utf8'),
  challengeRefSecret: Buffer.from('b'.repeat(48), 'utf8'),
  sessionSecret: Buffer.from('c'.repeat(48), 'utf8'),
  ipDigestSecret: Buffer.from('d'.repeat(48), 'utf8'),
};

const RATE_LIMIT_CONFIG = {
  requestWindowMs: 5 * 60 * 1000,
  requestLimit: 5,
  ipWindowMs: 10 * 60 * 1000,
  ipLimit: 20,
  resendCooldownMs: 60 * 1000,
  otpTtlMs: 5 * 60 * 1000,
  sessionTtlMs: 30 * 60 * 1000,
};

function ip(): string {
  return '203.0.113.30';
}

function makeBookingCode(): string {
  const alphabet = '123456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let raw = '';
  while (raw.length < 12) {
    raw += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (raw.length >= 12) break;
  }
  return `RM-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

async function seedBookingHold(
  pool: DatabasePool,
  params: {
    contact: { fullName: string; email: string; phoneE164: string };
    emailDigest: Buffer;
  },
): Promise<{ id: string; bookingCode: string }> {
  const result = await pool.query<{ id: string; booking_code: string }>(
    `INSERT INTO bookings (property_id, room_type_id, room_id, booking_code, status, check_in, check_out, adults, children, currency, gross_amount_vnd, discount_amount_vnd, final_amount_vnd, price_snapshot, hold_expires_at)
     VALUES ($1,$2,$3,$4,'HOLD',$5,$6,$7,0,'VND',359000,0,359000,$8,$9)
     RETURNING id, booking_code`,
    [
      PROPERTY_ID,
      ROOM_TYPE_ID,
      ROOM_ID,
      makeBookingCode(),
      new Date('2027-01-10T03:00:00.000Z'),
      new Date('2027-01-10T06:00:00.000Z'),
      2,
      { baseAmountVnd: 359000, extraAmountVnd: 0, totalAmountVnd: 359000 },
      new Date('2027-01-10T03:30:00.000Z'),
    ],
  );
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error('seed insert returned no row');
  }
  await pool.query(
    `INSERT INTO booking_contacts (booking_id, full_name, normalized_email, normalized_phone_e164, email_digest)
     VALUES ($1,$2,$3,$4,$5)`,
    [
      row.id,
      params.contact.fullName,
      params.contact.email,
      params.contact.phoneE164,
      params.emailDigest,
    ],
  );
  return { id: row.id, bookingCode: row.booking_code };
}

async function insertCustomerUser(
  pool: DatabasePool,
  email: string,
  options: { status?: 'ACTIVE' | 'DISABLED' } = {},
): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO users (id, name, email, email_verified, role, status) VALUES ($1, $2, $3, true, 'CUSTOMER', $4)`,
    [id, `Customer ${email}`, email, options.status ?? 'ACTIVE'],
  );
  return { id, email };
}

interface GuestContext {
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly tokenDigest: Buffer;
}

async function obtainGuestSession(
  pool: DatabasePool,
  client: DatabaseClient,
  bookingCode: string,
  email: string,
): Promise<GuestContext> {
  const repo = new GuestAccessRepository(pool, client, SECRETS, RATE_LIMIT_CONFIG);
  const requester = new GuestAccessOtpRequestService(repo, SECRETS, RATE_LIMIT_CONFIG);
  const requestResult = await requester.request({ bookingCode, email }, ip());
  expect(requestResult.challengeRef).toMatch(/^[1-9A-HJKMNP-Z]{32}$/);

  const challengeRow = await pool.query<{ nonce: Buffer }>(
    `SELECT nonce FROM guest_otp_challenges
     WHERE challenge_ref_digest IS NOT NULL
       AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
  );
  const challenge = challengeRow.rows[0];
  if (!challenge) throw new Error('expected a challenge row');
  const otp = deriveOtpForChallenge(SECRETS.otpSecret, challenge.nonce);

  const verifier = new GuestAccessOtpVerifyService(repo, SECRETS);
  const verifyResult = await verifier.verify(
    { challengeRef: requestResult.challengeRef, otp },
    ip(),
    new Date(),
  );
  expect(verifyResult.bookingCode).toBe(bookingCode);

  const tokenDigest = digestSessionToken(SECRETS.sessionSecret, verifyResult.sessionToken);
  const sessions = await pool.query<{ booking_id: string }>(
    `SELECT booking_id FROM guest_sessions WHERE token_digest = $1 LIMIT 1`,
    [tokenDigest],
  );
  const bookingRow = sessions.rows[0];
  if (bookingRow === undefined) {
    throw new Error('guest session row not found after verify');
  }
  return {
    bookingId: bookingRow.booking_id,
    bookingCode,
    tokenDigest,
  };
}

describe('customer module — profile, ownership, claim, payment status', () => {
  let database: GuardedTestDatabase;
  let pool: DatabasePool;
  let client: DatabaseClient;
  let profileService: CustomerProfileService;
  let claimService: ClaimBookingService;
  let bookingService: CustomerBookingService;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) {
      throw new Error('TEST_DATABASE_URL is required');
    }
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    pool = database.pool;
    client = createDatabaseClient(pool);
    const audit = new CustomerAuditAdapter(client);
    profileService = new CustomerProfileService(client, audit);
    claimService = new ClaimBookingService({ database: client });
    bookingService = new CustomerBookingService(client);

    await pool.query(
      `INSERT INTO properties (id,code,name,timezone) VALUES ($1,'MAIN','Main','Asia/Ho_Chi_Minh')`,
      [PROPERTY_ID],
    );
    await pool.query(
      `INSERT INTO price_tiers (id,property_id,code,name,sort_order) VALUES ($1,$2,'TIER_1','Tier',1)`,
      [TIER_ID, PROPERTY_ID],
    );
    await pool.query(
      `INSERT INTO room_types (id,property_id,price_tier_id,code,name,max_adults,max_children,max_occupancy) VALUES ($1,$2,$3,'DLX','Deluxe',2,1,3)`,
      [ROOM_TYPE_ID, PROPERTY_ID, TIER_ID],
    );
    await pool.query(
      `INSERT INTO rooms (id,property_id,room_type_id,room_number) VALUES ($1,$2,$3,'101')`,
      [ROOM_ID, PROPERTY_ID, ROOM_TYPE_ID],
    );
    await pool.query(
      `INSERT INTO rate_plans (id,property_id,code,name,status,included_duration_minutes,priority,is_base_plan,min_duration_minutes_inclusive,max_duration_minutes_inclusive)
       VALUES ($1,$2,'THREE_HOUR_COMBO','Three hours','ACTIVE',180,1,true,60,240)`,
      [PLAN_ID, PROPERTY_ID],
    );
    await pool.query(
      `INSERT INTO rate_plan_prices (id,property_id,rate_plan_id,price_tier_id,amount_vnd) VALUES ($1,$2,$3,$4,359000)`,
      [PRICE_ID, PROPERTY_ID, PLAN_ID, TIER_ID],
    );
  });

  afterAll(async () => {
    await database?.dispose();
  });

  afterEach(async () => {
    // Each test uses unique booking codes, contact emails, and
    // customer emails so cross-test row accumulation does not cause
    // false positives. `audit_events` is append-only (INV-025) and
    // `booking_contacts` is immutable; both are filtered by aggregate
    // id / event_type in the test assertions.
  });

  it('STAGE G: profile is empty for a fresh CUSTOMER and patches create a row + audit event', async () => {
    const customer = await insertCustomerUser(pool, 'profile@example.test');
    const before = await profileService.getProfile(customer.id);
    expect(before).toEqual(
      expect.objectContaining({
        userId: customer.id,
        email: 'profile@example.test',
        phone: null,
        countryCode: 'VN',
      }),
    );

    const patched = await profileService.patchProfile(
      customer.id,
      {
        name: 'Updated Name',
        phone: '+84909000101',
        addressLine1: '123 Lê Lợi',
        ward: 'Bến Nghé',
        district: '1',
        province: 'Hồ Chí Minh',
        countryCode: 'VN',
      },
      { actorId: customer.id, requestId: 'req-profile-1' },
    );
    expect(patched.name).toBe('Updated Name');
    expect(patched.phone).toBe('+84909000101');
    expect(patched.addressLine1).toBe('123 Lê Lợi');
    expect(patched.countryCode).toBe('VN');

    const audit = await pool.query<{
      event_type: string;
      payload: { changedFields: string[] };
    }>(
      `SELECT event_type, payload FROM audit_events
       WHERE event_type = 'CUSTOMER_PROFILE_UPDATED' AND aggregate_id = $1`,
      [customer.id],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]?.payload.changedFields).toEqual(
      expect.arrayContaining(['name', 'phone', 'addressLine1', 'ward', 'district', 'province']),
    );
  });

  it('STAGE H: listForCustomer only returns bookings owned by the CUSTOMER', async () => {
    const customerA = await insertCustomerUser(pool, 'a@example.test');
    const customerB = await insertCustomerUser(pool, 'b@example.test');

    const claimed = await seedBookingHold(pool, {
      contact: {
        fullName: 'Owner A',
        email: 'guest-owner@example.com',
        phoneE164: '+84909000200',
      },
      emailDigest: computeDigest({
        secretKey: SECRETS.ipDigestSecret,
        domainLabel: DIGEST_DOMAIN_LABELS.emailLookup,
        parts: [Buffer.from('guest-owner@example.com', 'utf8')],
      }),
    });
    await seedBookingHold(pool, {
      contact: {
        fullName: 'Owner B',
        email: 'guest-other@example.com',
        phoneE164: '+84909000201',
      },
      emailDigest: computeDigest({
        secretKey: SECRETS.ipDigestSecret,
        domainLabel: DIGEST_DOMAIN_LABELS.emailLookup,
        parts: [Buffer.from('guest-other@example.com', 'utf8')],
      }),
    });
    await pool.query(`UPDATE bookings SET customer_user_id = $1 WHERE booking_code = $2`, [
      customerA.id,
      claimed.bookingCode,
    ]);

    const listA = await bookingService.listForCustomer(customerA.id, { limit: 10 });
    expect(listA.items).toHaveLength(1);
    expect(listA.items[0]?.bookingCode).toBe(claimed.bookingCode);

    const listB = await bookingService.listForCustomer(customerB.id, { limit: 10 });
    expect(listB.items).toHaveLength(0);
  });

  it('STAGE J: detailForCustomer returns authoritative paymentStatus from the payments table', async () => {
    const customer = await insertCustomerUser(pool, 'payments@example.test');
    const emailDigest = computeDigest({
      secretKey: SECRETS.ipDigestSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.emailLookup,
      parts: [Buffer.from('payments@example.com', 'utf8')],
    });
    const seeded = await seedBookingHold(pool, {
      contact: {
        fullName: 'Pay Test',
        email: 'payments@example.com',
        phoneE164: '+84909000300',
      },
      emailDigest,
    });
    await pool.query(`UPDATE bookings SET customer_user_id = $1 WHERE booking_code = $2`, [
      customer.id,
      seeded.bookingCode,
    ]);

    // Before a payment row is created, the API exposes the literal
    // "NONE" sentinel so CUSTOMERs cannot infer a hidden attempt.
    const before = await bookingService.detailForCustomer(customer.id, seeded.bookingCode);
    expect(before.paymentStatus).toBe('NONE');

    const paymentResult = await pool.query<{ id: string }>(
      `INSERT INTO payments (
         property_id, booking_id, status, amount_vnd, currency,
         confirmation_source, succeeded_at
       )
       VALUES ($1, $2, 'SUCCEEDED', 359000, 'VND', 'PROVIDER_EVENT', now())
       RETURNING id`,
      [PROPERTY_ID, seeded.id],
    );
    expect(paymentResult.rows).toHaveLength(1);

    const after = await bookingService.detailForCustomer(customer.id, seeded.bookingCode);
    expect(after.paymentStatus).toBe('SUCCEEDED');
    expect(after.grossAmountVnd).toBe('359000');
    expect(after.finalAmountVnd).toBe('359000');
  });

  it('STAGE I: claim links the booking to the CUSTOMER and rejects a foreign CUSTOMER', async () => {
    const alice = await insertCustomerUser(pool, 'alice@example.test');
    const bob = await insertCustomerUser(pool, 'bob@example.test');

    const email = 'guest-claim@example.com';
    const emailDigest = computeDigest({
      secretKey: SECRETS.ipDigestSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.emailLookup,
      parts: [Buffer.from(email, 'utf8')],
    });
    const seeded = await seedBookingHold(pool, {
      contact: { fullName: 'Claim Test', email, phoneE164: '+84909000400' },
      emailDigest,
    });
    const guestSession = await obtainGuestSession(pool, client, seeded.bookingCode, email);

    // Alice claims first using her guest session — success.
    const aliceClaim = await claimService.claim({
      bookingCode: seeded.bookingCode,
      userId: alice.id,
      guestSessionTokenDigest: guestSession.tokenDigest,
    });
    expect(aliceClaim.wasAlreadyClaimed).toBe(false);
    expect(aliceClaim.bookingCode).toBe(seeded.bookingCode);

    // Bob has no guest session bound to the booking — must be refused.
    await expect(
      claimService.claim({
        bookingCode: seeded.bookingCode,
        userId: bob.id,
        guestSessionTokenDigest: null,
      }),
    ).rejects.toMatchObject({ code: 'GUEST_SESSION_REQUIRED' });

    // Bob has a session bound to a *different* booking — must be refused.
    const otherBooking = await seedBookingHold(pool, {
      contact: {
        fullName: 'Other',
        email: 'other-claim@example.com',
        phoneE164: '+84909000401',
      },
      emailDigest: computeDigest({
        secretKey: SECRETS.ipDigestSecret,
        domainLabel: DIGEST_DOMAIN_LABELS.emailLookup,
        parts: [Buffer.from('other-claim@example.com', 'utf8')],
      }),
    });
    const bobSession = await obtainGuestSession(
      pool,
      client,
      otherBooking.bookingCode,
      'other-claim@example.com',
    );
    await expect(
      claimService.claim({
        bookingCode: seeded.bookingCode,
        userId: bob.id,
        guestSessionTokenDigest: bobSession.tokenDigest,
      }),
    ).rejects.toMatchObject({ code: 'GUEST_SESSION_MISMATCH' });

    // Bob, with a guest session bound to Alice's booking, must still
    // be refused because the booking is already linked to Alice.
    const bobSessionForAliceBooking = await obtainGuestSession(
      pool,
      client,
      seeded.bookingCode,
      email,
    );
    await expect(
      claimService.claim({
        bookingCode: seeded.bookingCode,
        userId: bob.id,
        guestSessionTokenDigest: bobSessionForAliceBooking.tokenDigest,
      }),
    ).rejects.toMatchObject({ code: 'BOOKING_ALREADY_LINKED' });

    // Alice re-claiming with the same session must be idempotent.
    const idempotent = await claimService.claim({
      bookingCode: seeded.bookingCode,
      userId: alice.id,
      guestSessionTokenDigest: bobSessionForAliceBooking.tokenDigest,
    });
    expect(idempotent.wasAlreadyClaimed).toBe(true);
  });

  it('STAGE F: DISABLED CUSTOMER cannot claim a booking even with a valid guest session', async () => {
    const customer = await insertCustomerUser(pool, 'disabled@example.test', {
      status: 'DISABLED',
    });
    const email = 'guest-disabled@example.com';
    const emailDigest = computeDigest({
      secretKey: SECRETS.ipDigestSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.emailLookup,
      parts: [Buffer.from(email, 'utf8')],
    });
    const seeded = await seedBookingHold(pool, {
      contact: { fullName: 'Disabled', email, phoneE164: '+84909000500' },
      emailDigest,
    });
    const guestSession = await obtainGuestSession(pool, client, seeded.bookingCode, email);
    await expect(
      claimService.claim({
        bookingCode: seeded.bookingCode,
        userId: customer.id,
        guestSessionTokenDigest: guestSession.tokenDigest,
      }),
    ).rejects.toMatchObject({ code: 'CUSTOMER_DISABLED' });
  });

  it('STAGE J-extension: detailForCustomer refuses to leak bookings the CUSTOMER does not own', async () => {
    const alice = await insertCustomerUser(pool, 'alice2@example.test');
    const bob = await insertCustomerUser(pool, 'bob2@example.test');

    const emailDigest = computeDigest({
      secretKey: SECRETS.ipDigestSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.emailLookup,
      parts: [Buffer.from('isolated@example.com', 'utf8')],
    });
    const seeded = await seedBookingHold(pool, {
      contact: {
        fullName: 'Iso',
        email: 'isolated@example.com',
        phoneE164: '+84909000600',
      },
      emailDigest,
    });
    await pool.query(`UPDATE bookings SET customer_user_id = $1 WHERE booking_code = $2`, [
      alice.id,
      seeded.bookingCode,
    ]);

    await expect(
      bookingService.detailForCustomer(bob.id, seeded.bookingCode),
    ).rejects.toMatchObject({ name: 'CustomerBookingNotFoundError' });
  });
});
