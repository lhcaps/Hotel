# Room Management

PeaceNest is a room-management application with public availability and booking, immutable quotes, payments, customer access, and isolated administration for room operations and pricing. This repository contains the source and governed release tooling; it is not itself proof of a production deployment.

## Current handoff boundary

- `FINAL_SOURCE_SHA`: the exact immutable SHA of the final committed `main` tree, recorded by `git rev-parse HEAD` in the handoff evidence. This document intentionally uses the field rather than duplicating its own commit hash.
- `FINAL_PRODUCTION_SHA`: the same immutable SHA after the single canonical governed deployment and strict runtime attestation; it must equal `FINAL_SOURCE_SHA`.
- `HANDOFF_STATUS`: `TECHNICAL_HANDOFF=PASS`; `CREDENTIAL_TRANSFER=PENDING_HUMAN`. Outgoing access remains unchanged until independent successor verification.
- Runtime, pricing, and workflow claims are valid only when backed by the exact-SHA hosted CI and governed production evidence returned with this handoff. Historical reports are context only.

Start with [the handoff](docs/HANDOFF.md), [operations runbook](docs/OPERATIONS_RUNBOOK.md), [developer guide](docs/DEVELOPER_GUIDE.md), [known issues](docs/KNOWN_ISSUES.md), [security handoff](docs/SECURITY_HANDOFF.md), [credential-transfer checklist](docs/CREDENTIAL_TRANSFER_CHECKLIST.md), and [the untracked-worktree inventory](docs/UNTRACKED_WORKTREE_INVENTORY.md). Historical records are preserved under [docs/archive/2026-08](docs/archive/2026-08/), governed by [the documentation archive policy](docs/archive/README.md), and are not live release evidence.

## Prerequisites

- Node 24 LTS and Corepack.
- Docker Desktop with Docker Compose v2.

Windows PowerShell:

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm infra:up
pnpm dev
```

Linux/macOS:

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm infra:up
pnpm dev
```

Health endpoints: web `http://localhost:3000/health`; API live `http://localhost:3001/api/v1/health/live`; API ready `http://localhost:3001/api/v1/health/ready`; Mailpit `http://localhost:8025`.

Run `pnpm verify` for formatting, lint, types, unit tests and builds. For the Phase 4 database and public-flow gate, start local infrastructure and run:

```powershell
pnpm infra:up
pnpm db:check
pnpm db:test
pnpm db:migrate
pnpm db:status
pnpm db:seed:development # only with NODE_ENV=development and a loopback DATABASE_URL
pnpm test:pricing
pnpm test:availability
pnpm test:quotes
pnpm test:e2e
```

`db:test`, availability, and quote tests create and drop only disposable `room_management_test_<uuid>` databases from `TEST_DATABASE_URL`; they do not seed or migrate persistent environments. See the [pricing architecture](docs/engineering/pricing-architecture.md), [availability architecture](docs/engineering/availability-architecture.md), [quote architecture](docs/engineering/quote-architecture.md), and [Phase 4 validation guide](docs/engineering/phase-4-validation.md). Use `pnpm infra:down` for safe shutdown; it preserves volumes. Development scripts load a root `.env` when present. A port collision is diagnosed with `docker compose ps` and the owning local process, not by silently changing ports.

## Phase 8D acceptance boundary

Phase 8D adds an ADMIN-only coupon-email queue and a minimal vi/en locale foundation. Coupon delivery is requested with `POST /api/v1/admin/bookings/:bookingCode/send-coupons`, an `Idempotency-Key`, and coupon codes only; the booking contact snapshot remains the sole recipient source and the worker sends through the transactional outbox. The optional Google description translator is disabled by default and server-only. See [the requirement matrix](docs/audit/phase-8d/client-requirement-matrix.md) and [SSL/callback runbook](docs/runbooks/ssl-and-callback-setup.md). Local deterministic evidence is not a live provider, public-domain, or production readiness claim.

## Public product entry

`http://localhost:3000/` is the public booking entry. It uses the server-authoritative availability search, then continues to `/booking/quote/[quoteId]` for quote, automatic stay-time recommendations, coupons, and HOLD contact details. Existing guest booking access is `/booking/manage`; payment selection/status is shown after guest OTP verification in that booking detail; CUSTOMER login is `/login` and account pages are under `/account`. ADMIN remains isolated under `/admin`. The public header persists Vietnamese/English through the `room_locale` cookie.

## Phase 8F provider readiness

Run `pnpm check:providers` for the non-secret readiness of Google OAuth, MoMo, VNPAY, SMTP, and public callbacks. Disabled optional providers are reported as blocked without making an Internet call. The local Google callback remains `http://localhost:3001/api/auth/callback/google`; the login action is enabled only from the server-derived readiness response, never a browser feature flag. Provider-specific live commands are opt-in and require manual external-provider checkpoints. See [local feature setup](docs/runbooks/local-full-feature-setup.md), [Google OAuth setup](docs/runbooks/google-oauth-local.md), and [public callback setup](docs/runbooks/public-provider-callbacks.md).
