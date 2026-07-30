# ADR-0014: Full Product Activation Boundaries

## Decision

Keep the existing monolith boundaries: the Web drives public and ADMIN flows through API endpoints; the API owns pricing, auth callbacks, payment verification, and database mutations; the Worker owns expiration, outbox delivery, and reconciliation.

## Consequences

- The root route is the public availability entry.
- Stay-time recommendations remain advisory until a customer requests a new authoritative quote.
- Google OAuth callback remains API-owned at `/api/auth/callback/google`.
- Provider webhooks, health endpoints, and worker jobs are internal-only, not browser controls.
- External provider and SMTP acceptance remain blocked until separately configured.
