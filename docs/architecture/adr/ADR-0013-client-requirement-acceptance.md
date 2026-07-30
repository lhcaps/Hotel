# ADR-0013: Narrow client-requirement acceptance boundaries

## Decision

Keep PostgreSQL and verified payment settlement authoritative. Implement the missing coupon-email request as an ADMIN-only, idempotent outbox vertical; use local typed vi/en dictionaries for UI; permit Google Cloud Translation only through a disabled-by-default server-only adapter for approved public descriptions.

## Consequences

- Browser code never supplies a coupon-email recipient or translation credential.
- A cookie establishes one locale for server HTML and client context.
- Codes, VND values, payment providers, booking statuses, PII, and payment data are not machine-translated.
- Real providers, Google Cloud credentials, DNS, and certificates remain explicit external gates.

## Phase 8D.2 acceptance evidence

The single dictionary/formatter boundary is now verified across the critical customer and ADMIN surfaces. Browser evidence uses deterministic local OIDC, payment and email simulators; it checks English persistence, known mixed-language phrases, keyboard locale control and programmatic document-width constraints at four locked viewports. This changes local client acceptance to PASS without weakening the external production gates.
