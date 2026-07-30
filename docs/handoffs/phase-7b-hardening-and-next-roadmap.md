# Phase 7B hardening and next roadmap

## Accepted state

- **Baseline:** `3042c25fb8cbc41eaf280e2091f3147747187065`
- **Schema:** `phase-7b-data-driven-pricing-v1`
- **Phase 7B:** `PASS`
- **Production readiness:** `NO` (missing payment approval/webhooks, deployment/TLS, production operations evidence and required customer features).

## Closure delivered

- Stable pricing configuration hierarchy and distinct base/extra price errors.
- Active-only public matching; strict administrative finite-grid validation of PostgreSQL-owned active tiers.
- Full metadata validation and property-owned timezone propagation.
- Root TypeScript ownership, migration-compatible integration fixtures and correct rate-plan persistence mapping.
- Worker production configuration hardening for placeholder secrets.
- Disposable Playwright seed now represents the full active pricing grid. The admin-pricing vertical verifies UI mutation, public selection and immutable quote snapshots.

## Evidence commands

`pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build`, `pnpm check:openapi`, `pnpm db:check`, `pnpm db:status`, `pnpm audit --prod --audit-level=high`, and `node scripts/run-playwright.mjs` all completed successfully. Playwright reports 23 passed with one documented conditional skip plus one unavailable-API pass.

## Next implementation phase: 7C payment core

| Item                 | Plan                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer requirement | MoMo and VNPAY need an authoritative shared payment core first.                                                                             |
| Scope                | Payment intent/status model, provider-neutral adapter, signed webhook/IPN confirmation, immutable booking payment snapshot and idempotency. |
| Exclusions           | Do not add provider SDKs, refunds, campaigns, Google identity, translations or deployment edge in 7C.                                       |
| Impact               | New forward migration, contracts/API/web payment handoff and worker/outbox integration.                                                     |
| Security             | Return URL never changes state; only verified signed webhook can transition payment/booking.                                                |
| Tests                | Database transaction/race tests, signature/idempotency tests, public hold-to-payment vertical.                                              |
| Complexity           | L                                                                                                                                           |
| Rollback             | Revert application commits newest-first; keep applied schema forward-only and disable the payment feature.                                  |
| Guard                | One provider-neutral adapter interface only; no generic payment platform.                                                                   |

Follow with 7D MoMo sandbox, 7E VNPAY sandbox, 7F coupon distribution/redemption, 7G Google CUSTOMER identity, 7H localisation, and 7I approved deployment edge/SMTP/SSL.

## Safe operating instructions

- Keep PostgreSQL authoritative; Redis remains non-authoritative.
- Do not edit migrations 0000–0011. Any later schema fix is a reviewed forward migration.
- Run full Playwright with its isolated lifecycle; do not touch port 3001 or unrelated processes.
- Roll back code using `git revert <newest-commit>` in newest-first order; never reset/rewrite migration history or directly alter shared/production data.
- No payment, MoMo, VNPAY, refund, Google CUSTOMER login, translation, SSL/deployment, MANAGER role, credential commit, push, PR, deployment, Docker-volume deletion, or destructive Git action was performed.
