# Phase 8C — Payment Reconciliation Runbook

Audience: on-call engineers running the demo or supporting a live
trial.

## Trigger

This runbook is invoked when:

1. The reconciliation worker tick (`apps/worker`) reports an
   exception, fails to claim due attempts, or reports a non-zero
   error-code count for any of the new reconciliation categories.
2. ADMIN observes that a payment attempt is stuck in `PENDING`
   past the holding-policy window (default 15 minutes for a
   MoMo/VNPAY attempt) and the customer's browser is not
   redirecting.
3. An external report claims a duplicate confirmation, a
   cross-provider race, or a coupon was redeemed twice.
4. The Gate B.1 cryptographic-conformance test fails a build.
5. The cross-provider race-matrix scenarios fail.

## Step 1 — Confirm the schema version

```bash
node scripts/demo/preflight.mjs | jq .schema
# expected output: "phase-8c-payment-reconciliation-v1"
```

If the output does not contain the expected version, stop. The
migration `0017_optimal_freak.sql` has not been applied. Apply the
migration with `pnpm db:migrate` against the disposable database
before applying it to production.

## Step 2 — Confirm the API health and reconciliation tick

```bash
curl http://127.0.0.1:3101/api/v1/health/live
curl http://127.0.0.1:3101/api/v1/health/ready
```

Both must return 200. If `/health/ready` fails with a `DATABASE_*`
error, check the database pool and restart the API.

```bash
# Worker tick health check.
pgrep -af 'apps/worker/dist' || echo 'worker not running'
```

If the worker is not running, start it with the existing
`WORKER_MODE=continuous` and the new `WORKER_RECONCILIATION_*`
placeholders from `.env.example`. Values outside the documented
bounds throw `RangeError` before any database write.

## Step 3 — Confirm the reconciliation columns

```bash
psql "$TEST_DATABASE_URL" -c "\d payment_attempts" | \
  grep -E 'reconciliation|last_reconciled|last_error|lease_'
```

Expected columns:

- `reconciliation_attempt_count integer NOT NULL DEFAULT 0`
- `next_reconciliation_at timestamptz`
- `last_reconciled_at timestamptz`
- `last_error_code text`
- `lease_owner text`
- `lease_expires_at timestamptz`

Expected CHECK constraints:

- `payment_attempts_reconciliation_attempt_count_ck`
- `payment_attempts_reconciliation_lease_ck`
- `payment_attempts_reconciliation_error_ck`

If any column or constraint is missing, the migration has regressed.
Restore from the backup taken before applying migration
`0017_optimal_freak.sql`, then re-apply the migration in a
maintenance window.

## Step 4 — Inspect stuck PENDING attempts

```bash
psql "$DATABASE_URL" <<'SQL'
SELECT id, provider, provider_order_id, status,
       reconciliation_attempt_count,
       next_reconciliation_at,
       last_reconciled_at,
       last_error_code,
       lease_owner,
       lease_expires_at
  FROM payment_attempts
 WHERE status = 'PENDING'
   AND created_at < now() - INTERVAL '15 minutes'
 ORDER BY created_at ASC
 LIMIT 50;
SQL
```

Expected observations:

- `reconciliation_attempt_count >= 1` for any attempt that has been
  pending longer than one worker tick.
- `last_error_code` is one of the canonical provider categories
  (`PROVIDER_TIMEOUT`, `PROVIDER_UNREACHABLE`,
  `PROVIDER_INVALID_RESPONSE`, `PROVIDER_PAYLOAD_INVALID`,
  `PROVIDER_CONFIRMED_FAILED`, `PROVIDER_CONFIRMED_EXPIRED`,
  `PROVIDER_CONFIRMED_CANCELLED`, `PROVIDER_NOT_FOUND`,
  `STALE_FAILURE_PROTECTED`, `PERMANENT_*`,
  `TRANSIENT_RETRY_EXHAUSTED`, `LEASE_LOST`).
- No row should carry a secret or signature in any column.

## Step 5 — Manually advance a stuck attempt

Do NOT bypass `applyVerifiedPaymentEvent`. The only safe manual
intervention is to **resolve** the operational review that the
reconciliation cycle opens for an exhausted attempt:

```bash
# Find the operational review.
psql "$DATABASE_URL" <<'SQL'
SELECT id, opened_reason, opened_at, status
  FROM operational_reviews
 WHERE category IN (
   'RECONCILIATION_EXHAUSTED',
   'RECONCILIATION_TRANSIENT',
   'RECONCILIATION_NOT_FOUND',
   'RECONCILIATION_STALE_FAILURE',
   'CROSS_PROVIDER_TRANSACTION_CONFLICT',
   'PAID_CANCELLATION'
 )
   AND status = 'OPEN'
 ORDER BY opened_at ASC
 LIMIT 50;
SQL
```

Use the ADMIN web UI or the existing
`POST /api/v1/admin/operational-reviews/:reviewId/resolve` endpoint
to resolve. Do NOT write a new settlement from a manual UI path.

## Step 6 — Roll back

1. Stop the API and the worker.
2. Disable the reconciliation tick (the worker drops the
   `runReconciliationCycle` invocation while leaving the rest of the
   outbox and HOLD-expiry jobs running).
3. Revert the commit that introduced
   `packages/booking/src/payment/reconciliation.ts`,
   `apps/worker/src/reconciliation/`,
   `apps/api/src/payment/providers/momo/momo.contracts.ts`
   (the `momoQueryResponseSchema` addition),
   `apps/api/src/payment/providers/momo/momo.signature.ts`
   (the `buildMomoQueryCanonicalString` addition), and the
   `momo.errors.ts` query-error types.
4. Roll back migration `0017_optimal_freak.sql` (drop the new
   CHECKs, drop `payments_property_booking_uq`, drop the new
   index, drop the new `payment_attempts` columns).
5. Restart the API and the worker. Settlement continues to function
   via IPN only; `MOMO_INITIATION_OUTCOME_UNKNOWN` attempts remain
   `REVIEW_REQUIRED` until a manual status query from the ADMIN UI.

## Step 7 — Communication

Notify the project lead with the runbook step that failed and the
captured output. Do not attempt further remediations without
coordinating with the payments squad.

## External blockers (do not pretend otherwise)

- `MOMO_SANDBOX_ACCEPTANCE` and `VNPAY_SANDBOX_ACCEPTANCE` are
  `EXTERNAL_BLOCKED` until merchant credentials and a registered
  public HTTPS callback URL are present.
- `MOMO_PRODUCTION_ACCEPTANCE` and `VNPAY_PRODUCTION_ACCEPTANCE`
  are `EXTERNAL_BLOCKED` until the production merchant credentials,
  provider-side return-URL configuration, and IP allowlist (if
  applicable) are present.
- The two open Phase 8A gaps (`PAYMENT-002` VNPAY space encoding,
  `PAYMENT-003` VNPAY amount scaling ×100) cannot be settled
  without live sandbox.

The reconciliation cycle runs against the deterministic settlement
core; it does not require live sandbox to operate correctly, but
the live-acceptance gates above remain `EXTERNAL_BLOCKED` and will
be re-opened in Phase 8D.
