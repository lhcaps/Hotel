# Production SMTP Activation

Keep Mailpit for deterministic local work. For a provider-backed SMTP transport, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`, `SMTP_USER`, and `SMTP_PASSWORD` through environment or a secret manager. Configure a verified sender identity and a dedicated non-production `SMTP_LIVE_TEST_RECIPIENT`.

Run `pnpm check:providers`, then `pnpm test:email:live`. The opt-in command must use synthetic data only. Record external inbox receipt manually when the provider has no test API. Never log the password, complete email body, OTP, or customer PII.

The worker uses outbox leases, stable `Message-ID` values, bounded retries, and no vendor-specific domain logic.
