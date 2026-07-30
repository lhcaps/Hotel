# Phase 3 authentication architecture

The API owns one PostgreSQL-backed Drizzle client. `@room/auth` constructs Better Auth with that client and the direct Fastify bridge serves only `/api/auth/*`. Nest business controllers remain under `/api/v1/*`.

Email/password sign-in is enabled for bootstrap-created users only. Public sign-up is disabled. Cookies are HttpOnly and SameSite=Lax; Secure is enabled in production. `WEB_ORIGIN` is the only credentialed CORS origin.

`AdminSessionService` derives identity from the session, reloads the user, rejects expiry and `DISABLED`, and produces immutable actor context. `AdminPermissionGuard` reads `@RequirePermissions` metadata and applies the centralized map in `@room/auth`; client bodies never provide identity, role, or permission.

MFA, recovery delivery, and external identity are deliberately absent. MFA is mandatory before production use.
