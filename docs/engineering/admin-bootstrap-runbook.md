# Admin bootstrap runbook

Apply the reviewed migration first and verify `pnpm db:status`. Set `BETTER_AUTH_SECRET`, `ADMIN_BOOTSTRAP_EMAIL`, and a strong `ADMIN_BOOTSTRAP_PASSWORD` (at least 16 characters including lower case, upper case, and digit) in a secure operator shell. `ADMIN_BOOTSTRAP_ROLE` is optional and defaults to `ADMIN`; set it to `SUPER_ADMIN` only when establishing an explicitly authorized initial account-management principal. `ROOM_STATUS_VIEWER` is intentionally not bootstrap-eligible and must be assigned by an authorized `SUPER_ADMIN`. In production also set `ADMIN_BOOTSTRAP_PRODUCTION_ACK=I_UNDERSTAND`.

Run `pnpm admin:bootstrap`. It is idempotent by normalized email and requested role, refuses role changes or CUSTOMER role upgrades, prints no secret, and writes `ADMIN_BOOTSTRAPPED` audit evidence with the requested role in the same transaction. Do not put bootstrap credentials in `.env.example`, source control, URLs, or browser storage.

Rollback stops the application release. Schema defects require a new reviewed forward migration; released migration history and audit rows are never rewritten.
