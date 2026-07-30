import { Buffer } from 'node:buffer';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

import { BookingHoldStatusService } from '../../src/booking/services/booking-hold-status.service.js';
import { GuestAccessOtpRequestService } from '../../src/booking/services/guest-access-otp-request.service.js';
import { GuestAccessOtpVerifyService } from '../../src/booking/services/guest-access-otp-verify.service.js';
import { GuestLogoutService } from '../../src/booking/services/guest-logout.service.js';
import {
  GuestSessionInvalidError,
  GuestSessionService,
} from '../../src/booking/services/guest-session.service.js';
import { GuestAccessRepository } from '../../src/booking/repositories/guest-access.repository.js';
import { GuestSessionRepository } from '../../src/booking/repositories/guest-session.repository.js';
import { parseCidrList, type RequestLike } from '../../src/booking/ip.js';
import { serializeGuestSessionCookie } from '../../src/booking/cookie.js';
import { loadGuestSecrets, type GuestSecrets } from '../../src/booking/secrets.js';

const PROPERTY_ID = '550e8400-e29b-41d4-a716-446655440110';
const TIER_ID = '550e8400-e29b-41d4-a716-446655440120';
const ROOM_TYPE_ID = '550e8400-e29b-41d4-a716-446655440130';
const ROOM_ID = '550e8400-e29b-41d4-a716-446655440140';
const PLAN_ID = '550e8400-e29b-41d4-a716-446655440150';
const PRICE_ID = '550e8400-e29b-41d4-a716-446655440160';

const SECRETS: GuestSecrets = loadGuestSecrets({
  GUEST_OTP_SECRET: 'a'.repeat(48),
  GUEST_CHALLENGE_REF_SECRET: 'b'.repeat(48),
  GUEST_SESSION_SECRET: 'c'.repeat(48),
  BOOKING_IP_DIGEST_SECRET: 'd'.repeat(48),
});

const RATE_LIMIT_CONFIG = {
  requestWindowMs: 5 * 60 * 1000,
  requestLimit: 5,
  ipWindowMs: 10 * 60 * 1000,
  ipLimit: 20,
  resendCooldownMs: 60 * 1000,
  otpTtlMs: 5 * 60 * 1000,
  sessionTtlMs: 30 * 60 * 1000,
};

function ip() {
  return '203.0.113.10';
}

function makeBookingCode(): string {
  const raw = randomUUID()
    .replace(/-/g, '')
    .toUpperCase()
    .split('')
    .filter((c) => !['0', 'O', 'I', 'L'].includes(c));
  const prefix = 'RM';
  const chars = (raw.join('') + 'ABCDEFGHJKMNPQRSTUVWXYZ23456789').slice(0, 12);
  return `${prefix}-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

function seedBookingHold(
  pool: DatabasePool,
  params: { contact: { fullName: string; email: string; phoneE164: string }; emailDigest: Buffer },
) {
  return pool
    .query<{ id: string; booking_code: string }>(
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
    )
    .then(async (res) => {
      const row = res.rows[0];
      if (!row) throw new Error('seed insert returned no row');
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
    });
}

describe('public booking + guest access vertical slice', () => {
  let database: GuardedTestDatabase;
  let pool: DatabasePool;
  let client: DatabaseClient;
  let otpRequest: GuestAccessOtpRequestService;
  let otpVerify: GuestAccessOtpVerifyService;
  let sessions: GuestSessionService;
  let logout: GuestLogoutService;
  let holdStatus: BookingHoldStatusService;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    pool = database.pool;
    client = createDatabaseClient(pool);
    const guestAccessRepo = new GuestAccessRepository(pool, client, SECRETS, RATE_LIMIT_CONFIG);
    const sessionRepo = new GuestSessionRepository(pool);
    otpRequest = new GuestAccessOtpRequestService(guestAccessRepo, SECRETS, RATE_LIMIT_CONFIG);
    otpVerify = new GuestAccessOtpVerifyService(guestAccessRepo, SECRETS);
    sessions = new GuestSessionService(sessionRepo, SECRETS);
    logout = new GuestLogoutService(guestAccessRepo, sessions);
    holdStatus = new BookingHoldStatusService(client, SECRETS);
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

  afterAll(async () => database?.dispose());

  it('runs HOLD → OTP request → verify → cookie → detail → logout end-to-end', async () => {
    const email = 'guest@example.com';
    const phone = '+84909000000';
    const emailDigest = computeDigest({
      secretKey: SECRETS.ipDigestSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.emailLookup,
      parts: [Buffer.from(email, 'utf8')],
    });
    const { bookingCode } = await seedBookingHold(pool, {
      contact: { fullName: 'Guest Example', email, phoneE164: phone },
      emailDigest,
    });

    const statusBefore = await holdStatus.status({ bookingCode, email }, new Date());
    expect(statusBefore.status).toBe('HOLD');

    const requestIp = ip();
    const req: RequestLike = { socket: { remoteAddress: '198.51.100.1' } };

    const otpRequestResult = await otpRequest.request({ bookingCode, email }, requestIp);
    expect(otpRequestResult.challengeRef).toMatch(/^[1-9A-HJKMNP-Z]{32}$/);
    expect(otpRequestResult.cooldownSeconds).toBeGreaterThanOrEqual(0);

    const challengeRow = await pool.query<{ id: string; nonce: Buffer; expires_at: Date }>(
      `SELECT id, nonce, expires_at FROM guest_otp_challenges
        WHERE challenge_ref_digest = (
          SELECT challenge_ref_digest FROM guest_otp_challenges
          WHERE expires_at > now() ORDER BY created_at DESC LIMIT 1
        )
        LIMIT 1`,
    );
    expect(challengeRow.rows[0]).toBeDefined();
    const challenge = challengeRow.rows[0];
    if (!challenge) throw new Error('expected a challenge row');
    const nonce = challenge.nonce;
    const otp = deriveOtpForChallenge(SECRETS.otpSecret, nonce);

    const verifyResult = await otpVerify.verify(
      { challengeRef: otpRequestResult.challengeRef, otp },
      requestIp,
      new Date(),
    );
    expect(verifyResult.bookingCode).toBe(bookingCode);
    expect(verifyResult.response.bookingCode).toBe(bookingCode);
    expect(verifyResult.response.expiresAt).toBeDefined();

    const cookie = serializeGuestSessionCookie(verifyResult.sessionToken, {
      nodeEnv: 'test',
      ttlSeconds: Math.floor(RATE_LIMIT_CONFIG.sessionTtlMs / 1000),
    });
    expect(cookie.header).toContain('rm_guest_session_v1');

    const session = await sessions.authenticate(verifyResult.sessionToken, new Date());
    expect(session.bookingId).toBeDefined();
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const logoutResult = await logout.logout(verifyResult.sessionToken, new Date());
    expect(logoutResult.loggedOutAt).toBeDefined();
    await expect(
      sessions.authenticate(verifyResult.sessionToken, new Date()),
    ).rejects.toBeInstanceOf(GuestSessionInvalidError);

    void req;
    void parseCidrList;
  });

  it('rejects a fifth OTP request within the request window for the same booking + email', async () => {
    const email = 'cooldown@example.com';
    const phone = '+84909000000';
    const expectedEmailDigest = computeDigest({
      secretKey: SECRETS.ipDigestSecret,
      domainLabel: DIGEST_DOMAIN_LABELS.emailLookup,
      parts: [Buffer.from(email, 'utf8')],
    });
    const { bookingCode } = await seedBookingHold(pool, {
      contact: { fullName: 'Cooldown Tester', email, phoneE164: phone },
      emailDigest: expectedEmailDigest,
    });
    // Sanity: confirm the first request actually inserted a challenge row
    // (i.e. that the email digest matched). If it returns a decoy, the
    // rate-limit window test below is meaningless.
    const first = await otpRequest.request({ bookingCode, email }, ip());
    const challengeCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM guest_otp_challenges WHERE booking_id = (SELECT id FROM bookings WHERE booking_code = $1)`,
      [bookingCode],
    );
    expect(Number(challengeCount.rows[0]?.count ?? '0')).toBe(1);
    expect(first.cooldownSeconds).toBeGreaterThanOrEqual(0);

    // Push the booking's email digest count to the request limit (5).
    // Each subsequent request replaces the active challenge but stays
    // inside the request window.
    for (let i = 1; i < 5; i += 1) {
      await otpRequest.request({ bookingCode, email }, ip());
    }
    await expect(otpRequest.request({ bookingCode, email }, ip())).rejects.toMatchObject({
      code: 'OTP_RATE_LIMITED',
    });
  });

  it('returns a decoy OTP response when the booking code is well-formed but unknown', async () => {
    const unknownCode = 'RM-AB23-CD45-EF67';
    const response = await otpRequest.request(
      { bookingCode: unknownCode, email: 'unknown@example.com' },
      ip(),
    );
    expect(response.challengeRef).toMatch(/^[1-9A-HJKMNP-Z]{32}$/);
    expect(response.cooldownSeconds).toBe(0);
  });
});
