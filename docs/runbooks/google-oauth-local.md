# Google OAuth Local Activation

1. In Google Cloud, create an OAuth web client and register `http://localhost:3000` as the authorized JavaScript origin.
2. Register exactly `http://localhost:3001/api/auth/callback/google` as the redirect URI.
3. Set local environment values: `GOOGLE_AUTH_ENABLED=true`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the exact `GOOGLE_REDIRECT_URI`. `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` may remain `false`; it is retained for compatibility but cannot activate the UI.
4. Run `pnpm check:google-oauth` and `pnpm check:providers`.
5. Run `pnpm test:e2e:google-live-local`. It stops at an explicit manual provider checkpoint. Complete authentication manually; never automate a Google password, MFA, cookies, or tokens.

The callback remains API-owned. The browser return path is allowlisted application navigation only. Account linking is disabled, so an ADMIN email cannot be silently taken over.
