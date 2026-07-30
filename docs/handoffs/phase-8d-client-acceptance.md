# Phase 8D Client Acceptance Handoff

Implemented locally: coupon delivery request/outbox/worker template, controlled translation adapter, persisted vi/en locale foundation, trusted proxy validation, protected migration 0019 lineage, self-contained demo smoke, endpoint documentation, and focused tests.

Two full Playwright regressions now pass at 61/61 with zero skips, and the coupon-delivery browser-to-Mailpit vertical passes locally. Do not promote Phase 8D client-requirement acceptance to PASS yet: critical-page VI/EN coverage and focused responsive/accessibility evidence remain incomplete. Do not promote production readiness: complete live external acceptance using non-production credentials and a public HTTPS callback domain.

## Phase 8D.3 public entry closure

The public root is now the customer booking entry rather than the Phase 1 engineering placeholder. It reuses the authoritative availability component and its existing quote -> HOLD/contact -> guest OTP -> payment continuation. The public header is locale-aware and shows anonymous booking/guest/login paths or CUSTOMER profile/bookings/sign-out after an existing session probe. ADMIN navigation remains isolated. Focused unit and accessibility coverage passes; deterministic browser execution is blocked by the absent `PLAYWRIGHT_BETTER_AUTH_SECRET`, and the demo lifecycle remains blocked by an unowned protected port 3001. These environment blockers do not establish live provider, SMTP, public-domain, certificate, or callback acceptance.

## Phase 8D.2 completed closure

Critical local UI translation, English persistence, responsive layout, and focused accessibility evidence are now closed. The two fresh deterministic browser runs passed `64 + 1` tests each with zero skips. Keep the production boundary unchanged: local simulation is not live Google, MoMo/VNPAY sandbox, outbound SMTP, public DNS, certificate, or callback acceptance.
