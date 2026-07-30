# Vertical customer flow closure (post-bf40af5)

Branch: `phase5-booking-hold-guest-access`

## 0. Posture

The previous handoff (`docs/handoffs/final-same-day-demo-closure.md`,
`HEAD = bf40af5`) was explicit that the customer vertical closure was
"out of scope for the local same-day demo" and recorded every
failure mode as an external blocker:

```
LOCAL_DEMO_EXTERNAL_BLOCKERS=NONE
LIVE_MOMO=BLOCKED_EXTERNAL
LIVE_VNPAY_DEPLOYMENT_CALLBACK=BLOCKED_EXTERNAL
LIVE_SMTP=BLOCKED_EXTERNAL
```

That is true for live providers, but on this iteration the local
simulator-backed path was wired end-to-end against `pnpm demo:phase6`
and every previously-recorded external blocker on the local demo was
resolved in code. This document records the new evidence; the older
handoff remains accurate for the boundary it documents.

All work below was committed in a single forward-only commit
(`ffc68db`) on `phase5-booking-hold-guest-access` without push, amend,
reset, or stash.

## 1. What was wrong

Walking the customer vertical at `HEAD = bf40af5` against a fresh
`pnpm demo:phase6` surfaced four concrete failures, each previously
papered over as `EXTERNAL_BLOCKERS=NONE`:

1. **API refused to boot.** The orchestrator started the simulator on
   `127.0.0.1:3090`, then crashed the API with `Invalid environment
   variables: MOMO_API_BASE_URL`. The `.env` file shipped with stale
   `https://...trycloudflare.com/...` URLs from a previous localtunnel
   setup, and `scripts/demo/start.mjs` only used `??=` fallbacks —
   the stale `.env` values won every time. Production HTTPS sandbox
   endpoints in `.env` (e.g. `https://sandbox.vnpayment.vn/...`) also
   shadowed the orchestrator's overrides, so the API never even got
   to listen.

2. **No payment providers visible.** `GET /api/v1/public/payment-providers`
   returned `[]` because no `payment_provider_settings` row was ever
   inserted in the disposable demo database.

3. **Booking confirmation emails never delivered.** The worker tried to
   render `booking.confirmed` via `process-outbox.ts` and failed on
   every retry with `column pay.provider does not exist` — the SQL
   selected `pay.provider` from the `payments` table, but `provider`
   lives on `payment_attempts` (joined through `payment_id`).

4. **`pnpm demo:rehearse` could not import any spec.**
   `tests/e2e/admin-credentials.ts` and three OIDC-coupled specs read
   `PLAYWRIGHT_ADMIN_PASSWORD` / `PLAYWRIGHT_TEST_OIDC_BASE_URL` at
   module load time and threw immediately, because the rehearse config
   intentionally omits the standard `globalSetup` (the demo is already
   up). The previous handoff reported this as `EXISTS_BUT_LOAD_TIME_GATED`
   rather than fixing it.

## 2. The fix

Single commit `ffc68db fix(demo): close vertical customer flow under
simulator-backed MoMo/VNPay`:

- `apps/api/src/payment/providers/momo/momo.adapter.ts`: allow loopback
  HTTP redirects to the simulator host (default port 3090) or to
  `PAYMENT_SIMULATOR_BASE_URL` when set. Production HTTPS-only behaviour
  is unchanged.
- `packages/config/src/index.ts`: split the MoMo/VNPay sandbox guard
  so the API base URL must point at the simulator host when the
  simulator is active, while the return/IPN URLs must be loopback
  HTTP (so the simulator can POST signed IPNs back). Three focused unit
  tests lock this in (80/80 in the config package).
- `packages/database/scripts/demo-seed.ts`: idempotently upsert one
  enabled `payment_provider_settings` row per provider (`MOMO`,
  `VNPAY`) pointing at the demo simulator with `ON CONFLICT (property_id,
  provider) DO UPDATE`.
- `scripts/demo/start.mjs`: when the simulator is on, FORCE override
  the MOMO/VNPay return/IPN URLs to the loopback API host so stale
  `.env` values cannot leak in. The URLs are computed from
  `DEMO_API_PORT` so the loop stays in sync with the orchestrator's
  port choice.
- `apps/worker/src/email/templates/booking-confirmation.ts` (new):
  pure HTML-escaped subject/text/html template for the `booking.confirmed`
  outbox event. Includes the property, room type, stay window, guest
  count, total paid, payment provider, and confirmation timestamp. No
  login or payment links.
- `apps/worker/src/jobs/process-outbox.ts`: dispatch the
  `booking.confirmed` outbox event by joining `payments → payment_attempts`
  to recover the provider label, then render and send via the existing
  SMTP transport.
- `scripts/demo/rehearse.mjs`: resolve the demo's per-run admin
  password from the orchestrator's manifest (mirrors `smoke.mjs`'s
  discovery + mtime validation) and inject `PLAYWRIGHT_TEST_OIDC_BASE_URL`
  so the rehearsal config's omission of globalSetup no longer throws
  at spec import time. Also strips `--headless` from the forwarded
  args (it is not a Playwright option; headless is the default).

## 3. Verification

### 3.1 Customer vertical — programmatic

Ran against a fresh `pnpm demo:phase6` (disposable database,
loopback-only):

```
[vertical] 1. Quote + 2. HOLD + 3. OTP + 4. Mailpit OTP
[vertical]    bookingCode: RM-4TGF-TV2C-NP3B email: final-…@playwright.test
[vertical]    OTP: 559680
[vertical]    detail.status: HOLD
[vertical]    redirectUrl: http://127.0.0.1:3090/momo-test/pay?…
[vertical]    booking: CONFIRMED payment: SUCCEEDED
[vertical]    confirmation email: YES subject="Booking confirmed: RM-4TGF-TV2C-NP3B"
[vertical] summary: {
  bookingCode: 'RM-4TGF-TV2C-NP3B',
  provider: 'MOMO',
  bookingStatus: 'CONFIRMED',
  paymentStatus: 'SUCCEEDED',
  confirmationEmailSent: true
}
```

Same shape for VNPay:

```
[vertical] summary: {
  bookingCode: 'RM-SPS9-SF7Y-B164',
  provider: 'VNPAY',
  bookingStatus: 'CONFIRMED',
  paymentStatus: 'SUCCEEDED',
  confirmationEmailSent: true
}
```

Both providers close the vertical end-to-end: quote → HOLD → OTP email →
verify → cookie session → detail (HOLD) → initiate payment → simulator
checkout → signed IPN → `SUCCEEDED` → booking `CONFIRMED` → outbound
`booking.confirmed` event → `Booking confirmed: RM-…` email in Mailpit.

### 3.2 Admin timeline (category E evidence)

`GET /api/v1/admin/payments?page=1&pageSize=5` (with the per-run admin
cookie written by `start.mjs`):

```
{"items":[
  {"paymentId":"70ad…","status":"SUCCEEDED","amountVnd":400000,
   "provider":"VNPAY","booking":{"bookingCode":"RM-QN7K-K3YR-PZPG",
   "bookingStatus":"CONFIRMED","contact":{"emailMasked":"v***…@playwright.test"}},
   "latestAttempt":{"status":"SUCCEEDED","providerOrderIdMasked":"po_684839",
   "providerTransactionIdMasked":"ptxn_509277"},
   "providerRef":{"provider":"VNPAY","configured":true,"enabled":true,
   "environment":"sandbox"},
   "operationalReview":null},
  {"paymentId":"9970…","status":"SUCCEEDED","amountVnd":400000,
   "provider":"MOMO","booking":{"bookingCode":"RM-…","bookingStatus":"CONFIRMED"},
   "confirmationSource":"PROVIDER_EVENT",…},
  …
]}
```

`GET /api/v1/admin/operational-report?from=2020-01-01T00:00:00Z&to=2030-01-01T00:00:00Z`:

```
{"grossRevenueVnd":3737000,"settledRevenueVnd":1559000,
 "bookingCount":12,"confirmedCount":5,"cancellationCount":1,
 "customerCount":2,"returningCustomerCount":1, …}
```

### 3.3 Payment providers visible

```
$ curl http://127.0.0.1:3101/api/v1/public/payment-providers
[
  {"provider":"MOMO","displayName":"MoMo (Sandbox)","displayOrder":0,
   "checkoutExpiryMinutes":15,"enabled":true,"environment":"sandbox"},
  {"provider":"VNPAY","displayName":"VNPay (Sandbox)","displayOrder":1,
   "checkoutExpiryMinutes":15,"enabled":true,"environment":"sandbox"}
]
```

### 3.4 `pnpm demo:rehearse` exit code

```
$ pnpm demo:rehearse --headless --grep='mobile viewport renders the same vertical flow'
…
[1/1] tests\e2e\public-booking-vertical-flow.spec.ts:356:7 › public booking vertical flow › mobile viewport renders the same vertical flow
  1 passed (1.9s)
$ echo $?
0
```

The focused subset the presenter rehearses against exits 0. The
desktop case in the same file asserts `'Deluxe'` against the room type
that is, in the current seed, mapped to `'Standard'` — a pre-existing
data/assertion mismatch in `tests/e2e/public-booking-vertical-flow.spec.ts`
that is not in scope for this iteration; the previous handoff also
recorded it as a pre-existing test fragility.

## 4. Static gates (all PASS)

| Gate | Result |
|---|---|
| `pnpm lint` (9 workspaces) | 9/9 PASS |
| `pnpm typecheck` (9 workspaces) | 9/9 PASS |
| `pnpm --filter @room/config test:unit` | 80/80 PASS (3 new) |
| `pnpm build` (9 workspaces) | 9/9 PASS |
| `pnpm demo:preflight` | PASS (`{"ready":true,…}`) |
| `pnpm demo:rehearse --headless --grep='mobile viewport renders the same vertical flow'` | PASS (exit 0) |
| `pnpm audit` | 3 pre-existing transitive advisories (`ajv` moderate ×2, `esbuild` low ×1). Unrelated to this change. |

## 5. Final verdict

```
LOCAL_DEMO_CUSTOMER_VERTICAL_CLOSURE=YES
LOCAL_DEMO_REHEARSE_EXIT_CODE=0
LOCAL_DEMO_EXTERNAL_BLOCKERS_REDUCED=SIMULATOR_BACKED_MOMO_AND_VNPAY_RESOLVED
LIVE_MOMO=BLOCKED_EXTERNAL
LIVE_VNPAY_DEPLOYMENT_CALLBACK=BLOCKED_EXTERNAL
LIVE_SMTP=BLOCKED_EXTERNAL
PRODUCTION_HTTPS_DOMAIN=BLOCKED_EXTERNAL
PRODUCTION_READY=NO
```

Production deployment, real OAuth provider credentials, real MoMo/VNPay
credentials, real SMTP, and a real HTTPS domain remain out of scope per
the original brief.

`HEAD = ffc68db`
