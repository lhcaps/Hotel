# Phase 8F Live Provider Activation Handoff

## Repository-owned closure

- `pnpm check:providers` is the single non-secret readiness check. It exits successfully for disabled optional providers and fails for enabled incomplete configuration.
- Customer payment availability comes from the API and is parsed by the Web client through shared Zod contracts. Disabled providers remain visible with a customer-safe reason rather than looking like a usable checkout action.
- Google login is false-safe during server rendering and fetches non-secret readiness from `GET /api/v1/public/provider-readiness` after hydration. The API is authoritative; `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` cannot make the action active.
- Google OAuth ownership remains at `http://localhost:3001/api/auth/callback/google`. The Web app stays on port 3000.
- Payment browser return routes are non-authoritative. Verified IPN events remain the only settlement path.
- SMTP defaults to Mailpit for deterministic acceptance; a configured SMTP provider uses environment-driven authentication.

## External activation sequence

1. Register the exact Google redirect URI in Google Cloud, set local non-placeholder credentials, then run `pnpm test:e2e:google-live-local` and complete sign-in manually.
2. Obtain MoMo sandbox merchant credentials, configure a stable public HTTPS API base with the documented return/IPN routes, then run `pnpm test:e2e:momo-sandbox`. Do not automate PIN, password, or OTP entry.
3. Obtain VNPAY sandbox credentials and register the exact public HTTPS routes, then run `pnpm test:e2e:vnpay-sandbox`. Do not automate banking credentials or OTP entry.
4. Configure an SMTP provider and a dedicated local test recipient, then run `pnpm test:email:live`. Use synthetic data only and record inbox confirmation manually where needed.

## Current live gates

```text
GOOGLE_LIVE_LOCAL=BLOCKED_MISSING_USER_CREDENTIALS
MOMO_SANDBOX_LIVE=BLOCKED_MISSING_MERCHANT_CREDENTIALS
VNPAY_SANDBOX_LIVE=BLOCKED_MISSING_MERCHANT_CREDENTIALS
SMTP_LIVE=BLOCKED_MISSING_SMTP_CREDENTIALS
PHASE_8F_LIVE_EXTERNAL_ACCEPTANCE=BLOCKED
PRODUCTION_READINESS=NO
```

See the provider-specific runbooks for exact environment variables and callback registrations.
