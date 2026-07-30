// packages/database/scripts/demo-seed.ts
//
// Phase 6F demo seed. Runs via `pnpm --filter @room/database demo:seed`
// so the `pg` dependency resolves from this workspace.
//
// Idempotent: catalog rows use the existing development seed
// (`packages/database/src/seed-development.ts`); coupons are upserted
// with ON CONFLICT (property_id, normalized_code) so re-running on the
// same DATABASE_URL is safe.

import { spawnSync } from 'node:child_process';
import { Client } from 'pg';
import { resolvePnpmInvocation } from '../../../scripts/command-executable.mjs';

const DATABASE_URL = process.env.DEMO_DATABASE_URL ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  process.stderr.write('DEMO_DATABASE_URL (or DATABASE_URL) is required for the demo seed.\n');
  process.exitCode = 1;
  process.exit(1);
}

const PROPERTY_ID = '10000000-0000-4000-8000-000000000001';
const DELUXE_ROOM_TYPE = '10000000-0000-4000-8000-000000000202';

const COUPON_FIXED_ID = '20000000-0000-4000-8000-000000000001';
const COUPON_PERCENT_ID = '20000000-0000-4000-8000-000000000002';
const COUPON_DISABLED_ID = '20000000-0000-4000-8000-000000000003';

const DEMO_COUPONS = {
  FIXED: 'DEMO-FIXED',
  PERCENT: 'DEMO-PERCENT',
  DISABLED: 'DEMO-DISABLED',
} as const;

function runDevelopmentSeed(): void {
  const invocation = resolvePnpmInvocation(['--filter', '@room/database', 'db:seed:development']);
  const result = spawnSync(invocation.executable, invocation.args, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL, NODE_ENV: 'development' },
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`development seed exited with status ${String(result.status)}`);
  }
}

async function seedCoupons(): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const validFrom = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Active coupons live in one transaction so the scoped
    // percentage coupon and its room-type row commit together. The
    // Phase 6C scope-consistency trigger is DEFERRABLE INITIALLY
    // DEFERRED, so a single COMMIT resolves the constraint check.
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO coupons (
         id, property_id, normalized_code, status, discount_type,
         fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
         minimum_order_amount_vnd,
         valid_from, valid_until,
         applies_to_all_room_types,
         total_usage_limit, per_customer_limit,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, 'ACTIVE', 'FIXED',
         50000, NULL, NULL,
         0,
         $4, $5,
         TRUE,
         NULL, NULL,
         NOW(), NOW()
       )
       ON CONFLICT (property_id, normalized_code) DO UPDATE SET
         status = EXCLUDED.status,
         discount_type = EXCLUDED.discount_type,
         fixed_amount_vnd = EXCLUDED.fixed_amount_vnd,
         percentage_basis_points = EXCLUDED.percentage_basis_points,
         maximum_discount_vnd = EXCLUDED.maximum_discount_vnd,
         valid_from = EXCLUDED.valid_from,
         valid_until = EXCLUDED.valid_until,
         applies_to_all_room_types = EXCLUDED.applies_to_all_room_types,
         total_usage_limit = EXCLUDED.total_usage_limit,
         per_customer_limit = EXCLUDED.per_customer_limit,
         updated_at = NOW()`,
      [COUPON_FIXED_ID, PROPERTY_ID, DEMO_COUPONS.FIXED, validFrom, validUntil],
    );

    await client.query(
      `INSERT INTO coupons (
         id, property_id, normalized_code, status, discount_type,
         fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
         minimum_order_amount_vnd,
         valid_from, valid_until,
         applies_to_all_room_types,
         total_usage_limit, per_customer_limit,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, 'ACTIVE', 'PERCENTAGE',
         NULL, 2000, 200000,
         0,
         $4, $5,
         FALSE,
         NULL, NULL,
         NOW(), NOW()
       )
       ON CONFLICT (property_id, normalized_code) DO UPDATE SET
         status = EXCLUDED.status,
         discount_type = EXCLUDED.discount_type,
         fixed_amount_vnd = EXCLUDED.fixed_amount_vnd,
         percentage_basis_points = EXCLUDED.percentage_basis_points,
         maximum_discount_vnd = EXCLUDED.maximum_discount_vnd,
         valid_from = EXCLUDED.valid_from,
         valid_until = EXCLUDED.valid_until,
         applies_to_all_room_types = EXCLUDED.applies_to_all_room_types,
         total_usage_limit = EXCLUDED.total_usage_limit,
         per_customer_limit = EXCLUDED.per_customer_limit,
         updated_at = NOW()`,
      [COUPON_PERCENT_ID, PROPERTY_ID, DEMO_COUPONS.PERCENT, validFrom, validUntil],
    );

    // Same transaction: replace the scoped room-type rows for the
    // percentage coupon (Deluxe only). DELETE is safe because the
    // scope immutability trigger only fires when the coupon has
    // already been referenced by a quote or booking — the demo
    // database has no such references on a fresh seed.
    await client.query(`DELETE FROM coupon_room_types WHERE property_id = $1 AND coupon_id = $2`, [
      PROPERTY_ID,
      COUPON_PERCENT_ID,
    ]);
    await client.query(
      `INSERT INTO coupon_room_types (property_id, coupon_id, room_type_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
      [PROPERTY_ID, COUPON_PERCENT_ID, DELUXE_ROOM_TYPE],
    );
    await client.query('COMMIT');

    // Disabled coupon lives in its own transaction because the schema
    // enforces a CHECK that status='DISABLED' requires disabled_at.
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO coupons (
         id, property_id, normalized_code, status, discount_type,
         fixed_amount_vnd, percentage_basis_points, maximum_discount_vnd,
         minimum_order_amount_vnd,
         valid_from, valid_until, disabled_at,
         applies_to_all_room_types,
         total_usage_limit, per_customer_limit,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, 'DISABLED', 'FIXED',
         30000, NULL, NULL,
         0,
         $4, $5, NOW() - INTERVAL '1 hour',
         TRUE,
         NULL, NULL,
         NOW(), NOW()
       )
       ON CONFLICT (property_id, normalized_code) DO UPDATE SET
         status = 'DISABLED',
         disabled_at = NOW() - INTERVAL '1 hour',
         updated_at = NOW()`,
      [COUPON_DISABLED_ID, PROPERTY_ID, DEMO_COUPONS.DISABLED, validFrom, validUntil],
    );
    await client.query('COMMIT');
  } finally {
    await client.end();
  }
}

async function seedDemoRates(): Promise<void> {
  // The development seed leaves the base plans as DRAFT and only prices
  // LUNCH_COMBO. The Phase 7B grid-validation gate requires every input
  // in the supported finite grid to match an active base plan. The demo
  // activates every base plan and prices each tier so the public flow
  // works for any arrival time inside the cookie window.
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE rate_plans SET status = 'ACTIVE'
         WHERE code IN ('THREE_HOUR_COMBO', 'FIVE_HOUR_COMBO',
                        'LUNCH_COMBO', 'NIGHT_COMBO', 'DAY_COMBO', 'EXTRA_HOUR')`,
    );
    await client.query(
      `INSERT INTO rate_plan_prices (property_id, rate_plan_id, price_tier_id, amount_vnd, currency)
         VALUES
           ($1, $2, $3, 300000, 'VND'),
           ($1, $2, $4, 360000, 'VND'),
           ($1, $2, $5, 420000, 'VND'),
           ($1, $6, $3, 450000, 'VND'),
           ($1, $6, $4, 520000, 'VND'),
           ($1, $6, $5, 590000, 'VND'),
           ($1, $7, $3, 600000, 'VND'),
           ($1, $7, $4, 680000, 'VND'),
           ($1, $7, $5, 760000, 'VND'),
           ($1, $8, $3, 800000, 'VND'),
           ($1, $8, $4, 900000, 'VND'),
           ($1, $8, $5, 1000000, 'VND'),
           ($1, $9, $3, 100000, 'VND'),
           ($1, $9, $4, 110000, 'VND'),
           ($1, $9, $5, 120000, 'VND')
         ON CONFLICT (rate_plan_id, price_tier_id) DO UPDATE
           SET amount_vnd = EXCLUDED.amount_vnd, currency = EXCLUDED.currency`,
      [
        PROPERTY_ID,
        '10000000-0000-4000-8000-000000000501',
        '10000000-0000-4000-8000-000000000101',
        '10000000-0000-4000-8000-000000000102',
        '10000000-0000-4000-8000-000000000103',
        '10000000-0000-4000-8000-000000000502',
        '10000000-0000-4000-8000-000000000504',
        '10000000-0000-4000-8000-000000000505',
        '10000000-0000-4000-8000-000000000506',
      ],
    );
    await client.query('COMMIT');
  } finally {
    await client.end();
  }
}

async function seedPaymentProviders(): Promise<void> {
  // The demo orchestrator boots the deterministic payment provider
  // simulator (tests/e2e/_fixtures/payment-provider-simulator.mjs) on
  // loopback 127.0.0.1:3090 and points the API at it. Enable both
  // providers in the public settings table so the customer vertical
  // renders the payment selector without an ADMIN round-trip.
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO payment_provider_settings (
         property_id, provider, enabled, display_name, display_order,
         checkout_expiry_minutes, maintenance_message, created_at, updated_at
       ) VALUES
         ($1, 'MOMO',  TRUE, 'MoMo (Sandbox)',     0, 15, NULL, NOW(), NOW()),
         ($1, 'VNPAY', TRUE, 'VNPay (Sandbox)',    1, 15, NULL, NOW(), NOW())
       ON CONFLICT (property_id, provider) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         display_name = EXCLUDED.display_name,
         display_order = EXCLUDED.display_order,
         checkout_expiry_minutes = EXCLUDED.checkout_expiry_minutes,
         maintenance_message = EXCLUDED.maintenance_message,
         updated_at = NOW()`,
      [PROPERTY_ID],
    );
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  runDevelopmentSeed();
  await seedDemoRates();
  await seedCoupons();
  await seedPaymentProviders();
  process.stdout.write(`Demo seed applied.\n`);
  process.stdout.write(`  PROPERTY_ID     = ${PROPERTY_ID}\n`);
  process.stdout.write(`  COUPON_FIXED    = ${DEMO_COUPONS.FIXED}\n`);
  process.stdout.write(`  COUPON_PERCENT  = ${DEMO_COUPONS.PERCENT}\n`);
  process.stdout.write(`  COUPON_DISABLED = ${DEMO_COUPONS.DISABLED}\n`);
  process.stdout.write(`  PAYMENT_PROVIDERS = MOMO, VNPAY (enabled, simulator-backed)\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`demo-seed error: ${message}\n`);
  process.exitCode = 1;
});
