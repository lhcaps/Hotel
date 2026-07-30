# Development seed data

`pnpm db:seed:development` is intentionally narrow. It requires `NODE_ENV=development` and a valid loopback PostgreSQL `DATABASE_URL` with no query or fragment overrides. It is deterministic and idempotent: one demo property, three tiers, three room types, six rooms, three amenities, their mappings, six rate plans, and only the documented lunch-plan prices are inserted or updated.

It creates no bookings, guest records, payment records, real identities, or production-like data. It is not a test fixture command and CI does not invoke it.

```powershell
$env:NODE_ENV = 'development'
$env:DATABASE_URL = 'postgresql://room:room@127.0.0.1:5432/room_management'
pnpm infra:up
pnpm db:migrate
pnpm db:seed:development
```

Do not relax the loopback/development guard, substitute a shared hostname, or use this command to repair a persistent environment. Test data belongs to `pnpm db:test`, which creates and removes its own guarded disposable database.
