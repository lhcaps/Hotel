# Phase 8I visual UAT ledger

Command: `pnpm exec playwright test tests/e2e/phase-8i-visual-uat.spec.ts` with ephemeral loopback test services. Result: `1 passed (12.6s)` on 2026-07-29. Images are deliberately ignored under `output/playwright/phase-8i/`; they contain synthetic test data only.

| Capture | Surface                            | SHA-256 prefix    |
| ------- | ---------------------------------- | ----------------- |
| 01      | Public entry, desktop              | `00935E115DFF744` |
| 02      | Availability results, desktop      | `5F13B642C5B0152` |
| 03      | Hold contact, desktop              | `6C68A7A541E1BDE` |
| 04      | Customer bookings, desktop         | `3BC333EA413D2A3` |
| 05      | Customer profile, desktop          | `EB1C3A77669BD5D` |
| 06      | Non-empty admin report, desktop    | `6BF853FCB59BE86` |
| 07      | Room operations, desktop           | `92C13C76B139A8F` |
| 08      | Admin bookings, desktop            | `C38A6D0DEEE955D` |
| 09      | Admin payments, desktop            | `D80E2C64CF3AAAD` |
| 10      | Admin rate plans, desktop          | `00425C6D0A0EB67` |
| 11      | Admin operational reviews, desktop | `B3E7E3CC88AD73C` |
| 12      | Room operations, 390x844           | `F54C97AAC1D711F` |
| 13      | Non-empty admin report, 390x844    | `58F8B47FFF0CC58` |

The browser fixture is isolated from Docker development data. It uses only `example.test` accounts and loopback provider simulators; it neither calls a live provider nor settles a live payment.
