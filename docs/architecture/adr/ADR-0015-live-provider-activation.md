# ADR-0015: Live Provider Activation Boundaries

## Decision

Provider activation is server-derived. A payment provider is customer-active only when the server configuration validates, its adapter is present, the property enables it, and no maintenance state blocks it. Public responses contain only identifier, display data, enabled state, safe unavailable reason, and optional environment label. Credentials and validation detail remain server-only.

Google OAuth remains owned by the API callback at `/api/auth/callback/google`. The login UI obtains its non-secret Google state from `GET /api/v1/public/provider-readiness`; `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` is never an activation source. Local Google OAuth uses `http://localhost:3001`; production requires HTTPS. MoMo and VNPAY browser returns are read-only. Signed IPNs are the only settlement ingress.

SMTP remains Mailpit by default for deterministic acceptance. Authenticated external SMTP is environment-only and uses the existing outbox transport.

## Consequences

`pnpm check:providers` reports readiness without printing secret values. Opt-in provider commands report `BLOCKED` without contacting the Internet when prerequisites are absent. Live success requires documented external evidence and is not inferred from deterministic simulators.
