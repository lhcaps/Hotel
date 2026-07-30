# Client UAT Data (Sanitized Development Only)

## Scope and reset

Use only the loopback development database. The fixture never reads the client workbook and uses reserved `example.test` identities, fixed UAT booking codes and synthetic phone digits.

```powershell
pnpm db:migrate
pnpm db:seed:development
```

Running the seed again is idempotent. It is guarded by `NODE_ENV=development`, a loopback PostgreSQL URL, and no connection-string query/hash overrides.

## Deterministic fixture inventory

| Area                 | Synthetic state                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Property and catalog | One `DEMO_PROPERTY`; Standard, Deluxe and Signature tiers; six representative rooms; lunch, 3-hour, 5-hour, night, day and extra-hour prices. |
| Housekeeping         | CLEAN, DIRTY and CLEANING rooms.                                                                                                              |
| Maintenance          | One active synthetic maintenance block on room 302 for 2027-07-16 09:00–12:00 Asia/Ho_Chi_Minh.                                               |
| Bookings             | `UAT-HOLD-20270710`, `UAT-CONFIRMED-20270711`, `UAT-PENDING-20270712`, `UAT-CANCELLED-20270713`, `UAT-EXPIRED-20270714`.                      |
| Customers            | Two synthetic CUSTOMER users; one owns two bookings for returning-customer reporting.                                                         |
| Payments             | Succeeded, pending and cancelled payment aggregates; one synthetic failed payment attempt for deterministic UI/test boundaries.               |
| Reporting            | 2027-07-10 through 2027-07-14 is non-empty; a range outside July 2027 is an empty-state fixture.                                              |

The seed does not create external provider credentials, send email, or represent a VNPAY/MoMo transaction as live acceptance.
