# Runtime Product Parity Closure

Date: 2026-07-30
Branch: `phase5-booking-hold-guest-access`

## Committed History

- Starting SHA: `45391518a2c35b56962e98fcb52ca8a6c17d3455`
- Runtime repair: `f18fcbb2d6787069fd9ddf93b2301d1ec52644cc` — `fix(runtime): align loopback origins and public availability`
- Overnight eligibility: `7616a2f624b8d64c9e92a8fb3bc2fcd459244e94` — `fix(pricing): enforce correct overnight offer eligibility`
- Eligible-plan projection: `a4074a5` — `feat(web): expose eligible room plans and recommendations`
- Property-coherence regression: `a09142cd7e852761b5f4e9a2162a63fecf5551b8` — `test(api): prove public property coherence`
- Configuration-test lint correction: `072a886142ef7f375f6f64918ec85077a8b05179` — `test(config): satisfy loopback origin lint`

The final documentation commit is recorded below after its committed-head validation. No history was amended, reset, stashed, pushed, or deployed.

## Runtime Repair

`CORS_LOOPBACK_ALIAS=PASS`
`CORS_PRODUCTION_WIDENING=0`
`BETTER_AUTH_TRUSTED_ORIGIN_PARITY=PASS`

A shared `loopbackOriginAlias` permits only `http://localhost:<configured-port>` and `http://127.0.0.1:<same-port>` as equivalent local development/test origins. It preserves the port, does not accept another port, wildcard, production hostname, or HTTPS origin, and is used by both Fastify CORS and Better Auth trusted origins. The API preflight regression proves the equivalent origin is accepted with credentials and `127.0.0.1:3001`, non-loopback, and HTTPS origins are not echoed.

`FE_BE_REQUEST_PARITY=PASS`
`FE_BE_RESPONSE_PARITY=PASS`
`TIMEZONE_INTERVAL_PARITY=PASS`

Web `mode` remains URL-only state; the API receives only offset-bearing `checkIn` and `checkOut`, occupancy fields, and shared Zod validation. The Web parses the public availability response and contains no client-side availability, price, or plan-eligibility calculation.

## Availability and Property Coherence

`REAL_ROOM_RESULTS=PASS`
`REAL_SERVER_PRICE=PASS`
`PUBLIC_PHYSICAL_ROOM_LEAKS=0`
`PUBLIC_PROPERTY_SELECTION=DETERMINISTIC`
`PUBLIC_PROPERTY_RELATIONSHIPS=COHERENT`
`CROSS_PROPERTY_DATA_MIXING=0`

Public repositories select the earliest created active property, with ID as a deterministic tie-breaker. Availability, quotes, recommendation availability, and coupon context all require an active property. Every public catalog query is constrained by that same property ID; schema composite foreign keys bind a room type to a price tier of the same property. The integration regression creates a second active property with distinct tier, room type, room, rate plan, and price, and proves none of that data appears in the selected public result.

Availability is server-side and bounded to a constant batch of property-scoped queries: room types without physical rooms, exhausted/blocked room types, and room types without an active complete eligible offer are excluded from purchasable public results. Available room types return only aggregate counts and authoritative offers; room IDs and numbers are never serialized.

## Overnight Pricing

Sanitized trace:

```text
MODE=overnight
CHECK_IN=2027-01-10T11:00:00+07:00
CHECK_OUT=2027-01-10T16:15:00+07:00
DURATION_MINUTES=315
ELIGIBLE_PLAN_CODES=NIGHT_COMBO
SELECTED_BEST_PLAN=NIGHT_COMBO
SELECTION_REASON=server eligibility filters the five-hour plan outside its 00:00–18:00 check-in window; cheapest ordering only applies after eligibility.
```

`OVERNIGHT_ELIGIBLE_PLANS=DOMAIN_CORRECT`
`OVERNIGHT_SELECTED_PLAN=DOMAIN_CORRECT`
`OVERNIGHT_FIVE_HOUR_ACCIDENTAL_FALLBACK=0`

Root cause: `FIVE_HOUR_COMBO` had an unbounded day window, and `NIGHT_COMBO` required 315 minutes, allowing the cheapest five-hour fallback for overnight intervals. The server-owned seed/catalog correction makes five-hour valid only from 00:00 through 18:00 and makes the night plan eligible from 18:00 for durations of at least 300 minutes. Regression coverage was written before this correction. `mode` is not a backend pricing input.

## Customer Plan Matrix

| Plan               | Status | Tier prices | Window       | Duration       | Priority | Hourly                 | Overnight                      | Public behavior                                |
| ------------------ | ------ | ----------- | ------------ | -------------- | -------: | ---------------------- | ------------------------------ | ---------------------------------------------- |
| `THREE_HOUR_COMBO` | ACTIVE | complete    | unrestricted | 60–240 min     |       60 | eligible               | no                             | best offer / selector / quote / recommendation |
| `FIVE_HOUR_COMBO`  | ACTIVE | complete    | 00:00–18:00  | 255–960 min    |       70 | eligible               | no after 18:00                 | best offer / selector / quote / recommendation |
| `LUNCH_COMBO`      | ACTIVE | complete    | 11:00–15:00  | 60–960 min     |       80 | eligible in window     | no                             | selector / quote / recommendation              |
| `NIGHT_COMBO`      | ACTIVE | complete    | 18:00–24:00  | 300–960 min    |       90 | eligible in window     | eligible                       | best offer / selector / quote / recommendation |
| `DAY_COMBO`        | ACTIVE | complete    | unrestricted | 975–1440 min   |      100 | eligible               | eligible when duration matches | selector / quote / recommendation              |
| `EXTRA_HOUR`       | ACTIVE | complete    | unrestricted | component only |       10 | calculated server-side | calculated server-side         | quote breakdown only                           |

`LANDING_BEST_OFFER=PASS`
`ROOM_DETAIL_ALL_ELIGIBLE_PLANS=PASS`
`INACTIVE_PLAN_PURCHASABLE=0`
`PRICE_INCOMPLETE_PLAN_PURCHASABLE=0`

The landing keeps the aggregate room result and server-selected best offer concise. Room detail calls `POST /api/v1/quotes/offers`, a read-only server-computed projection that creates no quote, HOLD, booking, or payment. It renders validated eligible offers with localized plan labels, authoritative totals, included duration, selected state, loading, empty, malformed-response, and retry states. A selected eligible plan is sent back to quote issuance and the API rejects an ineligible selected plan. `EXTRA_HOUR` is not rendered as an independent room package.

## Recommendation, Hold, Payment, and CTAs

`RECOMMENDATION_ENDPOINT_RUNTIME=PASS`
`RECOMMENDATION_UI_RUNTIME=PASS`
`RECOMMENDATION_FRESH_QUOTE=PASS`
`RECOMMENDATION_SIDE_EFFECTS=0`
`COMPLETE_BOOKING_CONTINUATION=PASS`
`HOLD_RUNTIME=PASS`
`PAYMENT_READINESS_RUNTIME=PASS`
`DEAD_PUBLIC_ACTIONS=0`
`DEAD_CUSTOMER_ACTIONS=0`

The recommendation endpoint uses the authoritative PostgreSQL pricing catalog and availability probe, returns either candidates or its explicit no-better-option state, and has no persistence side effect. Applying a candidate issues a new quote; the prior quote remains immutable. Existing API integration and browser coverage exercise quote-to-HOLD, countdown, guest OTP, cookie session, booking detail, logout, payment provider state, and safe unavailable state. The browser suite covers public search, room detail, quote, hold, booking management, login/account/settings, and admin/customer navigation. Physical room allocation occurs only during server-side HOLD processing; public payloads do not expose physical room identity. Countdown is informational and HOLD expiry is database-authoritative. Payment return routes do not settle payments; signed provider webhook processing remains authoritative.

Provider readiness is server-owned. MoMo UI actions are disabled when its credentials are absent. VNPAY readiness reflects its configured environment and integration tests cover authoritative signed settlement.

## Committed-Head Validation

Before the final documentation commit, the following ran successfully on committed functional head `072a886142ef7f375f6f64918ec85077a8b05179`:

- `pnpm check:providers`, `pnpm check:features`, `pnpm check:google-oauth`, `pnpm check:i18n-critical`, `pnpm check:endpoints`, `pnpm check:openapi`
- `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` — 15 tasks; API: 56 files / 310 tests
- `pnpm build`
- `pnpm db:check`, `pnpm db:status`, `pnpm db:test` — 22 files / 165 tests
- `pnpm audit --prod --audit-level=high` — no high severity findings; 1 low and 2 moderate findings reported
- `pnpm demo:preflight`, `pnpm demo:lifecycle-test` — 15/15, `pnpm demo:smoke` — 15/15
- `pnpm test:e2e` run 1 — 73 primary + 1 unavailable-state test passed
- `pnpm test:e2e` run 2 — 73 primary + 1 unavailable-state test passed

Final committed-head results are appended after this document commit.

## External Boundaries

`PRODUCTION_READINESS=NO`

No production deployment or external provider approval was attempted. MoMo remains blocked by absent sandbox credentials and HTTPS merchant portal registration. Google local configuration is ready, but live OAuth acceptance is opt-in and was not run. VNPAY code/config readiness is available locally, while live provider behavior remains an external environment responsibility.
