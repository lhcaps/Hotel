# Phase 7C Payment Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the provider-independent, PostgreSQL-authoritative payment core that records attempts and verified provider events, safely settles a valid HOLD, and never implements a provider adapter or browser payment flow.

**Architecture:** `@room/database` owns the three payment tables, enum vocabulary and forward-only migration; `@room/booking` owns the payment state machine, row-locking transaction and coupon/inventory settlement calls. `apps/api/src/payment` is a controller-free composition module for those internal services only. Future MoMo/VNPAY adapters implement one narrow port and deliver a typed, already-verified event to the settlement service; no raw HTTP request reaches it in 7C.

**Tech Stack:** TypeScript 5.9, PostgreSQL 18, Drizzle ORM, NestJS 11, Vitest 4, `pg` real disposable-database concurrency tests.

## Global Constraints

- PostgreSQL, not Redis, is authoritative for payment, confirmation, coupon redemption and idempotency.
- Persist only `MOMO` and `VNPAY`; never add a `TEST` provider, provider SDK, credential, raw body, signature, header or browser endpoint.
- VND is the sole currency; all amounts are safe integer VND, copied from `bookings.final_amount_vnd` inside the transaction.
- Lock in this order whenever rows coexist: booking, payment, payment attempt, booking coupon application, inventory block.
- The browser return URL has display-only authority; no 7C route or query parameter may mutate payment, booking, coupon or inventory state.
- Preserve migrations `0000` through `0011` byte-for-byte; use the sole new additive `0012` migration and update schema status to `phase-7c-payment-core-v1`.
- Payment success, booking confirmation, coupon redemption, audit and `payment.succeeded` / `booking.confirmed` outbox records must share one transaction.
- No direct shared/persistent database DDL, no port-3001 changes, no push/PR/deploy/refund/provider work; future credentials are environment/secrets-manager owned only.

---

## File Ownership Map

| Area              | Files                                                                                                                                                                      | Responsibility                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Schema            | `packages/database/src/schema.ts`, `packages/database/drizzle/0012_phase7c_payment_core.sql`, `packages/database/drizzle/meta/*`, `packages/database/src/schema-status.ts` | Enums, constraints, FK/uniqueness and schema version only.                                  |
| Database evidence | `packages/database/test/integration/phase7c-*.test.ts`, existing migration/lineage helpers                                                                                 | Fresh/upgrade migration, constraint and identity evidence.                                  |
| Payment domain    | Create `packages/booking/src/payment/{types,errors,adapter,payment-service}.ts`                                                                                            | Stable state vocabulary, adapter port, errors and single authoritative transaction service. |
| Payment tests     | Create `packages/booking/test/payment/*` and `packages/booking/test/concurrency/payment-*.test.ts`                                                                         | Unit, integration and real two-connection race evidence.                                    |
| API composition   | Create `apps/api/src/payment/payment.module.ts`, update `apps/api/src/app.module.ts`                                                                                       | Internal DI only; no controller, route or environment secret.                               |
| Documentation     | Existing domain/ADR/readiness docs plus `docs/handoffs/phase-7c-payment-core.md`                                                                                           | Truthful policy, lock order, deferred adapter work and evidence.                            |

## State and Data Contract

```ts
type PaymentProvider = 'MOMO' | 'VNPAY';
type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'REVIEW_REQUIRED' | 'CANCELLED' | 'EXPIRED';
type PaymentAttemptStatus =
  'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REVIEW_REQUIRED';
type PaymentEventProcessingStatus = 'PROCESSED' | 'DUPLICATE' | 'REJECTED' | 'REVIEW_REQUIRED';
type PaymentNormalizedOutcome = 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
type PaymentConfirmationSource = 'PROVIDER_EVENT' | 'NO_CHARGE';
```

`payments` is one aggregate per `(property_id, booking_id)` with immutable `amount_vnd` copied from the booking. `payment_attempts` has unique `(payment_id, idempotency_key)`, provider/order identity and partial provider/transaction identity. `payment_provider_events` has unique `(provider, event_key)`, a 32-byte body digest and normalized evidence only. Cross-table proof (for example, a provider-event success having a successful attempt) is enforced in the service transaction, not an invalid table `CHECK`.

### Task 1: Add the forward-only payment schema

**Files:**

- Modify: `packages/database/src/schema.ts`, `packages/database/src/schema-status.ts`
- Create: `packages/database/drizzle/0012_phase7c_payment_core.sql` and its generated Drizzle metadata/snapshot
- Test: `packages/database/test/integration/phase7c-payment-schema.test.ts`, `packages/database/test/integration/phase7c-migration.test.ts`

**Interfaces:** Produces `payments`, `paymentAttempts`, `paymentProviderEvents`, and the six exported payment enums for `@room/booking`; exports expected schema version `phase-7c-payment-core-v1`.

- [ ] **Step 1: Write failing migration/schema tests**

```ts
it('permits exactly one VND payment per property-consistent booking', async () => {
  await seedBooking(database.pool);
  await insertPayment(database.pool, booking);
  await expect(insertPayment(database.pool, booking)).rejects.toMatchObject({ code: '23505' });
});

it('rejects a provider event whose raw body digest is not 32 bytes', async () => {
  await expect(
    insertProviderEvent(database.pool, { rawBodyDigest: Buffer.alloc(31) }),
  ).rejects.toMatchObject({ code: '23514' });
});
```

These tests catch removal of the booking/payment uniqueness or digest constraint; fixture expectations use literal VND values and a real disposable PostgreSQL database.

- [ ] **Step 2: Run tests and observe the expected RED failure**

Run: `pnpm --filter @room/database exec vitest run test/integration/phase7c-payment-schema.test.ts test/integration/phase7c-migration.test.ts`

Expected: fail because payment tables and `phase-7c-payment-core-v1` do not yet exist.

- [ ] **Step 3: Add minimal schema and generated migration**

```ts
export const paymentProvider = pgEnum('payment_provider', ['MOMO', 'VNPAY']);
export const paymentStatus = pgEnum('payment_status', [
  'PENDING',
  'SUCCEEDED',
  'REVIEW_REQUIRED',
  'CANCELLED',
  'EXPIRED',
]);
export const payments = pgTable('payments', {/* aggregate snapshot fields */}, (table) => [
  uniqueIndex('payments_booking_uq').on(table.bookingId),
  check('payments_currency_vnd_ck', sql`${table.currency} = 'VND'`),
]);
```

Generate only the next Drizzle migration, add DB constraints/FKs/indexes described above, and set the schema status constant. Do not alter released migration files, metadata entries, booking money or seed values.

- [ ] **Step 4: Run focused schema gates and verify GREEN**

Run: `pnpm db:check && pnpm --filter @room/database exec vitest run test/integration/phase7c-payment-schema.test.ts test/integration/phase7c-migration.test.ts`

Expected: all new tests pass; clean fresh and Phase-7B-upgrade test databases report `phase-7c-payment-core-v1`.

- [ ] **Step 5: Commit the independently valid schema deliverable**

```bash
git add packages/database
git commit -m "feat(database): add authoritative payment core schema"
```

### Task 2: Establish the internal adapter port and payment lifecycle primitives

**Files:**

- Create: `packages/booking/src/payment/types.ts`, `packages/booking/src/payment/errors.ts`, `packages/booking/src/payment/adapter.ts`, `packages/booking/src/payment/index.ts`
- Modify: `packages/booking/src/index.ts`
- Test: `packages/booking/test/payment/payment-types.test.ts`, `packages/booking/test/payment/payment-errors.test.ts`

**Interfaces:** Produces `PaymentProviderAdapter`, `VerifiedPaymentProviderEvent`, state-transition predicates and exported stable errors. Consumes only `@room/database` enums/types; it makes no network call and has no adapter implementation.

- [ ] **Step 1: Write failing domain tests**

```ts
it('rejects a non-success event that would downgrade a succeeded attempt', () => {
  expect(() => transitionAttempt('SUCCEEDED', 'FAILED')).toThrow(PaymentAlreadySettledError);
});

it('requires a 32-byte verified-event digest and VND amount facts', () => {
  expect(() => assertVerifiedEvent(validEvent({ currency: 'USD' }))).toThrow(
    PaymentCurrencyMismatchError,
  );
});
```

The first test catches removal of success terminality; the second catches accepting unnormalised/multi-currency evidence.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter @room/booking exec vitest run test/payment/payment-types.test.ts test/payment/payment-errors.test.ts`

Expected: fail because payment-domain exports do not exist.

- [ ] **Step 3: Implement only types, guards and the adapter declaration**

```ts
export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  createCheckout(request: CreateProviderCheckoutRequest): Promise<CreateProviderCheckoutResult>;
  verifyAndNormalizeWebhook(
    request: VerifyProviderWebhookRequest,
  ): Promise<VerifiedPaymentProviderEvent>;
}
```

Validate normalized event facts and expose only stable machine-code errors; never export an unsigned raw-body settlement function, provider registry, `TEST` provider or provider SDK binding.

- [ ] **Step 4: Run GREEN and mutation check**

Run: `pnpm --filter @room/booking exec vitest run test/payment/payment-types.test.ts test/payment/payment-errors.test.ts`

Expected: pass; manually mutate success terminality and VND guard once to confirm each test fails.

### Task 3: Create payment aggregates and attempts under the global lock order

**Files:**

- Create: `packages/booking/src/payment/payment-service.ts`
- Test: `packages/booking/test/payment/payment-creation.test.ts`, `packages/booking/test/concurrency/payment-creation-race.test.ts`

**Interfaces:** Produces `getOrCreatePaymentForBooking(input)`, `createPaymentAttempt(input)` and `confirmNoChargeBooking(input)`. Consumes existing booking/coupon repository functions and database client; returns typed aggregate/attempt records without a checkout URL.

- [ ] **Step 1: Write failing real-database tests**

```ts
it('copies a positive amount from the locked booking and makes the same idempotency key return one attempt', async () => {
  const first = await createPaymentAttempt({
    propertyId,
    bookingId,
    provider: 'MOMO',
    idempotencyKey: 'attempt-a',
    now,
  });
  const duplicate = await createPaymentAttempt({
    propertyId,
    bookingId,
    provider: 'MOMO',
    idempotencyKey: 'attempt-a',
    now,
  });
  expect(duplicate.id).toBe(first.id);
  expect(first.amountVnd).toBe(349000n);
});
```

Also write literal tests for conflicting idempotency/provider, cancelled/expired HOLD rejection, one aggregate under two connections, and zero-charge confirmation rejecting a positive booking.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter @room/booking exec node ../../scripts/with-local-env.mjs vitest run test/payment/payment-creation.test.ts test/concurrency/payment-creation-race.test.ts`

Expected: fail because service operations are absent.

- [ ] **Step 3: Implement the minimal authoritative creation operations**

```ts
await db.transaction(async (tx) => {
  const booking = await lockBookingForPayment(tx, input.propertyId, input.bookingId);
  const payment = await lockOrInsertPayment(tx, booking);
  return insertOrReturnAttempt(tx, payment, input);
});
```

Generate provider-order IDs server-side, lock booking then payment then attempt, copy persisted booking/payment values, and make no external call. `confirmNoChargeBooking` uses the same locks, only permits a zero amount and commits payment/booking/coupon/audit/outbox together.

- [ ] **Step 4: Run GREEN**

Run: `pnpm --filter @room/booking exec node ../../scripts/with-local-env.mjs vitest run test/payment/payment-creation.test.ts test/concurrency/payment-creation-race.test.ts`

Expected: pass with inspected final rows proving one aggregate/attempt and no provider attempt for zero charge.

- [ ] **Step 5: Commit lifecycle creation**

```bash
git add packages/booking
git commit -m "feat(api): add payment aggregate and attempt lifecycle"
```

### Task 4: Apply verified events and settle valid HOLDs atomically

**Files:**

- Modify: `packages/booking/src/payment/payment-service.ts`, `packages/booking/src/payment/index.ts`
- Test: `packages/booking/test/payment/payment-settlement.test.ts`, `packages/booking/test/payment/payment-event-idempotency.test.ts`
- Create: `apps/api/src/payment/payment.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/payment/payment.module.test.ts`

**Interfaces:** Produces `applyVerifiedPaymentEvent(event)` and controller-free `PaymentModule`. It consumes a `VerifiedPaymentProviderEvent` only after adapter verification; no Nest controller, HTTP endpoint or secrets are added.

- [ ] **Step 1: Write failing settlement tests**

```ts
it('settles one verified event atomically', async () => {
  await applyVerifiedPaymentEvent(successEvent);
  await expectPaymentBookingCouponAndOutbox(fixture.pool, {
    payment: 'SUCCEEDED',
    booking: 'CONFIRMED',
    coupon: 'REDEEMED',
    outboxTypes: ['payment.succeeded', 'booking.confirmed'],
  });
});
```

Add independent tests for no coupon, failed/cancelled/expired attempts, same event key, same transaction under a new event key, amount/currency/order mismatch, released coupon/inventory, expired/cancelled booking and a second successful attempt.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter @room/booking exec node ../../scripts/with-local-env.mjs vitest run test/payment/payment-settlement.test.ts test/payment/payment-event-idempotency.test.ts`

Expected: fail because verified-event settlement is not implemented.

- [ ] **Step 3: Implement one settlement transaction**

```ts
await db.transaction(async (tx) => {
  const event = await insertOrFindProviderEvent(tx, input);
  const { booking, payment, attempt } = await lockSettlementRows(tx, event);
  return input.normalizedOutcome === 'SUCCEEDED'
    ? settleOrRecordReview(tx, { event, booking, payment, attempt })
    : recordVerifiedNonSuccess(tx, { event, payment, attempt });
});
```

On valid success: verify order/transaction/amount/currency/HOLD/expiry/inventory/coupon, transition attempt and payment, confirm booking, redeem coupon with stable event identity, retain inventory and write audit/outbox. On every mismatch, late or double-success path: retain normalized event, record stable review code, never resurrect/redeem/duplicate. Non-success cannot downgrade success.

- [ ] **Step 4: Add internal API composition and run GREEN**

Run: `pnpm --filter @room/booking exec node ../../scripts/with-local-env.mjs vitest run test/payment/payment-settlement.test.ts test/payment/payment-event-idempotency.test.ts && pnpm --filter @room/api exec vitest run test/payment/payment.module.test.ts`

Expected: pass with zero public payment controllers/routes and atomic final-state assertions.

- [ ] **Step 5: Commit settlement**

```bash
git add packages/booking apps/api
git commit -m "feat(api): settle verified payments atomically"
```

### Task 5: Prove races, migration compatibility and prohibited authority paths

**Files:**

- Create: `packages/booking/test/concurrency/payment-expiry-race.test.ts`, `packages/booking/test/concurrency/payment-success-races.test.ts`
- Modify: `packages/database/test/integration/historical-migration-identity.test.ts` only if it needs the new expected migration boundary
- Test: `apps/api/test/payment/payment-boundary.test.ts`

**Interfaces:** Test-only typed verified-event factories live under test directories; production keeps no test provider or test-only route.

- [ ] **Step 1: Write failing two-connection and boundary tests**

```ts
it('leaves exactly one valid terminal outcome when expiry and verified success race', async () => {
  const [settlement, expiry] = await Promise.allSettled([
    settleSuccess(),
    expireStaleHolds(options),
  ]);
  await expectValidExpiryRaceState(pool, bookingId);
});
```

Write real-PG tests for duplicate event, same transaction/new event key, two successful attempts, concurrent successes, success/cancellation dominance, duplicate aggregate and attempt creation. Boundary test must prove `AppModule` contains no payment controller and no browser return route mutates state.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter @room/booking exec node ../../scripts/with-local-env.mjs vitest run test/concurrency/payment-expiry-race.test.ts test/concurrency/payment-success-races.test.ts`

Expected: fail until the service preserves every allowed final state.

- [ ] **Step 3: Make only race-driven corrections**

Correct lock ordering, idempotent insert/find and review classification in the existing service; do not add a retrying provider, raw-webhook controller or a second messaging system.

- [ ] **Step 4: Run GREEN with inspected terminal rows**

Run: `pnpm --filter @room/booking exec node ../../scripts/with-local-env.mjs vitest run test/concurrency/payment-expiry-race.test.ts test/concurrency/payment-success-races.test.ts && pnpm --filter @room/api exec vitest run test/payment/payment-boundary.test.ts`

Expected: no deadlock, exactly one inspected booking/payment/coupon/inventory/outbox result per race, and no public mutation route.

- [ ] **Step 5: Commit concurrency evidence**

```bash
git add packages/booking packages/database apps/api
git commit -m "test(payment): verify idempotency and settlement races"
```

### Task 6: Reconcile authoritative documentation and perform final evidence run

**Files:**

- Modify: `docs/domain/booking-state-machine.md`, `docs/domain/coupon-rules.md`, `docs/domain/business-invariants.md`, `docs/architecture/adr/ADR-0004-payment-adapter.md`, `docs/audit/project-production-readiness-reconciliation.md`
- Create: `docs/handoffs/phase-7c-payment-core.md`

**Interfaces:** Documents Phase 7C only: no real adapter, no credentials, no checkout UI, no merchant configuration, production readiness remains `NO`, and next phase is precisely 7D MoMo sandbox adapter.

- [ ] **Step 1: Write documentation acceptance checklist before editing**

```text
Must state: separate state machines; verified-only event boundary; lock order;
event/idempotency uniqueness; late and second success review; zero charge;
coupon redemption/outbox/audit; return URL non-authority; no refund; no adapter.
```

- [ ] **Step 2: Update the authoritative docs and handoff**

Use the checklist to update only existing source-of-truth documents. Correct old roadmap wording so 7D/7E/7F/7G follow the merchant-ownership addendum; do not claim provider readiness beyond `CORE_READY_FOR_ADAPTER` or production readiness beyond `NO`.

- [ ] **Step 3: Run focused and full validation**

Run: `pnpm --filter @room/database lint && pnpm --filter @room/database typecheck && pnpm --filter @room/database test:unit && pnpm --filter @room/database test:integration && pnpm --filter @room/database build && pnpm --filter @room/booking lint && pnpm --filter @room/booking typecheck && pnpm --filter @room/booking test:unit && pnpm --filter @room/booking build && pnpm --filter @room/api lint && pnpm --filter @room/api typecheck && pnpm --filter @room/api test:unit && pnpm --filter @room/api test:integration && pnpm --filter @room/api build && pnpm --filter @room/worker lint && pnpm --filter @room/worker typecheck && pnpm --filter @room/worker test:unit && pnpm --filter @room/worker build && pnpm check:openapi && pnpm db:check && pnpm db:status && pnpm lint && pnpm typecheck && pnpm test:unit && pnpm build && node scripts/run-playwright.mjs && pnpm demo:preflight && pnpm demo:lifecycle-test && pnpm audit --prod --audit-level=high`

Expected: all project gates green, new schema status, browser regression no payment UI, demo lifecycle stable, zero high advisories.

- [ ] **Step 4: Verify migration identity, ports and final tree**

```bash
git diff --exit-code 95a743a -- packages/database/drizzle/0000_silly_jocasta.sql packages/database/drizzle/0001_custom_invariants.sql packages/database/drizzle/0002_tiny_ultragirl.sql packages/database/drizzle/0003_gorgeous_punisher.sql packages/database/drizzle/0004_natural_paper_doll.sql packages/database/drizzle/0005_ambiguous_blazing_skull.sql packages/database/drizzle/0006_phase5_custom_invariants.sql packages/database/drizzle/0007_phase6_coupon_core.sql packages/database/drizzle/0008_phase6_coupon_invariants.sql packages/database/drizzle/0009_swift_polaris.sql packages/database/drizzle/0010_phase6_coupon_reference_closure.sql packages/database/drizzle/0011_phase7b_data_driven_pricing.sql
git diff --check
git status --short
```

Record the untouched port-3001 PID and verify ports 3100/3101 are released; never terminate an unowned process.

- [ ] **Step 5: Commit documentation and produce the evidence-based handoff**

```bash
git add docs
git commit -m "docs: close phase 7c payment core"
```

## Self-Review

- **Spec coverage:** Tasks 1–5 cover aggregate/attempt/event schema, provider port, amount/currency ownership, creation, no-charge, verified settlement, non-success, mismatch, late/duplicate success, coupon/inventory/audit/outbox and all requested real-PG races. Task 6 covers all listed authoritative documents, migration identity, demo, root gates and final deferrals.
- **Mismatch/terminal paths:** `AMOUNT_MISMATCH`, `CURRENCY_MISMATCH`, `PROVIDER_ORDER_MISMATCH`, `TRANSACTION_CONFLICT`, `BOOKING_EXPIRED`, `BOOKING_CANCELLED`, `INVENTORY_RELEASED`, `COUPON_RELEASED` and `DUPLICATE_SUCCESSFUL_PAYMENT` are review paths in Task 4; no path auto-settles them.
- **Zero/late/double success:** Task 3 has the no-charge transaction; Tasks 4–5 independently assert late success and second success review outcomes.
- **Migration policy:** only Task 1 creates 0012 and metadata; Task 6 proves 0000–0011 untouched.
- **No speculative abstraction:** the single adapter interface contains only the two known provider operations; there is no registry, SDK, credential model, merchant configuration, public route or UI.
- **Type consistency:** the stable vocabulary is defined before all service tasks; later tasks use `VerifiedPaymentProviderEvent`, `PaymentProviderAdapter`, and the exact service names introduced in Tasks 2–4.
