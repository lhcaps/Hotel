# Phase 8E Full Product Activation Handoff

Phase 8E inventories the actual product surface, closes recommendation discoverability, and adds non-secret local activation diagnostics.

## Activated Journey

`/` -> availability -> authoritative quote -> automatic stay-time recommendations/coupon -> HOLD -> `/booking/manage` guest OTP -> payment selection/status. CUSTOMER routes are under `/account`; ADMIN remains isolated under `/admin`.

## Ownership Boundaries

- API owns quotes, OAuth callbacks, payment verification, and mutations.
- Worker owns HOLD expiration, outbox delivery, and reconciliation.
- Provider callbacks, worker jobs, and health endpoints are internal-only.

## External Blockers

- Google live-local acceptance needs user-supplied non-production Google credentials.
- MoMo/VNPAY sandbox acceptance needs merchant credentials plus a public HTTPS callback.
- Production SMTP/domain/certificate/infrastructure are not configured.

See `docs/audit/phase-8e/validation-report.md` for executed evidence and `docs/audit/phase-8e/fe-be-parity-report.md` for remaining client-contract debt.
