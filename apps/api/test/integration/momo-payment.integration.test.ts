import 'reflect-metadata';

import { Buffer } from 'node:buffer';
import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';

import { Module, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { type NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { createDatabaseClient, migrateDatabase, type DatabasePool } from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BookingDetailRepository } from '../../src/booking/repositories/booking-detail.repository.js';
import {
  digestSessionToken,
  GuestSessionRepository,
} from '../../src/booking/repositories/guest-session.repository.js';
import { GuestSessionService } from '../../src/booking/services/guest-session.service.js';
import type { GuestSecrets } from '../../src/booking/secrets.js';
import { DatabaseProvider } from '../../src/database/database.provider.js';
import { ProblemDetailsFilter } from '../../src/errors/problem-details.filter.js';
import { createApiHttpAdapter } from '../../src/http-adapter.js';
import { MomoPaymentController } from '../../src/payment/momo-payment.controller.js';
import { MomoReturnController } from '../../src/payment/momo-return.controller.js';
import { MomoWebhookController } from '../../src/payment/momo-webhook.controller.js';
import { MOMO_ADAPTER } from '../../src/payment/payment.tokens.js';
import {
  buildMomoIpnCanonicalString,
  MomoAdapter,
  type MomoConfig,
} from '../../src/payment/providers/momo/momo.adapter.js';
import { signMomoCanonicalString } from '../../src/payment/providers/momo/momo.signature.js';
import { MomoPaymentInitiationService } from '../../src/payment/services/momo-payment-initiation.service.js';
import { PaymentProviderSettingsService } from '../../src/payment/services/payment-provider-settings.service.js';
import { VnpayPaymentController } from '../../src/payment/vnpay-payment.controller.js';
import { VnpayReturnController } from '../../src/payment/vnpay-return.controller.js';
import { VnpayWebhookController } from '../../src/payment/vnpay-webhook.controller.js';
import { VNPAY_ADAPTER } from '../../src/payment/payment.tokens.js';
import { VnpayAdapter } from '../../src/payment/providers/vnpay/vnpay.adapter.js';
import {
  signVnpayCanonicalQuery,
  buildVnpayCanonicalQuery,
} from '../../src/payment/providers/vnpay/vnpay.signature.js';
import { VnpayPaymentInitiationService } from '../../src/payment/services/vnpay-payment-initiation.service.js';
import { normalizeContact } from '@room/booking';

const TEST_SECRETS: GuestSecrets = {
  otpSecret: Buffer.from('o'.repeat(48), 'utf8'),
  challengeRefSecret: Buffer.from('c'.repeat(48), 'utf8'),
  sessionSecret: Buffer.from('s'.repeat(48), 'utf8'),
  ipDigestSecret: Buffer.from('i'.repeat(48), 'utf8'),
};

const MOMO_SECRET = 'momo-integration-secret-key-at-least-thirty-two-chars';
const MOMO_ACCESS_KEY = 'momo-integration-access-key';
const MOMO_PARTNER_CODE = 'MOMO_INTEGRATION_TEST';
const VNPAY_TMN_CODE = 'VNPAY_INTEGRATION_TEST';
const VNPAY_SECRET = 'vnpay-integration-secret-at-least-thirty-two-characters';

type ProviderMode = 'SUCCESS' | 'TIMEOUT';
type ProviderRequest = { readonly body: Record<string, unknown> };

let databaseProvider: DatabaseProvider;
let adapter: MomoAdapter;
let vnpayAdapter: VnpayAdapter;
let ipnSequence = 0;

@Module({
  controllers: [
    MomoPaymentController,
    MomoWebhookController,
    MomoReturnController,
    VnpayPaymentController,
    VnpayWebhookController,
    VnpayReturnController,
  ],
  providers: [
    { provide: DatabaseProvider, useFactory: () => databaseProvider },
    {
      provide: BookingDetailRepository,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider) => new BookingDetailRepository(database.client),
    },
    {
      provide: GuestSessionRepository,
      inject: [DatabaseProvider],
      useFactory: (database: DatabaseProvider) =>
        new GuestSessionRepository(database.pool as unknown as DatabasePool),
    },
    {
      provide: GuestSessionService,
      inject: [GuestSessionRepository],
      useFactory: (repository: GuestSessionRepository) =>
        new GuestSessionService(repository, TEST_SECRETS),
    },
    { provide: MOMO_ADAPTER, useFactory: () => adapter },
    { provide: VNPAY_ADAPTER, useFactory: () => vnpayAdapter },
    {
      provide: PaymentProviderSettingsService,
      useValue: { isAvailable: async () => true },
    },
    {
      provide: MomoPaymentInitiationService,
      inject: [
        DatabaseProvider,
        BookingDetailRepository,
        GuestSessionService,
        MOMO_ADAPTER,
        PaymentProviderSettingsService,
      ],
      useFactory: (
        database: DatabaseProvider,
        bookings: BookingDetailRepository,
        sessions: GuestSessionService,
        momo: MomoAdapter,
        settings: PaymentProviderSettingsService,
      ) => new MomoPaymentInitiationService(database, bookings, sessions, momo, settings),
    },
    {
      provide: VnpayPaymentInitiationService,
      inject: [
        DatabaseProvider,
        BookingDetailRepository,
        GuestSessionService,
        VNPAY_ADAPTER,
        PaymentProviderSettingsService,
      ],
      useFactory: (
        database: DatabaseProvider,
        bookings: BookingDetailRepository,
        sessions: GuestSessionService,
        vnpay: VnpayAdapter,
        settings: PaymentProviderSettingsService,
      ) => new VnpayPaymentInitiationService(database, bookings, sessions, vnpay, settings),
    },
  ],
})
class MomoPaymentIntegrationModule {}

async function seedHeldBooking(
  pool: DatabasePool,
  input: { readonly amount: number; readonly contact: ReturnType<typeof normalizeContact> },
): Promise<{
  readonly bookingId: string;
  readonly bookingCode: string;
  readonly propertyId: string;
}> {
  const propertyId = randomUUID();
  const tierId = randomUUID();
  const roomTypeId = randomUUID();
  const roomId = randomUUID();
  const quoteId = randomUUID();
  const bookingId = randomUUID();
  const bookingCode = `MOMO-${randomUUID().slice(0, 8).toUpperCase()}`;
  await pool.query(
    `INSERT INTO properties (id, code, name, timezone, status)
     VALUES ($1, $2, 'MoMo Integration Property', 'Asia/Ho_Chi_Minh', 'ACTIVE')`,
    [propertyId, `MOMO_${propertyId.slice(0, 8)}`],
  );
  await pool.query(
    `INSERT INTO price_tiers (id, property_id, code, name, sort_order, status)
     VALUES ($1, $2, 'MOMO_TIER', 'MoMo Tier', 1, 'ACTIVE')`,
    [tierId, propertyId],
  );
  await pool.query(
    `INSERT INTO room_types (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy, status)
     VALUES ($1, $2, $3, 'MOMO_RT', 'MoMo Room Type', 2, 1, 3, 'ACTIVE')`,
    [roomTypeId, propertyId, tierId],
  );
  await pool.query(
    `INSERT INTO rooms (id, property_id, room_type_id, room_number, status)
     VALUES ($1, $2, $3, 'MOMO-101', 'ACTIVE')`,
    [roomId, propertyId, roomTypeId],
  );
  await pool.query(
    `INSERT INTO quotes (id, property_id, room_type_id, check_in, check_out, adults, children, currency,
                         base_amount_vnd, extra_amount_vnd, total_amount_vnd, pricing_snapshot, expires_at)
     VALUES ($1, $2, $3, '2027-01-10T04:00:00.000Z', '2027-01-10T07:00:00.000Z', 1, 0, 'VND',
             $4, 0, $4, $5::jsonb, CURRENT_TIMESTAMP + interval '15 minutes')`,
    [
      quoteId,
      propertyId,
      roomTypeId,
      input.amount,
      JSON.stringify({ pricing: { ruleVersion: 'phase-4-pricing-availability-v1' } }),
    ],
  );
  await pool.query(
    `INSERT INTO bookings (id, property_id, room_type_id, room_id, quote_id, booking_code, status,
                          check_in, check_out, adults, children, currency, gross_amount_vnd, discount_amount_vnd,
                          final_amount_vnd, pricing_rule_version, price_snapshot, hold_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'HOLD', '2027-01-10T04:00:00.000Z', '2027-01-10T07:00:00.000Z',
             1, 0, 'VND', $7, 0, $7, 'phase-4-pricing-availability-v1', $8::jsonb,
             CURRENT_TIMESTAMP + interval '15 minutes')`,
    [
      bookingId,
      propertyId,
      roomTypeId,
      roomId,
      quoteId,
      bookingCode,
      input.amount,
      JSON.stringify({ test: 'momo' }),
    ],
  );
  await pool.query(
    `INSERT INTO booking_contacts (booking_id, full_name, normalized_email, normalized_phone_e164, email_digest)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      bookingId,
      input.contact.fullName,
      input.contact.email,
      input.contact.phoneE164,
      input.contact.emailDigest,
    ],
  );
  await pool.query(
    `INSERT INTO room_inventory_blocks (property_id, room_id, booking_id, block_type, status, starts_at, ends_at)
     VALUES ($1, $2, $3, 'BOOKING', 'ACTIVE', '2027-01-10T04:00:00.000Z', '2027-01-10T07:00:00.000Z')`,
    [propertyId, roomId, bookingId],
  );
  return { bookingId, bookingCode, propertyId };
}

function jsonBody(responseBody: string): Record<string, unknown> {
  return JSON.parse(responseBody) as Record<string, unknown>;
}

function cookieFor(token: Buffer): string {
  return `rm_guest_session_v1=${token.toString('base64url')}`;
}

function signedIpn(providerOrderId: string, amount: number, resultCode = 0): Buffer {
  const payload = {
    orderType: 'momo_wallet' as const,
    amount,
    partnerCode: MOMO_PARTNER_CODE,
    orderId: providerOrderId,
    extraData: '',
    transId: `4${Date.now()}${(ipnSequence += 1)}`,
    responseTime: Date.now(),
    resultCode,
    message: resultCode === 0 ? 'Successful.' : 'Cancelled.',
    payType: 'qr' as const,
    requestId: providerOrderId,
    orderInfo: `Room booking ${providerOrderId}`,
  };
  const signature = signMomoCanonicalString(
    MOMO_SECRET,
    buildMomoIpnCanonicalString({ accessKey: MOMO_ACCESS_KEY, ...payload }),
  );
  return Buffer.from(JSON.stringify({ ...payload, signature }), 'utf8');
}

function signedVnpayIpn(
  providerOrderId: string,
  amount: number,
  transaction = '20260726001',
): string {
  const fields = {
    vnp_Amount: String(amount * 100),
    vnp_ResponseCode: '00',
    vnp_TmnCode: VNPAY_TMN_CODE,
    vnp_TransactionNo: transaction,
    vnp_TransactionStatus: '00',
    vnp_TxnRef: providerOrderId,
  };
  const canonical = buildVnpayCanonicalQuery(fields);
  return `${canonical}&vnp_SecureHash=${signVnpayCanonicalQuery(VNPAY_SECRET, canonical)}`;
}

describe('MoMo checkout and IPN HTTP boundary', () => {
  let database: GuardedTestDatabase;
  let application: NestFastifyApplication;
  let providerServer: Server;
  let providerBaseUrl: string;
  let providerMode: ProviderMode = 'SUCCESS';
  let receivedRequests: ProviderRequest[] = [];

  beforeAll(async () => {
    const baseUrl = process.env.TEST_DATABASE_URL;
    if (baseUrl === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(baseUrl, async (prepared) => {
      await migrateDatabase(prepared.databaseUrl);
    });
    databaseProvider = {
      pool: database.pool,
      client: createDatabaseClient(database.pool),
    } as unknown as DatabaseProvider;

    providerServer = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        if (providerMode === 'TIMEOUT') return;
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
        receivedRequests.push({ body });
        const orderId = String(body.orderId);
        const amount = Number(body.amount);
        const responseTime = Date.now();
        const payUrl = 'https://test-payment.momo.vn/v2/gateway/pay?t=integration';
        const signature = signMomoCanonicalString(
          MOMO_SECRET,
          `accessKey=${MOMO_ACCESS_KEY}&amount=${amount}&message=Successful.&orderId=${orderId}&partnerCode=${MOMO_PARTNER_CODE}&payUrl=${payUrl}&requestId=${String(body.requestId)}&responseTime=${responseTime}&resultCode=0`,
        );
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            partnerCode: MOMO_PARTNER_CODE,
            orderId,
            requestId: String(body.requestId),
            amount,
            responseTime,
            message: 'Successful.',
            resultCode: 0,
            payUrl,
            signature,
          }),
        );
      });
    });
    await new Promise<void>((resolve) => providerServer.listen(0, '127.0.0.1', resolve));
    const address = providerServer.address();
    if (address === null || typeof address === 'string')
      throw new Error('provider server has no TCP port');
    providerBaseUrl = `http://127.0.0.1:${address.port}`;
    const config: MomoConfig = {
      environment: 'sandbox',
      partnerCode: MOMO_PARTNER_CODE,
      accessKey: MOMO_ACCESS_KEY,
      secretKey: MOMO_SECRET,
      apiBaseUrl: providerBaseUrl,
      returnUrl: 'https://merchant.example.test/api/v1/payments/providers/momo/return',
      ipnUrl: 'https://merchant.example.test/api/v1/webhooks/momo',
      requestType: 'captureWallet',
      requestTimeoutMs: 50,
    };
    adapter = new MomoAdapter(config);
    vnpayAdapter = new VnpayAdapter({
      environment: 'sandbox',
      tmnCode: VNPAY_TMN_CODE,
      hashSecret: VNPAY_SECRET,
      apiBaseUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      returnUrl: 'https://merchant.example.test/api/v1/payments/providers/vnpay/return',
      ipnUrl: 'https://merchant.example.test/api/v1/webhooks/vnpay',
      requestTimeoutMs: 10_000,
    });
    application = await NestFactory.create<NestFastifyApplication>(
      MomoPaymentIntegrationModule,
      createApiHttpAdapter(),
      { logger: false, rawBody: true },
    );
    application.setGlobalPrefix('api');
    application.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    application.useGlobalFilters(new ProblemDetailsFilter());
    await application.register(cookie as never, {});
    await application.init();
  });

  afterAll(async () => {
    await application?.close();
    await new Promise<void>((resolve, reject) =>
      providerServer.close((error) => (error ? reject(error) : resolve())),
    );
    await database?.dispose();
  });

  async function createHeldBooking(amount = 359000): Promise<{
    readonly bookingId: string;
    readonly bookingCode: string;
    readonly propertyId: string;
    readonly token: Buffer;
  }> {
    const contact = normalizeContact(
      {
        fullName: 'MoMo Integration',
        email: `${randomUUID()}@example.test`,
        phone: '+84901234567',
      },
      Buffer.alloc(32, 44),
    );
    const held = await seedHeldBooking(database.pool, { amount, contact });
    const token = Buffer.from(randomUUID().replace(/-/g, ''), 'utf8');
    await database.pool.query(
      `INSERT INTO guest_sessions (booking_id, token_digest, expires_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP + interval '15 minutes')`,
      [held.bookingId, digestSessionToken(TEST_SECRETS.sessionSecret, token)],
    );
    return { ...held, token };
  }

  function injectInitiation(
    bookingCode: string,
    token: Buffer | undefined,
    idempotencyKey: string,
  ) {
    return application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: `/api/v1/public/bookings/${bookingCode}/payments/momo/attempts`,
        headers: {
          'idempotency-key': idempotencyKey,
          ...(token === undefined ? {} : { cookie: cookieFor(token) }),
        },
      });
  }

  it('uses the booking amount and guest session through the real checkout route, then settles a signed IPN', async () => {
    receivedRequests = [];
    providerMode = 'SUCCESS';
    const booking = await createHeldBooking();
    const initiation = await injectInitiation(
      booking.bookingCode,
      booking.token,
      'momo-http-success',
    );

    expect(initiation.statusCode).toBe(200);
    const safe = jsonBody(initiation.body);
    expect(Object.keys(safe)).toEqual([
      'paymentId',
      'paymentAttemptId',
      'provider',
      'status',
      'redirectUrl',
      'expiresAt',
    ]);
    expect(safe).toMatchObject({ provider: 'MOMO', status: 'PENDING' });
    expect(initiation.body).not.toContain(MOMO_SECRET);
    expect(initiation.body).not.toContain(MOMO_ACCESS_KEY);
    expect(receivedRequests).toHaveLength(1);
    const outbound = receivedRequests[0];
    if (outbound === undefined) throw new Error('expected MoMo transport request');
    expect(outbound.body).toMatchObject({
      amount: 359000,
      partnerCode: MOMO_PARTNER_CODE,
      redirectUrl: 'https://merchant.example.test/api/v1/payments/providers/momo/return',
      ipnUrl: 'https://merchant.example.test/api/v1/webhooks/momo',
      requestType: 'captureWallet',
    });
    expect(outbound.body.signature).toBeTypeOf('string');
    const attemptRow = await database.pool.query<{ provider_order_id: string }>(
      'SELECT provider_order_id FROM payment_attempts WHERE id = $1',
      [safe.paymentAttemptId],
    );
    const providerOrderId = attemptRow.rows[0]?.provider_order_id;
    if (providerOrderId === undefined) throw new Error('payment attempt was not created');
    expect(outbound.body.orderId).toBe(providerOrderId);

    const ipn = await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/v1/webhooks/momo',
        headers: { 'content-type': 'application/json' },
        payload: signedIpn(providerOrderId, 359000),
      });
    expect(ipn.statusCode).toBe(204);
    await expect(
      database.pool.query<{ booking: string; payment: string; attempt: string }>(
        `SELECT b.status AS booking, p.status AS payment, pa.status AS attempt
           FROM bookings b
           JOIN payments p ON p.booking_id = b.id
           JOIN payment_attempts pa ON pa.payment_id = p.id
          WHERE b.id = $1`,
        [booking.bookingId],
      ),
    ).resolves.toMatchObject({
      rows: [{ booking: 'CONFIRMED', payment: 'SUCCEEDED', attempt: 'SUCCEEDED' }],
    });
  });

  it('builds a VNPAY redirect from the authoritative amount and settles only the signed raw-query IPN', async () => {
    const booking = await createHeldBooking();
    const initiated = await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: `/api/v1/public/bookings/${booking.bookingCode}/payments/vnpay/attempts`,
        headers: { 'idempotency-key': 'vnpay-http-success', cookie: cookieFor(booking.token) },
      });
    expect(initiated.statusCode).toBe(200);
    const payload = jsonBody(initiated.body);
    expect(payload).toMatchObject({ provider: 'VNPAY', status: 'PENDING' });
    const redirect = new URL(String(payload.redirectUrl));
    expect(redirect.hostname).toBe('sandbox.vnpayment.vn');
    expect(redirect.searchParams.get('vnp_Amount')).toBe('35900000');
    const providerOrderId = redirect.searchParams.get('vnp_TxnRef');
    if (providerOrderId === null) throw new Error('VNPAY redirect has no provider order.');

    const ipn = await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: `/api/v1/webhooks/vnpay?${signedVnpayIpn(providerOrderId, 359000)}`,
      });
    expect(ipn.statusCode).toBe(200);
    expect(jsonBody(ipn.body)).toEqual({ RspCode: '00', Message: 'success' });
    await expect(
      database.pool.query<{ booking: string; payment: string; attempt: string }>(
        `SELECT b.status AS booking, p.status AS payment, pa.status AS attempt
           FROM bookings b
           JOIN payments p ON p.booking_id = b.id
           JOIN payment_attempts pa ON pa.payment_id = p.id
          WHERE pa.provider_order_id = $1`,
        [providerOrderId],
      ),
    ).resolves.toMatchObject({
      rows: [{ booking: 'CONFIRMED', payment: 'SUCCEEDED', attempt: 'SUCCEEDED' }],
    });

    const duplicate = await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: `/api/v1/webhooks/vnpay?${signedVnpayIpn(providerOrderId, 359000)}&vnp_Amount=1`,
      });
    expect(jsonBody(duplicate.body)).toEqual({ RspCode: '97', Message: 'Fail checksum' });
  });

  it('keeps one cross-provider settlement authoritative when MoMo succeeds before VNPAY', async () => {
    providerMode = 'SUCCESS';
    const booking = await createHeldBooking();
    const momo = await injectInitiation(booking.bookingCode, booking.token, 'cross-provider-momo');
    const vnpay = await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: `/api/v1/public/bookings/${booking.bookingCode}/payments/vnpay/attempts`,
        headers: { 'idempotency-key': 'cross-provider-vnpay', cookie: cookieFor(booking.token) },
      });
    expect([momo.statusCode, vnpay.statusCode]).toEqual([200, 200]);
    const momoAttemptId = jsonBody(momo.body).paymentAttemptId;
    const momoOrder = (
      await database.pool.query<{ provider_order_id: string }>(
        'SELECT provider_order_id FROM payment_attempts WHERE id = $1',
        [momoAttemptId],
      )
    ).rows[0]?.provider_order_id;
    const vnpayOrder = new URL(String(jsonBody(vnpay.body).redirectUrl)).searchParams.get(
      'vnp_TxnRef',
    );
    if (momoOrder === undefined || vnpayOrder === null) {
      throw new Error('Expected both cross-provider payment attempts.');
    }
    await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/v1/webhooks/momo',
        headers: { 'content-type': 'application/json' },
        payload: signedIpn(momoOrder, 359000),
      });
    const laterVnpay = await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: `/api/v1/webhooks/vnpay?${signedVnpayIpn(vnpayOrder, 359000, '20260726002')}`,
      });
    expect(jsonBody(laterVnpay.body)).toEqual({ RspCode: '00', Message: 'success' });
    await expect(
      database.pool.query<{ provider: string; status: string; review_code: string | null }>(
        `SELECT provider, status, review_code
           FROM payment_attempts
          WHERE provider_order_id IN ($1, $2)
          ORDER BY provider`,
        [momoOrder, vnpayOrder],
      ),
    ).resolves.toMatchObject({
      rows: [
        { provider: 'MOMO', status: 'SUCCEEDED', review_code: null },
        { provider: 'VNPAY', status: 'REVIEW_REQUIRED', review_code: 'PAYMENT_BOOKING_STATE' },
      ],
    });
  });

  it('denies missing or wrong booking sessions and never sends zero-amount holds to MoMo', async () => {
    receivedRequests = [];
    const booking = await createHeldBooking();
    const other = await createHeldBooking();
    await expect(
      injectInitiation(booking.bookingCode, undefined, 'momo-no-session'),
    ).resolves.toMatchObject({ statusCode: 401 });
    await expect(
      injectInitiation(booking.bookingCode, other.token, 'momo-wrong-session'),
    ).resolves.toMatchObject({ statusCode: 401 });
    const zero = await createHeldBooking(0);
    const zeroResponse = await injectInitiation(zero.bookingCode, zero.token, 'momo-zero');
    expect(zeroResponse.statusCode).toBe(409);
    expect(receivedRequests).toHaveLength(0);
  });

  it('reuses the idempotent provider order and handles duplicate or invalid IPN without double settlement', async () => {
    receivedRequests = [];
    providerMode = 'SUCCESS';
    const booking = await createHeldBooking();
    const [first, second] = await Promise.all([
      injectInitiation(booking.bookingCode, booking.token, 'momo-idempotent'),
      injectInitiation(booking.bookingCode, booking.token, 'momo-idempotent'),
    ]);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const firstSafe = jsonBody(first.body);
    const secondSafe = jsonBody(second.body);
    expect(secondSafe.paymentAttemptId).toBe(firstSafe.paymentAttemptId);
    const providerOrder = (
      await database.pool.query<{ provider_order_id: string }>(
        'SELECT provider_order_id FROM payment_attempts WHERE id = $1',
        [firstSafe.paymentAttemptId],
      )
    ).rows[0]?.provider_order_id;
    if (providerOrder === undefined) throw new Error('expected idempotent attempt');
    const raw = signedIpn(providerOrder, 359000);
    const [one, two] = await Promise.all([
      application
        .getHttpAdapter()
        .getInstance()
        .inject({
          method: 'POST',
          url: '/api/v1/webhooks/momo',
          headers: { 'content-type': 'application/json' },
          payload: raw,
        }),
      application
        .getHttpAdapter()
        .getInstance()
        .inject({
          method: 'POST',
          url: '/api/v1/webhooks/momo',
          headers: { 'content-type': 'application/json' },
          payload: raw,
        }),
    ]);
    expect([one.statusCode, two.statusCode]).toEqual([204, 204]);
    const invalid = await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/v1/webhooks/momo',
        headers: { 'content-type': 'application/json' },
        payload: Buffer.from(
          JSON.stringify({ ...jsonBody(raw.toString('utf8')), signature: '0'.repeat(64) }),
          'utf8',
        ),
      });
    expect(invalid.statusCode).toBe(204);
    const missingSignature = await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/v1/webhooks/momo',
        headers: { 'content-type': 'application/json' },
        payload: Buffer.from(
          JSON.stringify({ ...jsonBody(raw.toString('utf8')), signature: undefined }),
          'utf8',
        ),
      });
    const malformed = await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/v1/webhooks/momo',
        headers: { 'content-type': 'application/json' },
        payload: '{',
      });
    expect([missingSignature.statusCode, malformed.statusCode]).toEqual([204, 400]);
    await expect(
      database.pool.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM payment_provider_events WHERE provider_order_id = $1',
        [providerOrder],
      ),
    ).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });

  it('keeps signed amount mismatches and a second success in review without double confirmation', async () => {
    providerMode = 'SUCCESS';
    const mismatchBooking = await createHeldBooking();
    const mismatchInitiation = await injectInitiation(
      mismatchBooking.bookingCode,
      mismatchBooking.token,
      'momo-amount-mismatch',
    );
    const mismatchAttemptId = jsonBody(mismatchInitiation.body).paymentAttemptId;
    const mismatchOrder = (
      await database.pool.query<{ provider_order_id: string }>(
        'SELECT provider_order_id FROM payment_attempts WHERE id = $1',
        [mismatchAttemptId],
      )
    ).rows[0]?.provider_order_id;
    if (mismatchOrder === undefined) throw new Error('expected mismatch attempt');
    const mismatched = await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/v1/webhooks/momo',
        headers: { 'content-type': 'application/json' },
        payload: signedIpn(mismatchOrder, 1_000),
      });
    expect(mismatched.statusCode).toBe(204);
    await expect(
      database.pool.query<{ status: string; review_code: string }>(
        'SELECT status, review_code FROM payment_attempts WHERE provider_order_id = $1',
        [mismatchOrder],
      ),
    ).resolves.toMatchObject({
      rows: [{ status: 'REVIEW_REQUIRED', review_code: 'AMOUNT_MISMATCH' }],
    });

    const booking = await createHeldBooking();
    const first = await injectInitiation(booking.bookingCode, booking.token, 'momo-first-success');
    const second = await injectInitiation(
      booking.bookingCode,
      booking.token,
      'momo-second-success',
    );
    const [firstOrder, secondOrder] = await Promise.all(
      [jsonBody(first.body).paymentAttemptId, jsonBody(second.body).paymentAttemptId].map(
        async (attemptId) =>
          (
            await database.pool.query<{ provider_order_id: string }>(
              'SELECT provider_order_id FROM payment_attempts WHERE id = $1',
              [attemptId],
            )
          ).rows[0]?.provider_order_id,
      ),
    );
    if (firstOrder === undefined || secondOrder === undefined)
      throw new Error('expected two MoMo attempts');
    await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/v1/webhooks/momo',
        headers: { 'content-type': 'application/json' },
        payload: signedIpn(firstOrder, 359000),
      });
    const secondSuccess = await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/v1/webhooks/momo',
        headers: { 'content-type': 'application/json' },
        payload: signedIpn(secondOrder, 359000),
      });
    expect(secondSuccess.statusCode).toBe(204);
    await expect(
      database.pool.query<{ status: string; review_code: string }>(
        'SELECT status, review_code FROM payment_attempts WHERE provider_order_id = $1',
        [secondOrder],
      ),
    ).resolves.toMatchObject({
      rows: [{ status: 'REVIEW_REQUIRED', review_code: 'PAYMENT_BOOKING_STATE' }],
    });
  });

  it('keeps a late signed success in review and ignores an unknown provider order', async () => {
    providerMode = 'SUCCESS';
    const booking = await createHeldBooking();
    const initiation = await injectInitiation(
      booking.bookingCode,
      booking.token,
      'momo-late-success',
    );
    const attemptId = jsonBody(initiation.body).paymentAttemptId;
    const providerOrder = (
      await database.pool.query<{ provider_order_id: string }>(
        'SELECT provider_order_id FROM payment_attempts WHERE id = $1',
        [attemptId],
      )
    ).rows[0]?.provider_order_id;
    if (providerOrder === undefined) throw new Error('expected late-success attempt');
    await database.pool.query(
      `UPDATE bookings SET status = 'EXPIRED', expired_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [booking.bookingId],
    );
    await database.pool.query(
      `UPDATE room_inventory_blocks SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP WHERE booking_id = $1`,
      [booking.bookingId],
    );
    const late = await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/v1/webhooks/momo',
        headers: { 'content-type': 'application/json' },
        payload: signedIpn(providerOrder, 359000),
      });
    const unknown = await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/v1/webhooks/momo',
        headers: { 'content-type': 'application/json' },
        payload: signedIpn(`MOMO-${randomUUID()}`, 359000),
      });
    expect([late.statusCode, unknown.statusCode]).toEqual([204, 204]);
    await expect(
      database.pool.query<{ status: string; review_code: string }>(
        'SELECT status, review_code FROM payment_attempts WHERE provider_order_id = $1',
        [providerOrder],
      ),
    ).resolves.toMatchObject({
      rows: [{ status: 'REVIEW_REQUIRED', review_code: 'BOOKING_EXPIRED' }],
    });
  });

  it('retains a timeout order for later IPN and treats the return route as non-authoritative', async () => {
    receivedRequests = [];
    providerMode = 'TIMEOUT';
    const booking = await createHeldBooking();
    const response = await injectInitiation(booking.bookingCode, booking.token, 'momo-timeout');
    expect(response.statusCode).toBe(503);
    const attempt = await database.pool.query<{
      provider_order_id: string;
      status: string;
      review_code: string;
    }>(
      `SELECT provider_order_id, status, review_code FROM payment_attempts
        WHERE payment_id = (SELECT id FROM payments WHERE booking_id = $1)`,
      [booking.bookingId],
    );
    expect(attempt.rows[0]).toMatchObject({
      status: 'REVIEW_REQUIRED',
      review_code: 'MOMO_INITIATION_OUTCOME_UNKNOWN',
    });
    const providerOrder = attempt.rows[0]?.provider_order_id;
    if (providerOrder === undefined) throw new Error('timeout order was not retained');
    providerMode = 'SUCCESS';
    const settled = await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'POST',
        url: '/api/v1/webhooks/momo',
        headers: { 'content-type': 'application/json' },
        payload: signedIpn(providerOrder, 359000),
      });
    expect(settled.statusCode).toBe(204);
    const returned = await application
      .getHttpAdapter()
      .getInstance()
      .inject({
        method: 'GET',
        url: `/api/v1/payments/providers/momo/return?resultCode=0&orderId=${providerOrder}&amount=1`,
      });
    expect(returned.statusCode).toBe(204);
    await expect(
      database.pool.query<{ status: string }>('SELECT status FROM bookings WHERE id = $1', [
        booking.bookingId,
      ]),
    ).resolves.toMatchObject({ rows: [{ status: 'CONFIRMED' }] });
  });
});
