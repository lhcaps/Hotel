import { withDatabasePool } from './client.js';
import { DatabaseSafetyError } from './errors.js';

export interface DevelopmentSeedOptions {
  readonly environment: string | undefined;
}

const DEMO = {
  property: '10000000-0000-4000-8000-000000000001',
  tiers: [
    ['10000000-0000-4000-8000-000000000101', 'STANDARD', 'Standard', 1],
    ['10000000-0000-4000-8000-000000000102', 'DELUXE', 'Deluxe', 2],
    ['10000000-0000-4000-8000-000000000103', 'SIGNATURE', 'Signature', 3],
  ] as const,
  roomTypes: [
    ['10000000-0000-4000-8000-000000000201', 'STANDARD', 'Standard', 2, 1, 3],
    ['10000000-0000-4000-8000-000000000202', 'DELUXE', 'Deluxe', 2, 2, 4],
    ['10000000-0000-4000-8000-000000000203', 'SIGNATURE', 'Signature', 4, 2, 5],
  ] as const,
  rooms: [
    ['10000000-0000-4000-8000-000000000301', 0, '101', 'CLEAN'],
    ['10000000-0000-4000-8000-000000000302', 0, '102', 'DIRTY'],
    ['10000000-0000-4000-8000-000000000303', 1, '201', 'CLEANING'],
    ['10000000-0000-4000-8000-000000000304', 1, '202', 'CLEAN'],
    ['10000000-0000-4000-8000-000000000305', 2, '301', 'DIRTY'],
    ['10000000-0000-4000-8000-000000000306', 2, '302', 'CLEANING'],
  ] as const,
  amenities: [
    ['10000000-0000-4000-8000-000000000401', 'WIFI', 'Wi-Fi'],
    ['10000000-0000-4000-8000-000000000402', 'AIR_CONDITIONING', 'Air conditioning'],
    ['10000000-0000-4000-8000-000000000403', 'SMART_TV', 'Smart TV'],
  ] as const,
  ratePlans: [
    [
      '10000000-0000-4000-8000-000000000501',
      'THREE_HOUR_COMBO',
      'Three-hour combo',
      'ACTIVE',
      180,
      60,
      true,
      null,
      null,
      60,
      240,
    ],
    [
      '10000000-0000-4000-8000-000000000502',
      'FIVE_HOUR_COMBO',
      'Five-hour combo',
      'ACTIVE',
      300,
      70,
      true,
      0,
      1080,
      255,
      960,
    ],
    [
      '10000000-0000-4000-8000-000000000503',
      'LUNCH_COMBO',
      'Lunch combo',
      'ACTIVE',
      180,
      80,
      true,
      660,
      900,
      60,
      960,
    ],
    [
      '10000000-0000-4000-8000-000000000504',
      'NIGHT_COMBO',
      'Night combo',
      'ACTIVE',
      300,
      90,
      true,
      1080,
      1440,
      300,
      960,
    ],
    [
      '10000000-0000-4000-8000-000000000505',
      'DAY_COMBO',
      'Day combo',
      'ACTIVE',
      1440,
      100,
      true,
      null,
      null,
      975,
      1440,
    ],
    [
      '10000000-0000-4000-8000-000000000506',
      'EXTRA_HOUR',
      'Extra hour',
      'ACTIVE',
      60,
      10,
      false,
      null,
      null,
      null,
      null,
    ],
  ] as const,
} as const;

const UAT = {
  users: [
    ['10000000-0000-4000-8000-000000000701', 'UAT Customer One', 'uat-customer-one@example.test'],
    ['10000000-0000-4000-8000-000000000702', 'UAT Customer Two', 'uat-customer-two@example.test'],
  ] as const,
  bookings: [
    [
      '10000000-0000-4000-8000-000000000711',
      0,
      0,
      'UAT-HOLD-20270710',
      'HOLD',
      '2027-07-10T09:00:00+07:00',
      null,
      359_000,
    ],
    [
      '10000000-0000-4000-8000-000000000712',
      0,
      1,
      'UAT-CONFIRMED-20270711',
      'CONFIRMED',
      '2027-07-11T09:00:00+07:00',
      0,
      359_000,
    ],
    [
      '10000000-0000-4000-8000-000000000713',
      1,
      2,
      'UAT-PENDING-20270712',
      'CONFIRMED',
      '2027-07-12T09:00:00+07:00',
      0,
      419_000,
    ],
    [
      '10000000-0000-4000-8000-000000000714',
      1,
      3,
      'UAT-CANCELLED-20270713',
      'CANCELLED',
      '2027-07-13T09:00:00+07:00',
      1,
      419_000,
    ],
    [
      '10000000-0000-4000-8000-000000000715',
      2,
      4,
      'UAT-EXPIRED-20270714',
      'EXPIRED',
      '2027-07-14T09:00:00+07:00',
      null,
      489_000,
    ],
  ] as const,
  maintenance: [
    '10000000-0000-4000-8000-000000000751',
    5,
    '2027-07-16T09:00:00+07:00',
    '2027-07-16T12:00:00+07:00',
  ] as const,
} as const;

export function assertSafeDevelopmentSeedTarget(
  connectionString: string,
  environment: string | undefined,
): URL {
  if (environment !== 'development') {
    throw new DatabaseSafetyError('Development seed requires the development environment');
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new DatabaseSafetyError('Development seed requires a valid PostgreSQL URL');
  }
  if (
    (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') ||
    (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new DatabaseSafetyError(
      'Development seed requires a loopback PostgreSQL target without connection overrides',
    );
  }
  return url;
}

export async function seedDevelopmentData(
  connectionString: string,
  options: DevelopmentSeedOptions,
): Promise<void> {
  const validatedUrl = assertSafeDevelopmentSeedTarget(connectionString, options.environment);

  await withDatabasePool(
    validatedUrl,
    async (pool) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO properties (id, code, name, timezone, status)
           VALUES ($1, 'DEMO_PROPERTY', 'Room Management Demo', 'Asia/Ho_Chi_Minh', 'ACTIVE')
           ON CONFLICT (id) DO UPDATE
             SET code = EXCLUDED.code, name = EXCLUDED.name,
                 timezone = EXCLUDED.timezone, status = EXCLUDED.status`,
          [DEMO.property],
        );

        for (const [id, code, name, sortOrder] of DEMO.tiers) {
          await client.query(
            `INSERT INTO price_tiers (id, property_id, code, name, sort_order, status)
             VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
             ON CONFLICT (id) DO UPDATE
               SET code = EXCLUDED.code, name = EXCLUDED.name,
                   sort_order = EXCLUDED.sort_order, status = EXCLUDED.status`,
            [id, DEMO.property, code, name, sortOrder],
          );
        }

        for (const [index, roomType] of DEMO.roomTypes.entries()) {
          const [id, code, name, maxAdults, maxChildren, maxOccupancy] = roomType;
          const tier = DEMO.tiers[index];
          if (tier === undefined) {
            throw new Error('Demo room type is missing its deterministic price tier');
          }
          await client.query(
            `INSERT INTO room_types
               (id, property_id, price_tier_id, code, name,
                max_adults, max_children, max_occupancy, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')
             ON CONFLICT (id) DO UPDATE
               SET price_tier_id = EXCLUDED.price_tier_id, code = EXCLUDED.code,
                   name = EXCLUDED.name, max_adults = EXCLUDED.max_adults,
                   max_children = EXCLUDED.max_children,
                   max_occupancy = EXCLUDED.max_occupancy, status = EXCLUDED.status`,
            [id, DEMO.property, tier[0], code, name, maxAdults, maxChildren, maxOccupancy],
          );
        }

        for (const [id, roomTypeIndex, roomNumber, housekeepingStatus] of DEMO.rooms) {
          const roomType = DEMO.roomTypes[roomTypeIndex];
          if (roomType === undefined) {
            throw new Error('Demo room is missing its deterministic room type');
          }
          await client.query(
            `INSERT INTO rooms (id, property_id, room_type_id, room_number, status, housekeeping_status)
             VALUES ($1, $2, $3, $4, 'ACTIVE', $5)
             ON CONFLICT (id) DO UPDATE
               SET room_type_id = EXCLUDED.room_type_id,
                   room_number = EXCLUDED.room_number, status = EXCLUDED.status,
                   housekeeping_status = EXCLUDED.housekeeping_status`,
            [id, DEMO.property, roomType[0], roomNumber, housekeepingStatus],
          );
        }

        for (const [id, code, name] of DEMO.amenities) {
          await client.query(
            `INSERT INTO amenities (id, property_id, code, name, status)
             VALUES ($1, $2, $3, $4, 'ACTIVE')
             ON CONFLICT (id) DO UPDATE
               SET code = EXCLUDED.code, name = EXCLUDED.name, status = EXCLUDED.status`,
            [id, DEMO.property, code, name],
          );
        }

        for (const roomType of DEMO.roomTypes) {
          for (const amenity of DEMO.amenities) {
            await client.query(
              `INSERT INTO room_type_amenities (property_id, room_type_id, amenity_id)
               VALUES ($1, $2, $3)
               ON CONFLICT DO NOTHING`,
              [DEMO.property, roomType[0], amenity[0]],
            );
          }
        }

        for (const [
          id,
          code,
          name,
          status,
          duration,
          priority,
          isBasePlan,
          minCheckInMinuteInclusive,
          maxCheckInMinuteExclusive,
          minDurationMinutesInclusive,
          maxDurationMinutesInclusive,
        ] of DEMO.ratePlans) {
          await client.query(
            `INSERT INTO rate_plans
               (id, property_id, code, name, status,
                included_duration_minutes, priority, is_base_plan,
                min_check_in_minute_inclusive, max_check_in_minute_exclusive,
                min_duration_minutes_inclusive, max_duration_minutes_inclusive,
                source_evidence)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'S-001/S-002 Phase 0 pricing rules')
             ON CONFLICT (id) DO UPDATE
               SET code = EXCLUDED.code, name = EXCLUDED.name, status = EXCLUDED.status,
                   included_duration_minutes = EXCLUDED.included_duration_minutes,
                   priority = EXCLUDED.priority, is_base_plan = EXCLUDED.is_base_plan,
                   min_check_in_minute_inclusive = EXCLUDED.min_check_in_minute_inclusive,
                   max_check_in_minute_exclusive = EXCLUDED.max_check_in_minute_exclusive,
                   min_duration_minutes_inclusive = EXCLUDED.min_duration_minutes_inclusive,
                   max_duration_minutes_inclusive = EXCLUDED.max_duration_minutes_inclusive,
                   source_evidence = EXCLUDED.source_evidence`,
            [
              id,
              DEMO.property,
              code,
              name,
              status,
              duration,
              priority,
              isBasePlan,
              minCheckInMinuteInclusive,
              maxCheckInMinuteExclusive,
              minDurationMinutesInclusive,
              maxDurationMinutesInclusive,
            ],
          );
        }

        const lunchPlan = DEMO.ratePlans[2];
        const lunchAmounts = [359_000, 419_000, 489_000] as const;
        for (const [index, tier] of DEMO.tiers.entries()) {
          const amount = lunchAmounts[index];
          if (amount === undefined) {
            throw new Error('Demo lunch price is missing for a deterministic tier');
          }
          await client.query(
            `INSERT INTO rate_plan_prices
               (property_id, rate_plan_id, price_tier_id, amount_vnd, currency)
             VALUES ($1, $2, $3, $4, 'VND')
             ON CONFLICT (rate_plan_id, price_tier_id) DO UPDATE
               SET amount_vnd = EXCLUDED.amount_vnd, currency = EXCLUDED.currency`,
            [DEMO.property, lunchPlan[0], tier[0], amount],
          );
        }

        // Seed deterministic per-tier prices for every known base plan
        // plus the EXTRA_HOUR component. Mirrors the deterministic
        // pricing-engine test fixture so the public quote path is
        // priceable end-to-end without ADMIN having to touch the
        // catalog.
        const basePlanPrices: ReadonlyArray<readonly [string, readonly [number, number, number]]> =
          [
            ['10000000-0000-4000-8000-000000000501', [299_000, 349_000, 399_000]], // THREE_HOUR_COMBO
            ['10000000-0000-4000-8000-000000000502', [399_000, 469_000, 549_000]], // FIVE_HOUR_COMBO
            ['10000000-0000-4000-8000-000000000504', [499_000, 589_000, 689_000]], // NIGHT_COMBO
            ['10000000-0000-4000-8000-000000000505', [749_000, 879_000, 1_029_000]], // DAY_COMBO
            ['10000000-0000-4000-8000-000000000506', [80_000, 95_000, 110_000]], // EXTRA_HOUR
          ];
        for (const [planId, amounts] of basePlanPrices) {
          for (const [index, tier] of DEMO.tiers.entries()) {
            const amount = amounts[index];
            if (amount === undefined) {
              throw new Error('Demo base-plan price is missing for a deterministic tier');
            }
            await client.query(
              `INSERT INTO rate_plan_prices
                 (property_id, rate_plan_id, price_tier_id, amount_vnd, currency)
               VALUES ($1, $2, $3, $4, 'VND')
               ON CONFLICT (rate_plan_id, price_tier_id) DO UPDATE
                 SET amount_vnd = EXCLUDED.amount_vnd, currency = EXCLUDED.currency`,
              [DEMO.property, planId, tier[0], amount],
            );
          }
        }

        // Phase 8B.1 ADMIN catalog extensibility demo: register
        // SIX_HOUR_FLEX and FOUR_HOUR_FLEX plans and prices through the
        // seed surface so the cheapest-pricing selector can price quotes
        // for stay durations that previously had no eligible plan.
        const flexPlans = [
          [
            '10000000-0000-4000-8000-000000000601',
            'SIX_HOUR_FLEX',
            'Six-hour flex combo',
            'DRAFT',
            360,
            45,
            true,
            null,
            null,
            345,
            420,
            [600000, 690000, 780000],
          ],
          [
            '10000000-0000-4000-8000-000000000602',
            'FOUR_HOUR_FLEX',
            'Four-hour flex combo',
            'DRAFT',
            240,
            35,
            true,
            null,
            null,
            225,
            270,
            [420000, 490000, 560000],
          ],
        ] as const;
        for (const [
          id,
          code,
          name,
          status,
          duration,
          priority,
          isBasePlan,
          minCheckIn,
          maxCheckIn,
          minDuration,
          maxDuration,
          amounts,
        ] of flexPlans) {
          await client.query(
            `INSERT INTO rate_plans
               (id, property_id, code, name, status,
                included_duration_minutes, priority, is_base_plan,
                min_check_in_minute_inclusive, max_check_in_minute_exclusive,
                min_duration_minutes_inclusive, max_duration_minutes_inclusive,
                source_evidence)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'S-002 Phase 8B.1 admin catalog extensibility')
             ON CONFLICT (id) DO UPDATE
               SET code = EXCLUDED.code, name = EXCLUDED.name, status = EXCLUDED.status,
                   included_duration_minutes = EXCLUDED.included_duration_minutes,
                   priority = EXCLUDED.priority, is_base_plan = EXCLUDED.is_base_plan,
                   min_check_in_minute_inclusive = EXCLUDED.min_check_in_minute_inclusive,
                   max_check_in_minute_exclusive = EXCLUDED.max_check_in_minute_exclusive,
                   min_duration_minutes_inclusive = EXCLUDED.min_duration_minutes_inclusive,
                   max_duration_minutes_inclusive = EXCLUDED.max_duration_minutes_inclusive,
                   source_evidence = EXCLUDED.source_evidence`,
            [
              id,
              DEMO.property,
              code,
              name,
              status,
              duration,
              priority,
              isBasePlan,
              minCheckIn,
              maxCheckIn,
              minDuration,
              maxDuration,
            ],
          );
          for (const [index, tier] of DEMO.tiers.entries()) {
            const amount = amounts[index];
            if (amount === undefined) {
              throw new Error('Demo flex price is missing for a deterministic tier');
            }
            await client.query(
              `INSERT INTO rate_plan_prices
                 (property_id, rate_plan_id, price_tier_id, amount_vnd, currency)
               VALUES ($1, $2, $3, $4, 'VND')
               ON CONFLICT (rate_plan_id, price_tier_id) DO UPDATE
                 SET amount_vnd = EXCLUDED.amount_vnd, currency = EXCLUDED.currency`,
              [DEMO.property, id, tier[0], amount],
            );
          }
        }

        for (const [id, name, email] of UAT.users) {
          await client.query(
            `INSERT INTO users (id, name, email, email_verified, role, status)
             VALUES ($1, $2, $3, true, 'CUSTOMER', 'ACTIVE')
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email,
               email_verified = EXCLUDED.email_verified, role = EXCLUDED.role, status = EXCLUDED.status`,
            [id, name, email],
          );
        }

        for (const [
          id,
          roomTypeIndex,
          roomIndex,
          bookingCode,
          status,
          checkIn,
          customerIndex,
          amount,
        ] of UAT.bookings) {
          const roomType = DEMO.roomTypes[roomTypeIndex];
          const room = DEMO.rooms[roomIndex];
          const customer = customerIndex === null ? null : UAT.users[customerIndex];
          if (
            roomType === undefined ||
            room === undefined ||
            (customerIndex !== null && customer === undefined)
          ) {
            throw new Error('UAT booking fixture references missing catalog data');
          }
          const checkOut = new Date(new Date(checkIn).getTime() + 3 * 60 * 60 * 1000).toISOString();
          const terminalAt = new Date(new Date(checkIn).getTime() - 60 * 60 * 1000).toISOString();
          await client.query(
            `INSERT INTO bookings (
               id, property_id, room_type_id, room_id, booking_code, status, check_in, check_out,
               adults, children, gross_amount_vnd, discount_amount_vnd, final_amount_vnd,
               price_snapshot, customer_user_id, hold_expires_at, expired_at, cancelled_at,
               cancellation_reason, created_at
             ) VALUES (
               $1, $2, $3, $4, $5, $6::booking_status, $7, $8, 2, 0, $9, 0, $9,
               $10::jsonb, $11, '2027-07-31T00:00:00+07:00',
               CASE WHEN $6 = 'EXPIRED' THEN $12::timestamptz END,
               CASE WHEN $6 = 'CANCELLED' THEN $12::timestamptz END,
               CASE WHEN $6 = 'CANCELLED' THEN 'Synthetic UAT cancellation' END,
               '2027-06-01T00:00:00+07:00'
             ) ON CONFLICT (id) DO NOTHING`,
            [
              id,
              DEMO.property,
              roomType[0],
              room[0],
              bookingCode,
              status,
              checkIn,
              checkOut,
              amount,
              JSON.stringify({ ratePlanCode: 'LUNCH_COMBO', fixture: 'PHASE_8I_UAT' }),
              customer?.[0] ?? null,
              terminalAt,
            ],
          );
          await client.query(
            `INSERT INTO booking_contacts (booking_id, full_name, normalized_email, normalized_phone_e164, email_digest)
             VALUES ($1, 'Synthetic UAT Guest', $2, '+84000000000', decode(repeat('ab', 32), 'hex'))
             ON CONFLICT (booking_id) DO NOTHING`,
            [id, `${bookingCode.toLowerCase()}@example.test`],
          );
          await client.query(
            `INSERT INTO room_inventory_blocks (property_id, room_id, booking_id, block_type, status, starts_at, ends_at, released_at)
             VALUES ($1, $2, $3, 'BOOKING', (CASE WHEN $4 IN ('CANCELLED', 'EXPIRED') THEN 'RELEASED' ELSE 'ACTIVE' END)::inventory_block_status,
               $5, $6, CASE WHEN $4 IN ('CANCELLED', 'EXPIRED') THEN $7::timestamptz END)
             ON CONFLICT (booking_id) DO NOTHING`,
            [DEMO.property, room[0], id, status, checkIn, checkOut, terminalAt],
          );
        }

        const paymentFixtures = [
          ['10000000-0000-4000-8000-000000000741', 1, 'SUCCEEDED', '2027-07-11T12:30:00+07:00'],
          ['10000000-0000-4000-8000-000000000742', 2, 'PENDING', null],
          ['10000000-0000-4000-8000-000000000743', 3, 'CANCELLED', '2027-07-13T08:30:00+07:00'],
        ] as const;
        for (const [id, bookingIndex, status, terminalAt] of paymentFixtures) {
          const booking = UAT.bookings[bookingIndex];
          if (booking === undefined)
            throw new Error('UAT payment fixture references missing booking');
          await client.query(
            `INSERT INTO payments (id, property_id, booking_id, status, amount_vnd, currency, confirmation_source, succeeded_at, cancelled_at)
             VALUES ($1, $2, $3, $4::payment_status, $5, 'VND',
               CASE WHEN $4 = 'SUCCEEDED' THEN 'PROVIDER_EVENT'::payment_confirmation_source END,
               CASE WHEN $4 = 'SUCCEEDED' THEN $6::timestamptz END,
               CASE WHEN $4 = 'CANCELLED' THEN $6::timestamptz END)
             ON CONFLICT (id) DO NOTHING`,
            [id, DEMO.property, booking[0], status, booking[7], terminalAt],
          );
        }

        const failedAttempt = paymentFixtures[1];
        if (failedAttempt === undefined)
          throw new Error('UAT failed payment attempt fixture is missing');
        await client.query(
          `INSERT INTO payment_attempts (id, property_id, payment_id, provider, status, idempotency_key, provider_order_id,
             amount_vnd, currency, initiated_at, completed_at, failure_code)
           VALUES ('10000000-0000-4000-8000-000000000761', $1, $2, 'MOMO', 'FAILED', 'uat-failed-attempt',
             'UAT-FAILED-ATTEMPT', $3, 'VND', '2027-07-12T08:00:00+07:00', '2027-07-12T08:01:00+07:00', 'SYNTHETIC_DECLINED')
           ON CONFLICT (id) DO NOTHING`,
          [DEMO.property, failedAttempt[0], UAT.bookings[2][7]],
        );

        const [maintenanceId, maintenanceRoomIndex, maintenanceStartsAt, maintenanceEndsAt] =
          UAT.maintenance;
        const maintenanceRoom = DEMO.rooms[maintenanceRoomIndex];
        if (maintenanceRoom === undefined)
          throw new Error('UAT maintenance fixture references missing room');
        await client.query(
          `INSERT INTO maintenance_blocks (id, property_id, room_id, starts_at, ends_at, reason, status)
           VALUES ($1, $2, $3, $4, $5, 'Synthetic UAT maintenance', 'ACTIVE') ON CONFLICT (id) DO NOTHING`,
          [
            maintenanceId,
            DEMO.property,
            maintenanceRoom[0],
            maintenanceStartsAt,
            maintenanceEndsAt,
          ],
        );
        await client.query(
          `INSERT INTO room_inventory_blocks (property_id, room_id, maintenance_block_id, block_type, status, starts_at, ends_at)
           VALUES ($1, $2, $3, 'MAINTENANCE', 'ACTIVE', $4, $5) ON CONFLICT (maintenance_block_id) DO NOTHING`,
          [
            DEMO.property,
            maintenanceRoom[0],
            maintenanceId,
            maintenanceStartsAt,
            maintenanceEndsAt,
          ],
        );

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    { max: 1, applicationName: 'room-management-development-seed' },
  );
}
