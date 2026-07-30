# Phase 8E FE/BE Parity Report

## Result

The product inventory is in `product-capability-matrix.csv`. Every repository-owned capability is classified as `FULL_VERTICAL` or `INTERNAL_ONLY`; there are no unclassified backend mutations. Provider ingress, health checks, and worker jobs are intentionally internal-only because exposing them to a browser would weaken their security boundary.

## Findings Closed

- `/` is the public availability entry and proceeds to the existing quote/HOLD journey.
- Quote recommendations are automatically loaded from `POST /api/v1/recommendations/stay-times`, render customer-facing plan names, preserve stay duration, show amount comparison and advisory text, and create a fresh quote only after explicit selection.
- Guest, CUSTOMER, payment, ADMIN catalog, ADMIN operations, and reconciliation routes are already connected through real API clients and route navigation.
- Google OAuth is API-owned at `http://localhost:3001/api/auth/callback/google`; the Web only starts sign-in at `/api/auth/sign-in/social`.
- Payment-provider management represents database settings plus runtime adapter configuration. A disabled or unconfigured provider is not offered through the public provider list.

## Contract Debt

The shared `admin-api.ts` and `booking-api.ts` predate this phase and use generic JSON decoding with local response shapes. They remain a tracked technical-debt finding rather than being silently cast as complete contract validation. The recommendation request/response boundary uses shared contract types and server-side Zod schemas. `FE_DUPLICATE_API_DTOS` and `UNVALIDATED_REQUIRED_NETWORK_RESPONSES` are therefore not asserted as zero by this evidence.

## Endpoint Reconciliation

`pnpm check:endpoints` remains the authoritative runtime/OpenAPI reconciliation gate. Browser-visible mutations map to public booking, guest, customer, catalog, booking-operation, provider-settings, and reconciliation actions. Internal-only callbacks are provider webhooks, worker jobs, and health probes.
