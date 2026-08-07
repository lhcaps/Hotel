# Housekeeping and verification specification

## Current source of truth

The room condition enum is `CLEAN/DIRTY/CLEANING` (`packages/database/src/schema.ts:31`), while operational activation is `rooms.status` and dated maintenance is `maintenance_blocks`. `housekeeping_tasks` is a separate durable queue with `ARRIVAL_PREP` and `TURNOVER` (`schema.ts:922-981`). `RoomOperationsService` returns both `housekeepingStatus` and derived `maintenanceState`; it must not collapse them.

## B0 lifecycle

During a continuing multi-night booking:

- occupancy remains derived as `OCCUPIED` for the booking interval;
- housekeeping remains unchanged between nights;
- no `ARRIVAL_PREP`, `TURNOVER`, dirty transition, or daily credential is created;
- the same physical room and inventory block remain authoritative.

At final checkout, `AdminBookingLifecycleService.checkOut` must remain the single owner of the atomic lifecycle: lock assigned room, move booking to `CHECKED_OUT`, set room `DIRTY`, insert one `TURNOVER` with `ON CONFLICT (booking_id,type) DO NOTHING`, release the booking inventory block, audit, and enqueue outbox (`apps/api/src/booking/services/admin-booking-lifecycle.service.ts:564-615`).

Cancellation/no-show cancel future `ARRIVAL_PREP` tasks and release the booking block, but do not create a final turnover for a room that was never checked in. A checked-in booking cannot be cancelled through current guards.

## Axis contract

| Concern      | State/data                                                       | Owner                                           | Illegal behavior                                                               |
| ------------ | ---------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| Activation   | `rooms.status`                                                   | Catalog room service                            | Treating `INACTIVE` or legacy `MAINTENANCE` as a housekeeping condition.       |
| Occupancy    | Derived from booking interval                                    | Booking/inventory query                         | Manual occupancy writes or nightly booking splits.                             |
| Housekeeping | `CLEAN`, `DIRTY`, `CLEANING`                                     | Catalog transition/check-out service            | `CLEAN -> CLEAN` as a bypass, nightly dirty, or clean without a cleaning step. |
| Maintenance  | Active dated `maintenance_blocks` plus compatibility room status | Maintenance/catalog service                     | Allowing availability/check-in through a middle-night maintenance overlap.     |
| Task work    | `housekeeping_tasks.type/status`                                 | Worker/reminder and future assignment workspace | Duplicate turnover or task completion without authorization/audit.             |

The full housekeeping assignment workspace, cleaner assignment, activity log, inspection evidence, and manager escalation are later approved phases. B0 only preserves and verifies the final-turnover invariant and the check-in readiness prerequisites.
