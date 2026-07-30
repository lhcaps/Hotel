# Admin bootstrap runbook

Apply the reviewed migration first and verify `pnpm db:status`. Set `BETTER_AUTH_SECRET`, `ADMIN_BOOTSTRAP_EMAIL`, and a strong `ADMIN_BOOTSTRAP_PASSWORD` (at least 16 characters including lower case, upper case, and digit) in a secure operator shell. In production also set `ADMIN_BOOTSTRAP_PRODUCTION_ACK=I_UNDERSTAND`.

Run `pnpm admin:bootstrap`. It is idempotent by normalized email, refuses CUSTOMER role upgrades, prints no secret, and writes `ADMIN_BOOTSTRAPPED` audit evidence in the same transaction. Do not put bootstrap credentials in `.env.example`, source control, URLs, or browser storage.

Rollback stops the application release. Schema defects require a new reviewed forward migration; released migration history and audit rows are never rewritten.
