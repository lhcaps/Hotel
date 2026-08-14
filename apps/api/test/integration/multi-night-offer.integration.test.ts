import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ArrivalAccessCrypto,
  applyVerifiedPaymentEvent,
  createBookingHoldWithRetry,
  createPaymentAttempt,
  deriveArrivalAccessEncryptionKey,
  normalizeContact,
} from '@room/booking';
import {
  createDatabaseClient,
  createDatabasePool,
  migrateDatabase,
  type DatabaseClient,
  type DatabasePool,
} from '@room/database';
import {
  createPreparedGuardedTestDatabase,
  type GuardedTestDatabase,
} from '@room/database/testing';

import { AvailabilityRepository } from '../../src/pricing/availability.repository.js';
import { AvailabilityService } from '../../src/pricing/availability.service.js';
import { MultiNightOfferService } from '../../src/pricing/multi-night-offer.service.js';
import { QuoteRepository } from '../../src/pricing/quote.repository.js';
import { QuoteService } from '../../src/pricing/quote.service.js';
import {
  MultiNightPricingGate,
  MultiNightPublicGate,
} from '../../src/pricing-policy/multi-night.gate.js';
import { PricingPolicyEventWriter } from '../../src/pricing-policy/pricing-policy.events.js';
import { OperationsV3PricingCatalogGate } from '../../src/pricing-policy/pricing-policy.gate.js';
import { PublishedPricingPolicyLookupService } from '../../src/pricing-policy/pricing-policy.lookup.service.js';
import { PricingPolicyRepository } from '../../src/pricing-policy/pricing-policy.repository.js';
import { PricingPolicyService } from '../../src/pricing-policy/pricing-policy.service.js';
import { AdminBookingRepository } from '../../src/booking/repositories/admin-booking.repository.js';
import { BookingDetailRepository } from '../../src/booking/repositories/booking-detail.repository.js';
import {
  GuestSessionRepository,
  digestSessionToken,
} from '../../src/booking/repositories/guest-session.repository.js';
import { AdminBookingLifecycleService } from '../../src/booking/services/admin-booking-lifecycle.service.js';
import { BookingAccessPassService } from '../../src/booking/services/booking-access-pass.service.js';
import { BookingDetailService } from '../../src/booking/services/booking-detail.service.js';
import { ArrivalAccessConfigService } from '../../src/booking/services/arrival-access-config.service.js';
import { GuestSessionService } from '../../src/booking/services/guest-session.service.js';
import type { ActorContext } from '../../src/auth/actor-context.js';

const ids = {
  property: '00000000-0000-4000-8000-000000008101',
  otherProperty: '00000000-0000-4000-8000-000000008102',
  tier: '00000000-0000-4000-8000-000000008201',
  otherTier: '00000000-0000-4000-8000-000000008202',
  roomType: '00000000-0000-4000-8000-000000008301',
  otherRoomType: '00000000-0000-4000-8000-000000008302',
  roomA: '00000000-0000-4000-8000-000000008401',
  roomB: '00000000-0000-4000-8000-000000008402',
  otherRoom: '00000000-0000-4000-8000-000000008403',
  nightPlan: '00000000-0000-4000-8000-000000008501',
  extraPlan: '00000000-0000-4000-8000-000000008502',
  threeHourPlan: '00000000-0000-4000-8000-000000008505',
  fiveHourPlan: '00000000-0000-4000-8000-000000008506',
  otherNightPlan: '00000000-0000-4000-8000-000000008503',
  otherExtraPlan: '00000000-0000-4000-8000-000000008504',
  nightPrice: '00000000-0000-4000-8000-000000008601',
  extraPrice: '00000000-0000-4000-8000-000000008602',
  threeHourPrice: '00000000-0000-4000-8000-000000008605',
  fiveHourPrice: '00000000-0000-4000-8000-000000008606',
  otherNightPrice: '00000000-0000-4000-8000-000000008603',
  otherExtraPrice: '00000000-0000-4000-8000-000000008604',
  admin: '00000000-0000-4000-8000-000000008901',
  maintenanceA: '00000000-0000-4000-8000-000000008701',
  maintenanceB: '00000000-0000-4000-8000-000000008702',
  maintenanceStitchA: '00000000-0000-4000-8000-000000008703',
  maintenanceStitchB: '00000000-0000-4000-8000-000000008704',
  maintenanceTouch: '00000000-0000-4000-8000-000000008705',
};

const digestSecret = Buffer.from('multi-night-test-digest-secret-32-chars', 'utf8');
const sessionSecret = Buffer.from('multi-night-test-session-secret-32-chars', 'utf8');

const adminActor: ActorContext = {
  userId: ids.admin,
  email: 'b0-runtime-admin@example.test',
  displayName: 'B0 Runtime Admin',
  role: 'ADMIN',
  permissions: ['booking.lifecycle.read', 'booking.lifecycle.manage'],
  propertyIds: [ids.property],
  sessionId: ids.admin,
  sessionExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
  requestId: 'b0-runtime-lifecycle-request',
};

type MultiNightInput = {
  readonly mode: 'multi_night';
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adults: number;
  readonly children: number;
};

function stay(startDay: number, nightCount: number): MultiNightInput {
  const start = String(startDay).padStart(2, '0');
  const end = String(startDay + nightCount).padStart(2, '0');
  return {
    mode: 'multi_night',
    checkIn: `2027-03-${start}T21:00:00+07:00`,
    checkOut: `2027-03-${end}T09:00:00+07:00`,
    adults: 2,
    children: 0,
  };
}

describe('B0 multi-night offer, quote, and HOLD runtime', () => {
  let database: GuardedTestDatabase;
  let availability: AvailabilityService;
  let quotes: QuoteService;
  let policyService: PricingPolicyService;
  let arrivalAccess: ArrivalAccessConfigService;

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (url === undefined) throw new Error('TEST_DATABASE_URL is required');
    database = await createPreparedGuardedTestDatabase(url, async (prepared) =>
      migrateDatabase(prepared.databaseUrl),
    );
    const client: DatabaseClient = createDatabaseClient(database.pool);
    const policyRepository = new PricingPolicyRepository(client);
    policyService = new PricingPolicyService(
      client as unknown as {
        transaction<T>(operation: (transaction: unknown) => Promise<T>): Promise<T>;
      },
      policyRepository,
      new PricingPolicyEventWriter(),
    );

    await database.pool.query(
      `INSERT INTO properties
        (id, code, name, timezone, minimum_stay_minutes, maximum_stay_minutes,
         minimum_lead_time_minutes, maximum_advance_booking_days, default_overnight_duration_minutes)
       VALUES ($1, 'B0_RUNTIME', 'B0 Runtime Property', 'Asia/Ho_Chi_Minh', 60, 44640, 0, 2000, 720)`,
      [ids.property],
    );
    await database.pool.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order)
       VALUES ($1, $2, 'B0_STANDARD', 'B0 standard', 1)`,
      [ids.tier, ids.property],
    );
    await database.pool.query(
      `INSERT INTO room_types
        (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
       VALUES ($1, $2, $3, 'B0_DELUXE', 'B0 Deluxe', 2, 1, 3)`,
      [ids.roomType, ids.property, ids.tier],
    );
    await database.pool.query(
      `INSERT INTO rooms (id, property_id, room_type_id, room_number)
       VALUES ($1, $2, $3, 'B0-101'), ($4, $2, $3, 'B0-102')`,
      [ids.roomA, ids.property, ids.roomType, ids.roomB],
    );
    const arrivalCrypto = new ArrivalAccessCrypto(deriveArrivalAccessEncryptionKey(sessionSecret));
    await database.pool.query(
      `INSERT INTO property_arrival_access_configs
         (property_id, gate_pass_encrypted, wifi_ssid, wifi_password_encrypted, support_contact,
          default_arrival_instruction, preparation_note)
       VALUES ($1, $2, 'B0 Guest Wi-Fi', $3, '0900 000 000', 'Follow check-in signs.',
               'Bring a valid ID.')`,
      [
        ids.property,
        arrivalCrypto.encrypt('B0-GATE-PASS', {
          scope: 'property',
          id: ids.property,
          field: 'gatePass',
        }),
        arrivalCrypto.encrypt('b0-wifi-password', {
          scope: 'property',
          id: ids.property,
          field: 'wifiPassword',
        }),
      ],
    );
    await database.pool.query(
      `INSERT INTO room_arrival_access_configs
         (room_id, property_id, room_pass_encrypted, room_location, arrival_instruction)
       VALUES ($1, $3, $2, 'Floor 1', 'Use the east elevator.'),
              ($4, $3, $5, 'Floor 1', 'Use the east elevator.')`,
      [
        ids.roomA,
        arrivalCrypto.encrypt('B0-ROOM-A', {
          scope: 'room',
          id: ids.roomA,
          field: 'roomPass',
        }),
        ids.property,
        ids.roomB,
        arrivalCrypto.encrypt('B0-ROOM-B', {
          scope: 'room',
          id: ids.roomB,
          field: 'roomPass',
        }),
      ],
    );
    arrivalAccess = new ArrivalAccessConfigService(client, undefined as never, arrivalCrypto);
    await database.pool.query(
      `INSERT INTO rate_plans
       (id, property_id, code, name, status, included_duration_minutes, priority, is_base_plan,
         min_duration_minutes_inclusive, max_duration_minutes_inclusive)
       VALUES
        ($1, $3, 'NIGHT_COMBO', 'Night combo', 'ACTIVE', 720, 1, true, 60, 1440),
        ($2, $3, 'EXTRA_HOUR', 'Extra hour', 'ACTIVE', 60, 2, false, NULL, NULL),
        ($4, $3, 'THREE_HOUR_COMBO', 'Three-hour combo', 'ACTIVE', 180, 3, true, 60, 240),
        ($5, $3, 'FIVE_HOUR_COMBO', 'Five-hour combo', 'ACTIVE', 300, 4, true, 60, 360)`,
      [ids.nightPlan, ids.extraPlan, ids.property, ids.threeHourPlan, ids.fiveHourPlan],
    );
    await database.pool.query(
      `INSERT INTO rate_plan_prices (id, property_id, rate_plan_id, price_tier_id, amount_vnd)
       VALUES
         ($1, $4, $2, $3, 600000),
         ($5, $4, $6, $3, 100000),
         ($7, $4, $8, $3, 300000),
         ($9, $4, $10, $3, 450000)`,
      [
        ids.nightPrice,
        ids.nightPlan,
        ids.tier,
        ids.property,
        ids.extraPrice,
        ids.extraPlan,
        ids.threeHourPrice,
        ids.threeHourPlan,
        ids.fiveHourPrice,
        ids.fiveHourPlan,
      ],
    );
    await database.pool.query(
      `INSERT INTO users (id, email, name, role)
       VALUES ($1, 'b0-runtime-admin@example.test', 'B0 Runtime Admin', 'ADMIN')`,
      [ids.admin],
    );
    await database.pool.query(
      `INSERT INTO payment_provider_settings
       (property_id, provider, enabled, display_name, display_order)
       VALUES ($1, 'MOMO', true, 'MoMo', 10)
       ON CONFLICT (property_id, provider) DO UPDATE
         SET enabled = EXCLUDED.enabled, display_name = EXCLUDED.display_name`,
      [ids.property],
    );

    const actor = {
      userId: ids.admin,
      requestId: 'b0-runtime-bootstrap-request',
      correlationId: 'b0-runtime-bootstrap-correlation',
      propertyIds: [ids.property] as readonly string[] | 'ALL',
    };
    const bootstrapped = await policyService.bootstrapDraft(actor, {
      internalName: 'B0 runtime bootstrap',
      effectiveFrom: new Date('2027-01-01T00:00:00.000Z'),
      overnightWindow: '21-09',
      nightPlanCode: 'NIGHT_COMBO',
      extraHourPlanCode: 'EXTRA_HOUR',
      idempotencyKey: 'b0-runtime-bootstrap-001',
      dryRun: false,
    });
    expect(bootstrapped.publicationReady).toBe(true);
    await expect(policyService.publishInitial(actor, bootstrapped.policyId)).resolves.toMatchObject(
      {
        status: 'PUBLISHED',
      },
    );

    const lookup = new PublishedPricingPolicyLookupService(
      new OperationsV3PricingCatalogGate(true),
      policyRepository,
    );
    const offers = new MultiNightOfferService({
      database: client,
      lookup,
      pricingGate: new MultiNightPricingGate(true),
      publicGate: new MultiNightPublicGate(true),
    });
    availability = new AvailabilityService(new AvailabilityRepository(client), offers);
    quotes = new QuoteService(new QuoteRepository(client), { multiNight: offers });
  }, 120_000);

  afterAll(async () => {
    await database?.dispose();
  }, 30_000);

  it.each([1, 2, 3])('prices exactly %s night(s) without stitching rooms', async (nightCount) => {
    const input = stay(10, nightCount);
    const result = await availability.search(input);
    const item = result.items[0];

    expect(result).toMatchObject({
      state: 'AVAILABLE',
      requestedInterval: { checkIn: input.checkIn, checkOut: input.checkOut },
    });
    expect(item?.roomTypeId).toBe(ids.roomType);
    expect(item?.availableRoomCount).toBe(2);
    expect(item?.offer?.nightCount).toBe(nightCount);
    expect(JSON.stringify(result)).not.toMatch(/roomNumber|roomId|room_id|B0-101|B0-102/);

    const quote = await quotes.issue({ ...input, roomTypeId: ids.roomType });
    expect(quote.mode).toBe('multi_night');
    if (!('displayNightCount' in quote.pricing)) {
      throw new Error('expected a multi-night pricing snapshot');
    }
    const multiNightPricing = quote.pricing;
    expect(multiNightPricing.displayNightCount).toBe(nightCount);
    expect(multiNightPricing.finalAmountVnd).toBe(nightCount * 600000);
  });

  it('resolves an exact multi-night interval without a client pricing mode', async () => {
    const { mode: _legacyMode, ...input } = stay(12, 2);
    void _legacyMode;
    const result = await availability.search(input);
    expect(result).toMatchObject({
      state: 'AVAILABLE',
      requestedInterval: { checkIn: input.checkIn, checkOut: input.checkOut },
    });

    const quote = await quotes.issue({ ...input, roomTypeId: ids.roomType });
    if (!('displayNightCount' in quote.pricing)) {
      throw new Error('expected a policy-composed pricing snapshot');
    }
    expect(quote.pricing.displayNightCount).toBe(2);
    expect(quote.pricing.requestedInterval).toEqual({
      checkInAt: new Date(input.checkIn).toISOString(),
      checkOutAt: new Date(input.checkOut).toISOString(),
    });
  });

  it.each([
    ['same-day 3h', '2027-03-10T14:15:00+07:00', '2027-03-10T17:15:00+07:00', 300000],
    [
      'same-day 5h arbitrary extension',
      '2027-03-10T14:15:00+07:00',
      '2027-03-10T19:45:00+07:00',
      550000,
    ],
  ])(
    'prices %s through the mode-free catalog producer',
    async (_label, checkIn, checkOut, total) => {
      const input = { checkIn, checkOut, adults: 2, children: 0 };
      const result = await availability.search(input);
      expect(result.state).toBe('AVAILABLE');
      expect(result.items[0]?.offer?.amountVnd).toBe(total);

      const quote = await quotes.issue({ ...input, roomTypeId: ids.roomType });
      expect(quote.mode).toBeUndefined();
      expect('displayNightCount' in quote.pricing).toBe(false);
      expect(quote.pricing.totalAmountVnd).toBe(total);
    },
  );

  it.each([
    ['overnight 21-09', '2027-03-10T21:00:00+07:00', '2027-03-11T09:00:00+07:00', 600000],
    ['overnight 22-10', '2027-03-10T22:00:00+07:00', '2027-03-11T10:00:00+07:00', 600000],
    ['25h on the hour', '2027-03-10T09:00:00+07:00', '2027-03-11T10:00:00+07:00', 1900000],
    ['25h arbitrary minutes', '2027-03-10T09:06:00+07:00', '2027-03-11T10:06:00+07:00', 2000000],
    [
      'one-night arbitrary boundary',
      '2027-03-10T14:15:00+07:00',
      '2027-03-11T11:00:00+07:00',
      1500000,
    ],
    [
      'two-night arbitrary boundary',
      '2027-03-10T14:15:00+07:00',
      '2027-03-12T11:00:00+07:00',
      2100000,
    ],
    [
      'three-night arbitrary boundary',
      '2027-03-10T14:15:00+07:00',
      '2027-03-13T11:00:00+07:00',
      2700000,
    ],
    ['long trailing boundary', '2027-03-10T18:00:00+07:00', '2027-03-12T09:00:00+07:00', 1500000],
    ['cross-month boundary', '2027-03-31T14:15:00+07:00', '2027-04-02T11:00:00+07:00', 2100000],
    ['cross-year boundary', '2027-12-31T14:15:00+07:00', '2028-01-02T11:00:00+07:00', 2100000],
    ['leap-day boundary', '2028-02-28T14:15:00+07:00', '2028-03-01T11:00:00+07:00', 2100000],
  ])(
    'prices %s through the mode-free policy producer',
    async (_label, checkIn, checkOut, total) => {
      const input = { checkIn, checkOut, adults: 2, children: 0 };
      const result = await availability.search(input);
      expect(result).toMatchObject({
        state: 'AVAILABLE',
        requestedInterval: { checkIn, checkOut },
      });
      expect(result.items[0]?.offer?.amountVnd).toBe(total);

      const quote = await quotes.issue({ ...input, roomTypeId: ids.roomType });
      expect(quote.mode).toBeUndefined();
      expect(quote.pricing.totalAmountVnd).toBe(total);
      if ('displayNightCount' in quote.pricing) {
        expect(quote.pricing.finalAmountVnd).toBe(total);
      }
      if ('requestedInterval' in quote.pricing && 'lines' in quote.pricing) {
        expect(quote.pricing.requestedInterval).toEqual({
          checkInAt: new Date(checkIn).toISOString(),
          checkOutAt: new Date(checkOut).toISOString(),
        });
        expect(quote.pricing.lines[0]?.startAt).toBe(new Date(checkIn).toISOString());
        expect(quote.pricing.lines.at(-1)?.endAt).toBe(new Date(checkOut).toISOString());
      }
    },
  );

  it('enforces the configured minimum stay for a mode-free request', async () => {
    const input = {
      checkIn: '2027-03-10T14:15:00+07:00',
      checkOut: '2027-03-10T14:45:00+07:00',
      adults: 2,
      children: 0,
    };
    const result = await availability.search(input);
    expect(result).toMatchObject({ state: 'BELOW_MINIMUM_STAY', items: [] });
  });

  it('enforces the configured maximum stay for a mode-free request', async () => {
    await database.pool.query(`UPDATE properties SET maximum_stay_minutes = 1440 WHERE id = $1`, [
      ids.property,
    ]);
    try {
      const input = {
        checkIn: '2027-03-10T09:00:00+07:00',
        checkOut: '2027-03-11T10:00:00+07:00',
        adults: 2,
        children: 0,
      };
      const result = await availability.search(input);
      expect(result).toMatchObject({ state: 'ABOVE_MAXIMUM_STAY', items: [] });
    } finally {
      await database.pool.query(
        `UPDATE properties SET maximum_stay_minutes = 44640 WHERE id = $1`,
        [ids.property],
      );
    }
  });

  it('rejects a mode-free request that exceeds room capacity', async () => {
    const result = await availability.search({
      checkIn: '2027-03-10T14:15:00+07:00',
      checkOut: '2027-03-10T17:15:00+07:00',
      adults: 3,
      children: 1,
    });
    expect(result).toMatchObject({ state: 'NO_EXACT_AVAILABILITY', items: [] });
  });

  it.each([
    ['leading extra', '2027-03-10T19:00:00+07:00', '2027-03-11T09:00:00+07:00', 1, 2],
    ['trailing extra', '2027-03-10T21:00:00+07:00', '2027-03-11T11:00:00+07:00', 1, 2],
    ['cross month', '2027-03-31T21:00:00+07:00', '2027-04-02T09:00:00+07:00', 2, 0],
    ['cross year', '2027-12-31T21:00:00+07:00', '2028-01-02T09:00:00+07:00', 2, 0],
    ['leap day', '2028-02-28T21:00:00+07:00', '2028-03-01T09:00:00+07:00', 2, 0],
  ])(
    'covers the %s interval exactly without a daily booking split',
    async (_label, checkIn, checkOut, nightCount, extraUnits) => {
      const input: MultiNightInput = {
        mode: 'multi_night',
        checkIn,
        checkOut,
        adults: 2,
        children: 0,
      };
      const result = await availability.search(input);
      expect(result.state).toBe('AVAILABLE');
      expect(result.items[0]?.offer?.nightCount).toBe(nightCount);

      const quote = await quotes.issue({ ...input, roomTypeId: ids.roomType });
      if (!('displayNightCount' in quote.pricing)) {
        throw new Error('expected a multi-night pricing snapshot');
      }
      expect(quote.pricing.displayNightCount).toBe(nightCount);
      expect(quote.pricing.finalAmountVnd).toBe(nightCount * 600000 + extraUnits * 100000);
      expect(quote.pricing.requestedInterval).toEqual({
        checkInAt: new Date(checkIn).toISOString(),
        checkOutAt: new Date(checkOut).toISOString(),
      });
      expect(quote.pricing.lines[0]?.startAt).toBe(new Date(checkIn).toISOString());
      expect(quote.pricing.lines.at(-1)?.endAt).toBe(new Date(checkOut).toISOString());
    },
  );

  it('returns no continuous room when maintenance covers every physical room', async () => {
    const input = stay(15, 2);
    await database.pool.query(
      `INSERT INTO maintenance_blocks (id, property_id, room_id, starts_at, ends_at, reason)
       VALUES ($1, $3, $4, $5, $6, 'B0 maintenance A'),
              ($2, $3, $7, $5, $6, 'B0 maintenance B')`,
      [
        ids.maintenanceA,
        ids.maintenanceB,
        ids.property,
        ids.roomA,
        input.checkIn,
        input.checkOut,
        ids.roomB,
      ],
    );
    const result = await availability.search(input);
    expect(result).toMatchObject({ state: 'NO_CONTINUOUS_ROOM', items: [] });
    await expect(quotes.issue({ ...input, roomTypeId: ids.roomType })).rejects.toMatchObject({
      code: 'NO_CONTINUOUS_ROOM',
    });
  });

  it('rejects stitching rooms across different portions of one interval', async () => {
    const input = stay(25, 2);
    await database.pool.query(
      `INSERT INTO maintenance_blocks (id, property_id, room_id, starts_at, ends_at, reason)
       VALUES ($1, $3, $4, $5, $6, 'B0 first-room conflict'),
              ($2, $3, $7, $6, $8, 'B0 second-room conflict')`,
      [
        ids.maintenanceStitchA,
        ids.maintenanceStitchB,
        ids.property,
        ids.roomA,
        input.checkIn,
        input.checkOut.replace('2027-03-27', '2027-03-26'),
        ids.roomB,
        input.checkOut,
      ],
    );
    const result = await availability.search(input);
    expect(result).toMatchObject({ state: 'NO_CONTINUOUS_ROOM', items: [] });
  });

  it('allows a touching interval boundary and excludes inactive rooms', async () => {
    const touching = stay(10, 1);
    await database.pool.query(
      `INSERT INTO maintenance_blocks (id, property_id, room_id, starts_at, ends_at, reason)
       VALUES ($1, $2, $3, $4, $5, 'B0 touching boundary')`,
      [
        ids.maintenanceTouch,
        ids.property,
        ids.roomA,
        '2027-03-09T21:00:00+07:00',
        touching.checkIn,
      ],
    );
    const touchingResult = await availability.search(touching);
    expect(touchingResult).toMatchObject({ state: 'AVAILABLE' });
    expect(touchingResult.items[0]?.availableRoomCount).toBe(2);

    await database.pool.query(`UPDATE rooms SET status = 'INACTIVE' WHERE id = $1`, [ids.roomB]);
    try {
      const inactiveResult = await availability.search(stay(30, 1));
      expect(inactiveResult).toMatchObject({ state: 'AVAILABLE' });
      expect(inactiveResult.items[0]?.availableRoomCount).toBe(1);
    } finally {
      await database.pool.query(`UPDATE rooms SET status = 'ACTIVE' WHERE id = $1`, [ids.roomB]);
    }
  });

  it('allows exactly one concurrent HOLD for the last room across the full interval', async () => {
    const input = stay(1, 2);
    await database.pool.query(`UPDATE rooms SET status = 'INACTIVE' WHERE id = $1`, [ids.roomA]);
    try {
      const [firstQuote, secondQuote] = await Promise.all([
        quotes.issue({ ...input, roomTypeId: ids.roomType }),
        quotes.issue({ ...input, roomTypeId: ids.roomType }),
      ]);
      const results = await Promise.allSettled([
        createBookingHoldWithRetry(database.pool, {
          quoteId: firstQuote.id,
          contact: normalizeContact(
            {
              fullName: 'B0 Concurrent Guest A',
              email: 'b0-concurrent-a@example.test',
              phone: '0909000002',
            },
            digestSecret,
          ),
          holdDurationMs: 5 * 60 * 1000,
          correlationId: 'b0-concurrent-hold-a',
        }),
        createBookingHoldWithRetry(database.pool, {
          quoteId: secondQuote.id,
          contact: normalizeContact(
            {
              fullName: 'B0 Concurrent Guest B',
              email: 'b0-concurrent-b@example.test',
              phone: '0909000003',
            },
            digestSecret,
          ),
          holdDurationMs: 5 * 60 * 1000,
          correlationId: 'b0-concurrent-hold-b',
        }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const state = await database.pool.query<{ booking_count: number; block_count: number }>(
        `SELECT
           (SELECT count(*)::int FROM bookings
             WHERE check_in = $1 AND check_out = $2 AND status = 'HOLD') AS booking_count,
           (SELECT count(*)::int FROM room_inventory_blocks rib
             JOIN bookings b ON b.id = rib.booking_id
            WHERE b.check_in = $1 AND b.check_out = $2 AND rib.status = 'ACTIVE') AS block_count`,
        [new Date(input.checkIn), new Date(input.checkOut)],
      );
      expect(state.rows[0]).toEqual({ booking_count: 1, block_count: 1 });
    } finally {
      await database.pool.query(`UPDATE rooms SET status = 'ACTIVE' WHERE id = $1`, [ids.roomA]);
    }
  });

  it('creates one immutable HOLD for one room across the complete multi-night interval', async () => {
    const { mode: _legacyMode, ...input } = stay(20, 3);
    void _legacyMode;
    const quote = await quotes.issue({ ...input, roomTypeId: ids.roomType });
    if (!('displayNightCount' in quote.pricing)) {
      throw new Error('expected a multi-night pricing snapshot');
    }
    const hold = await createBookingHoldWithRetry(database.pool, {
      quoteId: quote.id,
      contact: normalizeContact(
        {
          fullName: 'B0 Runtime Guest',
          email: 'b0-runtime-guest@example.test',
          phone: '0909000000',
        },
        digestSecret,
      ),
      holdDurationMs: 5 * 60 * 1000,
      correlationId: 'b0-runtime-hold-correlation',
    });

    expect(hold.amountVnd).toBe(quote.pricing.finalAmountVnd);
    const booking = await database.pool.query<{
      room_id: string;
      mode: string | null;
      check_in: Date;
      check_out: Date;
    }>(
      `SELECT room_id, price_snapshot->>'mode' AS mode, check_in, check_out
       FROM bookings WHERE id = $1`,
      [hold.bookingId],
    );
    expect(booking.rows[0]?.mode).toBeNull();
    expect([ids.roomA, ids.roomB]).toContain(booking.rows[0]?.room_id);
    expect(booking.rows[0]?.check_in).toEqual(new Date(input.checkIn));
    expect(booking.rows[0]?.check_out).toEqual(new Date(input.checkOut));
    const blocks = await database.pool.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM room_inventory_blocks WHERE booking_id = $1 AND status = 'ACTIVE'`,
      [hold.bookingId],
    );
    expect(blocks.rows[0]?.count).toBe(1);
    const assignedRoomId = booking.rows[0]?.room_id;
    if (assignedRoomId === undefined) throw new Error('HOLD did not allocate a room');

    const attempt = await createPaymentAttempt({
      pool: database.pool,
      propertyId: ids.property,
      bookingId: hold.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'b0-runtime-payment-001',
    });
    expect(attempt.amountVnd).toBe(BigInt(quote.pricing.finalAmountVnd));
    const paymentEvent = {
      pool: database.pool,
      provider: 'MOMO' as const,
      eventKey: 'b0-runtime-payment-event-001',
      providerOrderId: attempt.providerOrderId,
      providerTransactionId: 'b0-runtime-transaction-001',
      normalizedOutcome: 'SUCCEEDED' as const,
      amountVnd: attempt.amountVnd,
      currency: 'VND' as const,
      occurredAt: new Date(),
      rawBodyDigest: Buffer.alloc(32, 7),
      verificationMarker: 'VERIFIED_BY_ADAPTER' as const,
    };
    await expect(applyVerifiedPaymentEvent(paymentEvent)).resolves.toMatchObject({
      processingStatus: 'PROCESSED',
    });
    await expect(applyVerifiedPaymentEvent(paymentEvent)).resolves.toMatchObject({
      processingStatus: 'DUPLICATE',
    });

    const paid = await database.pool.query<{
      booking_status: string;
      payment_count: number;
      payment_status: string;
      amount_vnd: string;
    }>(
      `SELECT b.status AS booking_status,
              count(pay.id)::int AS payment_count,
              max(pay.status)::text AS payment_status,
              max(pay.amount_vnd)::text AS amount_vnd
         FROM bookings b
         LEFT JOIN payments pay ON pay.booking_id = b.id
        WHERE b.id = $1
        GROUP BY b.id, b.status`,
      [hold.bookingId],
    );
    expect(paid.rows[0]).toMatchObject({
      booking_status: 'CONFIRMED',
      payment_count: 1,
      payment_status: 'SUCCEEDED',
      amount_vnd: String(quote.pricing.finalAmountVnd),
    });

    const customerToken = randomBytes(32);
    await database.pool.query(
      `INSERT INTO guest_sessions (booking_id, token_digest, expires_at)
       VALUES ($1, $2, $3)`,
      [
        hold.bookingId,
        digestSessionToken(sessionSecret, customerToken),
        new Date(new Date(input.checkOut).getTime() + 2 * 60 * 60 * 1000),
      ],
    );
    const customer = new BookingDetailService(
      new BookingDetailRepository(createDatabaseClient(database.pool)),
      new GuestSessionService(new GuestSessionRepository(database.pool), {
        otpSecret: sessionSecret,
        challengeRefSecret: sessionSecret,
        sessionSecret,
        ipDigestSecret: sessionSecret,
      }),
      arrivalAccess,
    );
    const middle = new Date(new Date(input.checkIn).getTime() + 36 * 60 * 60 * 1000);
    await expect(
      customer.getByBookingCode(hold.bookingCode, customerToken, middle),
    ).resolves.toMatchObject({
      status: 'CONFIRMED',
      amountVnd: quote.pricing.finalAmountVnd,
    });
    const access = new BookingAccessPassService(sessionSecret);
    await expect(
      customer.getAccessPass(hold.bookingCode, customerToken, middle, access),
    ).resolves.toMatchObject({ bookingCode: hold.bookingCode });
    const rawPass = access.issue({
      bookingId: hold.bookingId,
      version: 1,
      expiresAt: new Date(new Date(input.checkOut).getTime() + 60 * 60 * 1000),
    });
    expect(access.verify(rawPass, middle).bookingId).toBe(hold.bookingId);
    expect(
      access.verify(rawPass, new Date(new Date(input.checkOut).getTime() + 30 * 60 * 1000))
        .bookingId,
    ).toBe(hold.bookingId);
    expect(() =>
      access.verify(rawPass, new Date(new Date(input.checkOut).getTime() + 61 * 60 * 1000)),
    ).toThrow();

    const lifecyclePool: DatabasePool = createDatabasePool(database.databaseUrl, {
      max: 4,
      applicationName: 'b0-runtime-lifecycle-test',
    });
    try {
      const lifecycle = new AdminBookingLifecycleService(
        lifecyclePool,
        new AdminBookingRepository(lifecyclePool),
      );
      const checkedIn = await lifecycle.checkIn(
        adminActor,
        hold.bookingCode,
        new Date(input.checkIn),
      );
      expect(checkedIn.status).toBe('CHECKED_IN');
      const roomDuringStay = await database.pool.query<{
        status: string;
        housekeeping_status: string;
      }>(`SELECT status, housekeeping_status FROM rooms WHERE id = $1`, [assignedRoomId]);
      expect(roomDuringStay.rows[0]).toMatchObject({
        status: 'ACTIVE',
        housekeeping_status: 'CLEAN',
      });
      const midTurnover = await database.pool.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM housekeeping_tasks WHERE booking_id = $1 AND type = 'TURNOVER'`,
        [hold.bookingId],
      );
      expect(midTurnover.rows[0]?.count).toBe(0);

      const checkedOut = await lifecycle.checkOut(
        adminActor,
        hold.bookingCode,
        new Date(input.checkOut),
      );
      expect(checkedOut.status).toBe('CHECKED_OUT');
      await expect(
        lifecycle.checkOut(adminActor, hold.bookingCode, new Date(input.checkOut)),
      ).rejects.toThrow();
      const finalState = await database.pool.query<{
        booking_status: string;
        block_status: string;
        room_status: string;
        housekeeping_status: string;
        turnover_count: number;
      }>(
        `SELECT b.status AS booking_status,
                rib.status AS block_status,
                r.status AS room_status,
                r.housekeeping_status,
                (SELECT count(*)::int FROM housekeeping_tasks h
                  WHERE h.booking_id = b.id AND h.type = 'TURNOVER') AS turnover_count
           FROM bookings b
           JOIN room_inventory_blocks rib ON rib.booking_id = b.id
           JOIN rooms r ON r.id = b.room_id
          WHERE b.id = $1`,
        [hold.bookingId],
      );
      expect(finalState.rows[0]).toMatchObject({
        booking_status: 'CHECKED_OUT',
        block_status: 'RELEASED',
        room_status: 'ACTIVE',
        housekeeping_status: 'DIRTY',
        turnover_count: 1,
      });
    } finally {
      await lifecyclePool.end();
    }
  });

  it('cancels one paid multi-night booking as a whole and releases its full interval once', async () => {
    const input = stay(5, 2);
    const quote = await quotes.issue({ ...input, roomTypeId: ids.roomType });
    const hold = await createBookingHoldWithRetry(database.pool, {
      quoteId: quote.id,
      contact: normalizeContact(
        {
          fullName: 'B0 Cancellation Guest',
          email: 'b0-cancellation-guest@example.test',
          phone: '0909000001',
        },
        digestSecret,
      ),
      holdDurationMs: 5 * 60 * 1000,
      correlationId: 'b0-cancellation-hold-correlation',
    });

    const attempt = await createPaymentAttempt({
      pool: database.pool,
      propertyId: ids.property,
      bookingId: hold.bookingId,
      provider: 'MOMO',
      idempotencyKey: 'b0-cancellation-payment-001',
    });
    await expect(
      applyVerifiedPaymentEvent({
        pool: database.pool,
        provider: 'MOMO',
        eventKey: 'b0-cancellation-payment-event-001',
        providerOrderId: attempt.providerOrderId,
        providerTransactionId: 'b0-cancellation-transaction-001',
        normalizedOutcome: 'SUCCEEDED',
        amountVnd: attempt.amountVnd,
        currency: 'VND',
        occurredAt: new Date('2027-03-01T00:00:00.000Z'),
        rawBodyDigest: Buffer.alloc(32, 8),
        verificationMarker: 'VERIFIED_BY_ADAPTER',
      }),
    ).resolves.toMatchObject({ processingStatus: 'PROCESSED' });

    const customerToken = randomBytes(32);
    await database.pool.query(
      `INSERT INTO guest_sessions (booking_id, token_digest, expires_at)
       VALUES ($1, $2, $3)`,
      [
        hold.bookingId,
        digestSessionToken(sessionSecret, customerToken),
        new Date('2027-03-05T00:00:00.000Z'),
      ],
    );
    const customer = new BookingDetailService(
      new BookingDetailRepository(createDatabaseClient(database.pool)),
      new GuestSessionService(new GuestSessionRepository(database.pool), {
        otpSecret: sessionSecret,
        challengeRefSecret: sessionSecret,
        sessionSecret,
        ipDigestSecret: sessionSecret,
      }),
      arrivalAccess,
    );
    const access = new BookingAccessPassService(sessionSecret);
    const cancellationTime = new Date('2027-03-01T00:00:00.000Z');
    await expect(
      customer.getAccessPass(hold.bookingCode, customerToken, cancellationTime, access),
    ).rejects.toMatchObject({ code: 'BOOKING_ACCESS_PASS_INVALID' });

    const before = await database.pool.query<{
      check_in: Date;
      check_out: Date;
      price_snapshot: unknown;
      cancellation_policy_snapshot: unknown;
      access_pass_version: number;
    }>(
      `SELECT check_in, check_out, price_snapshot, cancellation_policy_snapshot,
              access_pass_version
         FROM bookings
        WHERE id = $1`,
      [hold.bookingId],
    );
    const beforeRow = before.rows[0];
    if (beforeRow === undefined) throw new Error('cancellation booking was not created');

    const lifecyclePool = createDatabasePool(database.databaseUrl, {
      max: 4,
      applicationName: 'b0-runtime-cancellation-test',
    });
    try {
      const lifecycle = new AdminBookingLifecycleService(
        lifecyclePool,
        new AdminBookingRepository(lifecyclePool),
      );
      const cancellationRequest = ['b0', 'cancellation', 'idempotency', '001'].join('-');
      await expect(
        lifecycle.cancel(
          adminActor,
          hold.bookingCode,
          { reason: 'B0 whole-booking cancellation regression' },
          cancellationTime,
          cancellationRequest,
        ),
      ).resolves.toMatchObject({ status: 'CANCELLED' });

      const after = await database.pool.query<{
        status: string;
        check_in: Date;
        check_out: Date;
        price_snapshot: unknown;
        cancellation_policy_snapshot: unknown;
        access_pass_version: number;
        access_pass_revoked_at: Date | null;
        cancellation_refund_state: string;
        cancellation_refund_amount_vnd: string | null;
        cancellation_retained_amount_vnd: string | null;
      }>(
        `SELECT status, check_in, check_out, price_snapshot, cancellation_policy_snapshot,
                access_pass_version, access_pass_revoked_at, cancellation_refund_state,
                cancellation_refund_amount_vnd::text, cancellation_retained_amount_vnd::text
           FROM bookings
          WHERE id = $1`,
        [hold.bookingId],
      );
      expect(after.rows[0]).toMatchObject({
        status: 'CANCELLED',
        check_in: beforeRow.check_in,
        check_out: beforeRow.check_out,
        price_snapshot: beforeRow.price_snapshot,
        cancellation_policy_snapshot: beforeRow.cancellation_policy_snapshot,
        access_pass_version: beforeRow.access_pass_version + 1,
        cancellation_refund_state: 'REVIEW_REQUIRED',
      });
      expect(after.rows[0]?.access_pass_revoked_at).not.toBeNull();

      await expect(
        customer.getAccessPass(hold.bookingCode, customerToken, cancellationTime, access),
      ).rejects.toThrow();

      const released = await database.pool.query<{
        block_count: number;
        active_count: number;
        released_count: number;
        payment_count: number;
        review_count: number;
        audit_count: number;
        outbox_count: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM room_inventory_blocks WHERE booking_id = $1) AS block_count,
           (SELECT count(*)::int FROM room_inventory_blocks
             WHERE booking_id = $1 AND status = 'ACTIVE') AS active_count,
           (SELECT count(*)::int FROM room_inventory_blocks
             WHERE booking_id = $1 AND status = 'RELEASED') AS released_count,
           (SELECT count(*)::int FROM payments WHERE booking_id = $1) AS payment_count,
           (SELECT count(*)::int FROM operational_reviews
             WHERE booking_id = $1 AND category = 'PAID_CANCELLATION') AS review_count,
           (SELECT count(*)::int FROM audit_events
             WHERE aggregate_id = $1 AND event_type = 'BOOKING_CANCELLED') AS audit_count,
           (SELECT count(*)::int FROM outbox_events
             WHERE aggregate_id = $1 AND event_type = 'booking.cancelled') AS outbox_count`,
        [hold.bookingId],
      );
      expect(released.rows[0]).toMatchObject({
        block_count: 1,
        active_count: 0,
        released_count: 1,
        payment_count: 1,
        review_count: 1,
        audit_count: 1,
        outbox_count: 1,
      });

      await expect(
        lifecycle.cancel(
          adminActor,
          hold.bookingCode,
          { reason: 'B0 whole-booking cancellation regression' },
          cancellationTime,
          'b0-cancellation-idempotency-001',
        ),
      ).resolves.toMatchObject({ status: 'CANCELLED' });
      const stable = await database.pool.query<{
        cancellation_idempotency_key: string;
        cancellation_refund_amount_vnd: string | null;
        cancellation_refund_state: string;
      }>(
        `SELECT cancellation_idempotency_key, cancellation_refund_amount_vnd::text,
                cancellation_refund_state
           FROM bookings
          WHERE id = $1`,
        [hold.bookingId],
      );
      expect(stable.rows[0]).toMatchObject({
        cancellation_idempotency_key: cancellationRequest,
        cancellation_refund_state: 'REVIEW_REQUIRED',
      });
      expect(stable.rows[0]?.cancellation_refund_amount_vnd).toBe(
        after.rows[0]?.cancellation_refund_amount_vnd,
      );
    } finally {
      await lifecyclePool.end();
    }
  });

  it('searches, quotes, and persists the selected active property without first-property fallback', async () => {
    await database.pool.query(
      `INSERT INTO properties
        (id, code, name, timezone, minimum_stay_minutes, maximum_stay_minutes,
         minimum_lead_time_minutes, maximum_advance_booking_days, default_overnight_duration_minutes)
       VALUES ($1, 'B0_SECOND', 'B0 Second Property', 'Asia/Ho_Chi_Minh', 60, 44640, 0, 2000, 720)`,
      [ids.otherProperty],
    );
    await database.pool.query(
      `INSERT INTO price_tiers (id, property_id, code, name, sort_order)
       VALUES ($1, $2, 'B0_SECOND_STANDARD', 'B0 second standard', 1)`,
      [ids.otherTier, ids.otherProperty],
    );
    await database.pool.query(
      `INSERT INTO room_types
        (id, property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy)
       VALUES ($1, $2, $3, 'B0_SECOND_DELUXE', 'B0 Second Deluxe', 2, 1, 3)`,
      [ids.otherRoomType, ids.otherProperty, ids.otherTier],
    );
    await database.pool.query(
      `INSERT INTO rooms (id, property_id, room_type_id, room_number)
       VALUES ($1, $2, $3, 'B0-SECOND-101')`,
      [ids.otherRoom, ids.otherProperty, ids.otherRoomType],
    );
    await database.pool.query(
      `INSERT INTO rate_plans
       (id, property_id, code, name, status, included_duration_minutes, priority, is_base_plan,
         min_duration_minutes_inclusive, max_duration_minutes_inclusive)
       VALUES
        ($1, $3, 'NIGHT_COMBO', 'Night combo', 'ACTIVE', 720, 1, true, 60, 1440),
        ($2, $3, 'EXTRA_HOUR', 'Extra hour', 'ACTIVE', 60, 2, false, NULL, NULL)`,
      [ids.otherNightPlan, ids.otherExtraPlan, ids.otherProperty],
    );
    await database.pool.query(
      `INSERT INTO rate_plan_prices (id, property_id, rate_plan_id, price_tier_id, amount_vnd)
       VALUES ($1, $4, $2, $3, 700000), ($5, $4, $6, $3, 120000)`,
      [
        ids.otherNightPrice,
        ids.otherNightPlan,
        ids.otherTier,
        ids.otherProperty,
        ids.otherExtraPrice,
        ids.otherExtraPlan,
      ],
    );
    const policyActor = {
      userId: ids.admin,
      requestId: 'b0-second-property-bootstrap',
      propertyIds: [ids.otherProperty] as readonly string[] | 'ALL',
    };
    const bootstrapped = await policyService.bootstrapDraft(policyActor, {
      internalName: 'B0 second property bootstrap',
      effectiveFrom: new Date('2027-01-01T00:00:00.000Z'),
      overnightWindow: '21-09',
      nightPlanCode: 'NIGHT_COMBO',
      extraHourPlanCode: 'EXTRA_HOUR',
      idempotencyKey: 'b0-second-property-bootstrap-001',
      dryRun: false,
    });
    await policyService.publishInitial(policyActor, bootstrapped.policyId);

    const input = stay(28, 1);
    const allProperties = await availability.search(input);
    expect(allProperties.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ propertyId: ids.property, roomTypeId: ids.roomType }),
        expect.objectContaining({ propertyId: ids.otherProperty, roomTypeId: ids.otherRoomType }),
      ]),
    );

    const selectedProperty = await availability.search({ ...input, propertyId: ids.otherProperty });
    expect(selectedProperty.items).toHaveLength(1);
    expect(selectedProperty.items[0]).toMatchObject({
      propertyId: ids.otherProperty,
      roomTypeId: ids.otherRoomType,
    });

    const quote = await quotes.issue({ ...input, roomTypeId: ids.otherRoomType });
    expect(quote).toMatchObject({ propertyId: ids.otherProperty });
    if (!('selectionReason' in quote.pricing)) {
      throw new Error('expected a multi-night selection explanation');
    }
    expect(quote.pricing.selectionReason).toBe('LOWEST_VALID_CUSTOMER_TOTAL');
    expect(quote.pricing.alternatives).toEqual(expect.any(Array));
    const persisted = await database.pool.query<{ property_id: string }>(
      `SELECT property_id FROM quotes WHERE id = $1`,
      [quote.id],
    );
    expect(persisted.rows[0]?.property_id).toBe(ids.otherProperty);

    await expect(
      quotes.issue({ ...input, propertyId: ids.property, roomTypeId: ids.otherRoomType }),
    ).rejects.toMatchObject({ code: 'NO_VALID_PRICING' });
  });
});
