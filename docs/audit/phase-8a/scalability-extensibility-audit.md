# Phase 8A — Scalability & Extensibility Audit

## 1. Modular-Monolith Boundaries

| Boundary                                                    | Status   | Evidence                                                          |
| ----------------------------------------------------------- | -------- | ----------------------------------------------------------------- |
| Pricing in `@room/api` is a single module                   | VERIFIED | `apps/api/src/pricing/**` is self-contained.                      |
| Payment in `@room/api` + `@room/booking`                    | VERIFIED | Adapters are isolated; settlement lives in `@room/booking`.       |
| Database package owns the schema                            | VERIFIED | `packages/database/drizzle/**` is the only place migrations live. |
| Shared contracts in `@room/contracts`                       | VERIFIED | All API + Web + Worker import contracts from one place.           |
| Dependency direction (api/worker → packages, never reverse) | VERIFIED | No package imports from `apps/**`.                                |

## 2. Adding a Third Payment Provider

**Status:** VERIFIED_WITH_LIMITATION.

- The adapter interface is `apps/api/src/payment/providers/<provider>/<provider>.adapter.ts` and `...signature.ts`.
- `payment_provider_settings` table is keyed by `(property_id, provider)`; a third provider can be added via a row insert.
- The booking package's `applyVerifiedPaymentEvent` is provider-agnostic; it consumes `verificationMarker === 'VERIFIED_BY_ADAPTER'` from any adapter.

**Limitation:** the audit could not find a generic `PaymentProviderAdapter` interface that adapters implement; instead, each adapter is hand-wired in `apps/api/src/payment/payment.module.ts`. Adding a provider requires touching the module. **EXTENSIBILITY-001 P2.**

## 3. Adding a New Pricing Plan

**Status:** VERIFIED_WITH_LIMITATION.

- Plans are configured via `db rate_plans` + `db rate_plan_prices`. No code change is required to add a new combo.
- The pricing engine reads the catalog at request time, so new plans take effect immediately.

**Limitation:** the audit did not find an admin UI for adding a new combo via a non-technical operator; only the Phase 7G `rate-plans` admin page (which calls the rate-plan service). **EXTENSIBILITY-002 P3.**

## 4. Adding a New Recommendation Strategy

**Status:** NOT_VERIFIED. No recommendation abstraction exists; this is part of the Phase 8B design.

## 5. Outbox / Worker Scalability

| Item                      | Status       | Evidence                                                                                |
| ------------------------- | ------------ | --------------------------------------------------------------------------------------- |
| Outbox idempotency        | VERIFIED     | `outbox_events.event_id` unique; `claim-outbox-batch.test.ts` verifies lease semantics. |
| Multi-worker safety       | VERIFIED     | `claim-outbox-batch.test.ts` "distributes rows between two workers without overlap".    |
| Reclaim of expired leases | VERIFIED     | `reclaim-expired-leases.test.ts`.                                                       |
| Outbox retention          | NOT_VERIFIED | No retention policy; rows accumulate forever. **SCALABILITY-001 P2.**                   |

## 6. Session / Cache Authority

| Item                      | Status   | Evidence                                                                |
| ------------------------- | -------- | ----------------------------------------------------------------------- |
| Session storage authority | VERIFIED | DB-backed sessions; Redis is optional.                                  |
| Redis optionality         | VERIFIED | `@room/config` zod schema treats Redis as optional for non-cache paths. |

## 7. N+1 / Lock Contention / Hotspots

| Item                                  | Status                   | Evidence                                                                                                                     |
| ------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| N+1 queries                           | VERIFIED_WITH_LIMITATION | The audit did not find obvious N+1 in the catalogue, quote, or booking paths. A formal N+1 audit is recommended in Phase 8G. |
| Lock contention on HOLD expiry        | VERIFIED                 | `expire-stale-holds.test.ts` "skips a locked stale row and processes it on a later run".                                     |
| Lock contention on payment settlement | VERIFIED                 | `payment-event-race.test.ts` + audit-phase8a concurrent test.                                                                |
| Pagination strategy                   | VERIFIED                 | ADMIN booking list and customer booking list use `LIMIT/OFFSET`; no `OFFSET > 1000` observed.                                |

## 8. Multi-Instance Deployment

| Item                            | Status                   | Evidence                                                                                                                               |
| ------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Stateless API assumption        | VERIFIED                 | API is stateless; sessions are in DB.                                                                                                  |
| Multi-instance worker           | VERIFIED                 | Outbox leases prevent double-claim.                                                                                                    |
| Multi-instance DB               | VERIFIED                 | Connection pooling handled by Drizzle/pg.                                                                                              |
| Rolling migration compatibility | VERIFIED_WITH_LIMITATION | Migrations are forward-only; the audit did not verify that the schema can serve both old and new API versions during a rolling deploy. |

## 9. Backward Compatibility / Archival

| Item                    | Status       | Evidence                                                                                                                 |
| ----------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| API contract versioning | VERIFIED     | `/api/v1/...` is the only public surface.                                                                                |
| Contract regeneration   | VERIFIED     | `scripts/generate-public-openapi.mts` regenerates OpenAPI byte-identical (covered by `openapi-reproducibility.test.ts`). |
| Audit / outbox archival | NOT_VERIFIED | No archival procedure documented.                                                                                        |

## 10. Audit Findings

| ID                | Finding                                                                                                | Severity |
| ----------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| EXTENSIBILITY-001 | No generic `PaymentProviderAdapter` interface; adding a provider requires editing `payment.module.ts`. | P2       |
| EXTENSIBILITY-002 | No admin UI for adding a new pricing plan via a non-technical operator.                                | P3       |
| SCALABILITY-001   | No outbox/audit-event retention policy.                                                                | P2       |

## 11. Headline Verdict

| Verdict                 | Status                   |
| ----------------------- | ------------------------ |
| SCALABILITY_READINESS   | VERIFIED_WITH_LIMITATION |
| EXTENSIBILITY_READINESS | VERIFIED_WITH_LIMITATION |
