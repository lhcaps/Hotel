# Local Full Feature Setup

Use `.env.example` as a non-secret reference, start local infrastructure, and keep Google, MoMo, and VNPAY disabled unless their external prerequisites are intentionally configured.

Run:

```bash
pnpm db:status
pnpm check:features
pnpm check:google-oauth
pnpm check:providers
pnpm dev
```

The standard deterministic suite is offline with respect to public providers: `pnpm test:e2e`. Mailpit is the default local email target. Only run the named provider acceptance command after its readiness line is `READY`.
