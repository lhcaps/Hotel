import { Pool } from 'pg';

import {
  CLIENT_ROOM_IMPORT_VERSION,
  CLIENT_ROOM_MANIFEST,
  validateClientRoomManifest,
} from '../src/client-room-import.js';

const apply = process.argv.includes('--apply');
const databaseUrl = process.env.DATABASE_URL;
const propertyCode =
  process.env.CLIENT_IMPORT_PROPERTY_CODE ?? CLIENT_ROOM_MANIFEST.property.defaultCode;
const propertyName =
  process.env.CLIENT_IMPORT_PROPERTY_NAME ?? CLIENT_ROOM_MANIFEST.property.defaultName;

if (apply && process.env.CLIENT_ROOM_IMPORT_CONFIRM !== 'APPLY_23_ROOMS') {
  throw new Error('Refusing writes: set CLIENT_ROOM_IMPORT_CONFIRM=APPLY_23_ROOMS with --apply');
}

validateClientRoomManifest();

const planned = {
  version: CLIENT_ROOM_IMPORT_VERSION,
  mode: apply ? 'apply' : 'dry-run',
  propertyCode,
  rooms: CLIENT_ROOM_MANIFEST.rooms,
  rates: CLIENT_ROOM_MANIFEST.ratePlans.map((plan) => ({ code: plan.code, amounts: plan.amounts })),
};

if (!apply) {
  process.stdout.write(`${JSON.stringify(planned, null, 2)}\n`);
  process.stdout.write(
    'Dry run only: no database write was attempted. Re-run with --apply and explicit confirmation.\n',
  );
  process.exit(0);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  application_name: 'room-management-client-room-import',
});
const counts = { created: 0, updated: 0, skipped: 0 };

async function upsert(
  client: import('pg').PoolClient,
  selectSql: string,
  selectParams: unknown[],
  equal: (row: Record<string, unknown>) => boolean,
  writeSql: string,
  writeParams: unknown[],
) {
  const existing = await client.query<Record<string, unknown>>(selectSql, selectParams);
  if (existing.rowCount === 0) {
    await client.query(writeSql, writeParams);
    counts.created += 1;
  } else if (equal(existing.rows[0] ?? {})) {
    counts.skipped += 1;
  } else {
    await client.query(writeSql, writeParams);
    counts.updated += 1;
  }
}

try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await upsert(
      client,
      'SELECT name, timezone, status FROM properties WHERE code = $1',
      [propertyCode],
      (row) =>
        row.name === propertyName &&
        row.timezone === CLIENT_ROOM_MANIFEST.property.timezone &&
        row.status === 'ACTIVE',
      `INSERT INTO properties (code, name, timezone, status) VALUES ($1, $2, $3, 'ACTIVE')
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, timezone = EXCLUDED.timezone, status = EXCLUDED.status`,
      [propertyCode, propertyName, CLIENT_ROOM_MANIFEST.property.timezone],
    );
    const property = await client.query<{ id: string }>(
      'SELECT id FROM properties WHERE code = $1',
      [propertyCode],
    );
    const propertyId = property.rows[0]?.id;
    if (propertyId === undefined) throw new Error('Property upsert did not return a row');

    const tiers = new Map<string, string>();
    for (const tier of CLIENT_ROOM_MANIFEST.tiers) {
      await upsert(
        client,
        'SELECT name, sort_order, status FROM price_tiers WHERE property_id = $1 AND code = $2',
        [propertyId, tier.code],
        (row) =>
          row.name === tier.name && row.sort_order === tier.sortOrder && row.status === 'ACTIVE',
        `INSERT INTO price_tiers (property_id, code, name, sort_order, status) VALUES ($1, $2, $3, $4, 'ACTIVE')
         ON CONFLICT (property_id, code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, status = EXCLUDED.status`,
        [propertyId, tier.code, tier.name, tier.sortOrder],
      );
      const result = await client.query<{ id: string }>(
        'SELECT id FROM price_tiers WHERE property_id = $1 AND code = $2',
        [propertyId, tier.code],
      );
      const id = result.rows[0]?.id;
      if (id === undefined) throw new Error(`Tier ${tier.code} did not resolve`);
      tiers.set(tier.code, id);
    }

    const tiersByCode = new Map(CLIENT_ROOM_MANIFEST.tiers.map((tier) => [tier.code, tier]));
    const roomTypes = new Map<string, string>();
    const concepts = [
      ...new Map(CLIENT_ROOM_MANIFEST.rooms.map((room) => [room.name, room])).values(),
    ];
    for (const concept of concepts) {
      const tier = tiersByCode.get(concept.tierCode);
      const tierId = tiers.get(concept.tierCode);
      if (tier === undefined || tierId === undefined) {
        throw new Error(`Room concept ${concept.name} references an unknown tier`);
      }
      const code =
        concept.name === 'Phù Vân'
          ? 'PHU_VAN'
          : concept.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
      await upsert(
        client,
        'SELECT price_tier_id, name, max_adults, max_children, max_occupancy, status FROM room_types WHERE property_id = $1 AND code = $2',
        [propertyId, code],
        (row) =>
          row.price_tier_id === tierId &&
          row.name === concept.name &&
          row.max_adults === tier.maxAdults &&
          row.max_children === tier.maxChildren &&
          row.max_occupancy === tier.maxOccupancy &&
          row.status === 'ACTIVE',
        `INSERT INTO room_types (property_id, price_tier_id, code, name, max_adults, max_children, max_occupancy, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
         ON CONFLICT (property_id, code) DO UPDATE SET price_tier_id = EXCLUDED.price_tier_id, name = EXCLUDED.name,
           max_adults = EXCLUDED.max_adults, max_children = EXCLUDED.max_children, max_occupancy = EXCLUDED.max_occupancy, status = EXCLUDED.status`,
        [
          propertyId,
          tierId,
          code,
          concept.name,
          tier.maxAdults,
          tier.maxChildren,
          tier.maxOccupancy,
        ],
      );
      const result = await client.query<{ id: string }>(
        'SELECT id FROM room_types WHERE property_id = $1 AND code = $2',
        [propertyId, code],
      );
      const id = result.rows[0]?.id;
      if (id === undefined) throw new Error(`Room type ${code} did not resolve`);
      roomTypes.set(concept.name, id);
    }

    for (const room of CLIENT_ROOM_MANIFEST.rooms) {
      const roomTypeId = roomTypes.get(room.name);
      if (roomTypeId === undefined) throw new Error(`Room type ${room.tierCode} did not resolve`);
      await upsert(
        client,
        'SELECT room_type_id, room_number, physical_room_code, status, housekeeping_status FROM rooms WHERE property_id = $1 AND physical_room_code = $2',
        [propertyId, room.physicalRoomCode],
        (row) =>
          row.room_type_id === roomTypeId &&
          row.room_number === room.physicalRoomCode &&
          row.physical_room_code === room.physicalRoomCode &&
          row.status === 'ACTIVE' &&
          row.housekeeping_status === 'CLEAN',
        `INSERT INTO rooms (property_id, room_type_id, room_number, physical_room_code, status, housekeeping_status)
         VALUES ($1, $2, $3, $4, 'ACTIVE', 'CLEAN')
         ON CONFLICT (property_id, physical_room_code) DO UPDATE SET room_type_id = EXCLUDED.room_type_id,
           room_number = EXCLUDED.room_number, status = EXCLUDED.status, housekeeping_status = EXCLUDED.housekeeping_status`,
        [propertyId, roomTypeId, room.physicalRoomCode, room.physicalRoomCode],
      );
    }

    const legacyConceptNames = CLIENT_ROOM_MANIFEST.rooms.map((room) => room.name);
    await client.query(
      `UPDATE rooms
          SET status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP
        WHERE property_id = $1
          AND room_number = ANY($2::text[])
          AND NOT (physical_room_code = ANY($3::text[]))
          AND NOT EXISTS (
            SELECT 1 FROM bookings
             WHERE bookings.property_id = rooms.property_id
               AND bookings.room_id = rooms.id
          )`,
      [
        propertyId,
        [...new Set(legacyConceptNames)],
        CLIENT_ROOM_MANIFEST.rooms.map((room) => room.physicalRoomCode),
      ],
    );

    for (const plan of CLIENT_ROOM_MANIFEST.ratePlans) {
      const isBasePlan = plan.code !== 'EXTRA_HOUR';
      await upsert(
        client,
        'SELECT name, status, included_duration_minutes, priority, is_base_plan, min_check_in_minute_inclusive, max_check_in_minute_exclusive, min_duration_minutes_inclusive, max_duration_minutes_inclusive, source_evidence FROM rate_plans WHERE property_id = $1 AND code = $2',
        [propertyId, plan.code],
        (row) =>
          row.name === plan.name &&
          row.status === 'ACTIVE' &&
          row.included_duration_minutes === plan.includedDurationMinutes &&
          row.priority === plan.priority &&
          row.is_base_plan === isBasePlan &&
          row.min_check_in_minute_inclusive === plan.minCheckInMinuteInclusive &&
          row.max_check_in_minute_exclusive === plan.maxCheckInMinuteExclusive &&
          row.min_duration_minutes_inclusive === plan.minDurationMinutesInclusive &&
          row.max_duration_minutes_inclusive === plan.maxDurationMinutesInclusive &&
          row.source_evidence === 'Client undiscounted price table 2026-08-01',
        `INSERT INTO rate_plans (property_id, code, name, status, included_duration_minutes, priority, is_base_plan,
          min_check_in_minute_inclusive, max_check_in_minute_exclusive, min_duration_minutes_inclusive, max_duration_minutes_inclusive, source_evidence)
         VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6, $7, $8, $9, $10, 'Client undiscounted price table 2026-08-01')
         ON CONFLICT (property_id, code) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status,
           included_duration_minutes = EXCLUDED.included_duration_minutes, priority = EXCLUDED.priority, is_base_plan = EXCLUDED.is_base_plan,
           min_check_in_minute_inclusive = EXCLUDED.min_check_in_minute_inclusive, max_check_in_minute_exclusive = EXCLUDED.max_check_in_minute_exclusive,
           min_duration_minutes_inclusive = EXCLUDED.min_duration_minutes_inclusive, max_duration_minutes_inclusive = EXCLUDED.max_duration_minutes_inclusive,
           source_evidence = EXCLUDED.source_evidence`,
        [
          propertyId,
          plan.code,
          plan.name,
          plan.includedDurationMinutes,
          plan.priority,
          isBasePlan,
          plan.minCheckInMinuteInclusive,
          plan.maxCheckInMinuteExclusive,
          plan.minDurationMinutesInclusive,
          plan.maxDurationMinutesInclusive,
        ],
      );
      const result = await client.query<{ id: string }>(
        'SELECT id FROM rate_plans WHERE property_id = $1 AND code = $2',
        [propertyId, plan.code],
      );
      const planId = result.rows[0]?.id;
      if (planId === undefined) throw new Error(`Rate plan ${plan.code} did not resolve`);
      for (const [index, tier] of CLIENT_ROOM_MANIFEST.tiers.entries()) {
        const amount = plan.amounts[index];
        const tierId = tiers.get(tier.code);
        if (amount === undefined || tierId === undefined)
          throw new Error(`Price ${plan.code}/${tier.code} did not resolve`);
        await upsert(
          client,
          'SELECT amount_vnd, currency FROM rate_plan_prices WHERE rate_plan_id = $1 AND price_tier_id = $2',
          [planId, tierId],
          (row) => Number(row.amount_vnd) === amount && row.currency === 'VND',
          `INSERT INTO rate_plan_prices (property_id, rate_plan_id, price_tier_id, amount_vnd, currency) VALUES ($1, $2, $3, $4, 'VND')
           ON CONFLICT (rate_plan_id, price_tier_id) DO UPDATE SET amount_vnd = EXCLUDED.amount_vnd, currency = EXCLUDED.currency`,
          [propertyId, planId, tierId, amount],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  process.stdout.write(
    `${JSON.stringify({ version: CLIENT_ROOM_IMPORT_VERSION, mode: 'apply', counts, roomCount: CLIENT_ROOM_MANIFEST.rooms.length })}\n`,
  );
} finally {
  await pool.end();
}
