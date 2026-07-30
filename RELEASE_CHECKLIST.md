# Release checklist

Phase 1 release means engineering foundation only, not customer readiness. Confirm lockfile/fresh install, format, lint, typecheck, unit tests, build, local infrastructure, health endpoints, smoke test, secret scan and dependency audit. Confirm no migration, business domain implementation, production deploy or remote push. Preserve a rollback path to the Phase 0 documentation commit.

## Phase 8F provider release gate

Before any external activation, run `pnpm check:providers` and retain only non-secret output. Confirm customer UI receives server-derived safe readiness, payment browser return routes remain read-only, and signed IPN/reconciliation retain the sole settlement boundary. Live Google, MoMo, VNPAY, and SMTP acceptance require separate explicit commands, externally registered credentials/callbacks, manual provider interaction where required, and redacted evidence. A deterministic simulator, disabled configuration, or browser return does not establish a live provider pass. Production remains blocked until public HTTPS infrastructure, provider accounts, SMTP identity, monitoring, backup/restore, and operational security gates are complete.
