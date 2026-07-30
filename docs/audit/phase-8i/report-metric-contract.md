# Phase 8I reporting metric contract

The administrative report is property-scoped and filters by the instant interval supplied by the UI. The current property timezone is `Asia/Ho_Chi_Minh`; daily buckets derive from `check_in AT TIME ZONE property.timezone`.

| Metric                | Definition                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Gross revenue         | Sum of `final_amount_vnd` for non-`CANCELLED` and non-`EXPIRED` bookings.                         |
| Settled revenue       | Gross-eligible sum with payment status `SUCCEEDED`.                                               |
| Booking count         | All bookings in the filtered interval, including terminal states.                                 |
| Confirmed / cancelled | Counts where booking status is `CONFIRMED` / `CANCELLED`.                                         |
| Customers / returning | Distinct non-null `customer_user_id`; returning means more than one filtered booking.             |
| Outstanding           | `null`: partial-payment modelling is intentionally deferred. It is never inferred by subtraction. |

The isolated integration test `phase8i-reporting-fixtures.integration.test.ts` uses 10–14 July 2027 local dates and proves: gross `1,137,000`, settled `359,000`, bookings `5`, confirmed `2`, cancelled `1`, customers `2`, returning `1`. It also verifies zero-revenue terminal days and rate-plan/room-type breakouts.

The deterministic development seed carries only synthetic `example.test` identities, fixed UUIDs, and no external payment credentials. It covers HOLD, CONFIRMED plus SUCCEEDED, CONFIRMED plus PENDING, CANCELLED plus CANCELLED, EXPIRED, a failed synthetic attempt, and maintenance.
