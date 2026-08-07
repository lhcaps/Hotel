# State machines and independent operational axes

## Actual booking transition guards

Source: `apps/api/src/booking/services/admin-booking-lifecycle.service.ts:114-124,411-666`.

```text
HOLD --payment authority--> CONFIRMED --checkIn readiness--> CHECKED_IN --final checkout--> CHECKED_OUT
  |                              |                              |
  +--cancel----------------------+--cancel / no-show-----------+
```

The diagram is intentionally incomplete where the repository delegates a transition to payment/worker code: verified payment applies `HOLD -> CONFIRMED` in `packages/booking/src/payment/payment-service.ts:648-656`, while stale HOLD expiration is a worker path.

| From                                             | Allowed current actions                                | Evidence                                                             |
| ------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------- |
| `HOLD`                                           | cancel; expire through HOLD-expiration path            | `deriveAvailableActions`; `create-booking-hold`/worker expiration    |
| `CONFIRMED`                                      | cancel; check-in; no-show after check-in time          | `admin-booking-lifecycle.service.ts:118-120,411-445,529-561,618-665` |
| `CHECKED_IN`                                     | check-out only                                         | `admin-booking-lifecycle.service.ts:120-121,564-615`                 |
| `EXPIRED`, `CANCELLED`, `NO_SHOW`, `CHECKED_OUT` | no lifecycle action from the current action derivation | `deriveAvailableActions` default                                     |

Cancellation is permitted from `HOLD` and `CONFIRMED`, never from `CHECKED_IN` or terminal states. No-show is permitted only from `CONFIRMED` and only at/after `checkIn`. The customer cancellation service has the same HOLD/CONFIRMED boundary (`apps/api/src/customer/customer-booking.service.ts:260-408`). No new transitions are invented here.

## Four independent axes

| Axis                      | Current authoritative source and enum/logic                                                                                                                                                                        | Target/compatibility adapter                                                                                                                                                | Transition owner and concurrency                                                                                          | Audit/display                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| A. Operational/activation | `rooms.status` is `ACTIVE/INACTIVE/MAINTENANCE` (`packages/database/src/schema.ts:29-31`); catalog service uses it for room lifecycle.                                                                             | Preserve these existing values in B0. Treat `MAINTENANCE` as the legacy activation stop; do not add a second activation enum without an approved migration.                 | `CatalogService` room mutations with `catalog.room.manage`; lock the room/property row where the current service does so. | Existing catalog audit events; UI displays activation separately from occupancy and housekeeping.                   |
| B. Occupancy              | No DB enum. `RoomOperationsService` derives `OCCUPIED` when a booking interval satisfies `checkIn <= now < checkOut` (`apps/api/src/booking/services/room-operations.service.ts:67-80`).                           | Keep derived `VACANT/OCCUPIED`; optional arrival/departure labels remain read-only projections. Never write occupancy or split a booking.                                   | Booking/HOLD transaction and inventory exclusion own concurrency; occupancy has no independent mutation.                  | Booking audit/outbox events; room operations UI derives the display at query time.                                  |
| C. Housekeeping           | `rooms.housekeeping_status` is `CLEAN/DIRTY/CLEANING`; `CatalogService` permits `CLEAN -> DIRTY`, `DIRTY -> CLEANING`, `CLEANING -> CLEAN` (`apps/api/src/catalog/catalog.service.ts:810-842,971-980`).            | Preserve enum and transitions. Checkout is the authoritative final `DIRTY` transition; a continuing stay has no nightly transition.                                         | Catalog service/checkout transaction; room row lock at checkout and housekeeping task uniqueness.                         | `ROOM_HOUSEKEEPING_UPDATED`/booking audit where current paths emit it; UI shows housekeeping separately.            |
| D. Maintenance            | `maintenance_blocks.status` is `ACTIVE/CANCELLED`, with `[starts_at, ends_at)` and a separate inventory block. Check-in queries active blocks; `RoomOperationsService` derives `maintenanceState` (`ACTIVE/NONE`). | Make interval maintenance the authoritative maintenance axis. Keep `rooms.status=MAINTENANCE` as a compatibility activation state, never as a substitute for a dated block. | Catalog maintenance create/cancel service; interval overlap and room/property locks.                                      | `MAINTENANCE_CREATED`/`MAINTENANCE_CANCELLED`; UI shows maintenance independently and blocks availability/check-in. |

Illegal transitions include manual occupancy changes, `CLEAN -> CLEAN` as a fake verification, nightly `DIRTY`, cancellation from `CHECKED_IN`, no-show from `HOLD`, and maintenance cancellation that leaves an active interval block. All high-impact mutations remain audited.

## Final checkout invariant

`one booking -> one final CHECKED_OUT transition -> one inventory release -> one DIRTY transition -> one idempotent final TURNOVER lifecycle`.

The existing implementation locks the assigned room, updates booking/room, inserts `TURNOVER ... ON CONFLICT DO NOTHING`, releases the booking block, writes audit, and enqueues outbox (`admin-booking-lifecycle.service.ts:564-615`). No nightly checkout, dirty transition, or turnover task is permitted.
