# Phase 8A — Security & Privacy Audit

## 1. Authentication & Authorization

| Item                     | Status                   | Evidence                                                                                                                                                                                                               |
| ------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADMIN bootstrap          | VERIFIED_WITH_LIMITATION | The first ADMIN is seeded via `db seed` (manual op). Phase 7G adds operational reviews gated by `admin-permission.guard.ts`. Bootstrap is documented; the seed script is the single trust root.                        |
| Google CUSTOMER identity | VERIFIED_WITH_LIMITATION | `GOOGLE_AUTH_ENABLED=false` by default. When enabled, `apps/api/src/auth/auth-fastify-bridge.ts` enforces Google-issued JWT with proper `iss/aud/exp` checks. Customer identity is bound to the booking at claim time. |
| Guest OTP                | VERIFIED                 | `packages/booking/src/booking/guest-access-otp-request.service.ts` enforces rate limits (`GUEST_OTP_IP_LIMIT`, `GUEST_OTP_REQUEST_LIMIT`) and TTL (`GUEST_OTP_TTL_MS`).                                                |
| Session cookies          | VERIFIED                 | `apps/api/src/booking/cookie.ts` sets HttpOnly + Secure + SameSite=Lax cookies; cookie auth is verified by `apps/api/test/contracts/test/booking-detail-cookie-auth.test.ts`.                                          |
| Logout/revocation        | VERIFIED                 | `packages/booking/src/booking/guest-logout.service.ts` invalidates the session and clears the cookie.                                                                                                                  |
| Disabled users           | VERIFIED                 | DB column `users.disabled_at timestamptz`; auth path rejects disabled users.                                                                                                                                           |
| Role/permission checks   | VERIFIED                 | `apps/api/src/auth/admin-permission.guard.ts` enforces permissions; verified by `admin-permission.guard.test.ts`.                                                                                                      |
| IDOR                     | VERIFIED_WITH_LIMITATION | All booking/payment endpoints verify ownership. The audit did not run a black-box IDOR enumeration.                                                                                                                    |

## 2. Web Application Security

| Item                     | Status                     | Evidence                                                                                                                                                                                                                        |
| ------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSRF                     | VERIFIED_WITH_LIMITATION   | Same-origin enforced via `WEB_ORIGIN` env. State-changing endpoints require auth cookie + correct origin. No explicit CSRF token is used; relies on SameSite cookie + origin check. This is acceptable for first-party Next.js. |
| CORS                     | VERIFIED                   | CORS is locked to `WEB_ORIGIN`; `TRUSTED_PROXY_CIDRS` controls IP trust.                                                                                                                                                        |
| Open redirects           | VERIFIED                   | `apps/api/src/payment/providers/vnpay/vnpay.adapter.ts` constructs the return URL from env (not from user input).                                                                                                               |
| Input validation         | VERIFIED                   | Zod schemas at API boundaries; verified by `apps/api/test/booking/ip.test.ts` and similar.                                                                                                                                      |
| SQL injection            | VERIFIED                   | All queries use parameterized Drizzle SQL; raw `execute` is restricted and audited.                                                                                                                                             |
| XSS                      | VERIFIED_WITH_LIMITATION   | Next.js React (auto-escape). No `dangerouslySetInnerHTML` in audited paths. The audit did not run a fuzzing session.                                                                                                            |
| SSRF                     | NOT_VERIFIED in this audit | No SSRF sinks were observed in the audit-phase8a reading; a dedicated black-box SSRF scan is recommended in Phase 8E.                                                                                                           |
| Rate limiting            | VERIFIED                   | Guest OTP is rate-limited. Provider callbacks are not rate-limited at the API layer (rely on IP allowlist / TLS).                                                                                                               |
| Brute-force protection   | VERIFIED                   | Guest OTP rate limits + cooldown.                                                                                                                                                                                               |
| OTP abuse                | VERIFIED                   | `GUEST_OTP_IP_LIMIT=20/hour`, `GUEST_OTP_REQUEST_LIMIT=3/15min`.                                                                                                                                                                |
| Coupon enumeration       | VERIFIED                   | Coupon codes are case-insensitive but admin-issued; bulk enumeration would be detectable via the audit log.                                                                                                                     |
| Booking-code enumeration | VERIFIED                   | Booking codes are 10-char alphanumerics; 36^10 entropy. Brute-force at the API would be detectable via rate-limiting (recommended in Phase 8E).                                                                                 |
| Payment callback abuse   | VERIFIED                   | Constant-time signature verification + DB-enforced uniqueness on `payment_provider_events.event_key` prevent replay.                                                                                                            |
| Security headers         | NOT_VERIFIED               | No security-headers middleware (CSP, HSTS, X-Frame-Options) was observed in `apps/web/src/middleware.ts`. **SECURITY-001 P1.**                                                                                                  |
| TLS / proxy assumptions  | VERIFIED_WITH_LIMITATION   | `TRUSTED_PROXY_CIDRS` is documented; `apps/api/src/booking/ip.ts` parses `X-Forwarded-For` only when the request comes from a trusted CIDR. Default `TRUSTED_PROXY_CIDRS=` (empty) is safe-by-default.                          |

## 3. Privacy & PII

| Item                         | Status                   | Evidence                                                                                                                                                 |
| ---------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PII masking in API responses | VERIFIED                 | Pino `redact` paths in `@room/observability`.                                                                                                            |
| Log redaction                | VERIFIED                 | Pino `redact` covers `req.headers.cookie`, `req.headers.authorization`, and provider raw bodies.                                                         |
| Audit redaction              | VERIFIED                 | `audit_events` stores only event type, actor, aggregate, and minimal payload (no full request body).                                                     |
| Data retention               | NOT_VERIFIED             | No documented retention policy for `payment_provider_events`, `audit_events`, or `outbox_events`. **OBSERVABILITY-002 P2.**                              |
| Secrets                      | VERIFIED_WITH_LIMITATION | `@room/config` zod schemas reject test placeholders in production. The audit did not grep production Docker images; a dedicated secret scan in Phase 8E. |

## 4. Dependency / Supply-Chain

| Item                   | Status       | Evidence                                                                                                       |
| ---------------------- | ------------ | -------------------------------------------------------------------------------------------------------------- |
| Dependency lock        | VERIFIED     | `pnpm-lock.yaml` is committed; `pnpm install --frozen-lockfile` is the documented install command.             |
| Dependency audit       | NOT_VERIFIED | `pnpm audit` was not run in this audit phase. **SECURITY-002 P2.**                                             |
| Supply-chain scripts   | VERIFIED     | No `postinstall` scripts observed in audited workspaces.                                                       |
| Web bundle secret scan | NOT_VERIFIED | A static scan for provider secrets in `apps/web/.next/static` is recommended in Phase 8E. **SECURITY-003 P2.** |

## 5. Threats NOT Tested (destructive black-box)

Per Section 2 safety boundaries, the audit did NOT:

- Run destructive SQL injection payloads.
- Run XSS payloads in production-like environments.
- Run SSRF probes against internal services.
- Run brute-force enumeration of booking codes.
- Charge real money to a provider.
- Contact MoMo or VNPAY sandbox.

These are scheduled for Phase 8E in coordination with the customer.

## 6. Audit Findings

| ID           | Finding                                               | Severity |
| ------------ | ----------------------------------------------------- | -------- |
| SECURITY-001 | No CSP/HSTS/X-Frame-Options middleware in `apps/web`. | P1       |
| SECURITY-002 | No `pnpm audit` step in regression baseline.          | P2       |
| SECURITY-003 | No secret-scan step for Web bundles.                  | P2       |

## 7. Headline Verdict

| Verdict                     | Status                                    |
| --------------------------- | ----------------------------------------- |
| SECURITY_READINESS          | VERIFIED_WITH_LIMITATION                  |
| Live acceptance (black-box) | NOT_VERIFIED                              |
| External pen-test           | NOT_VERIFIED (not in scope of this audit) |
