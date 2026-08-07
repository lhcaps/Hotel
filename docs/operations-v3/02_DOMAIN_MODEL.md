# Domain model and invariants

## Repository-grounded entities

- `properties`: property timezone and policy authority (`packages/database/src/schema.ts:276-309`).
- `room_types` and `rooms`: customer-facing type/capacity versus physical inventory; `rooms` has operational status and housekeeping status.
- `quotes`: immutable requested interval and JSON pricing snapshot (`schema.ts:694-760`).
- `bookings`: one `room_id`, one interval, one quote link, one price/cancellation snapshot, one access-pass version (`schema.ts:762-920`).
- `room_inventory_blocks`: one booking-owned interval or one maintenance-owned interval (`schema.ts:1415-1469`).
- `payments`: one property-scoped aggregate per booking (`schema.ts:1092-1127`) with provider attempts/events separately.
- `housekeeping_tasks`: durable `ARRIVAL_PREP`/`TURNOVER` work queue, deliberately separate from room condition (`schema.ts:922-981`).
- `audit_events` and `outbox_events`: append-only/auditable lifecycle evidence.

## Invariants

1. A customer stay is represented by exactly one booking row and one booking code.
2. A booking has exactly one physical `room_id`; its immutable `check_in` and `check_out` cover the whole stay.
3. Interval arithmetic is half-open `[start, end)`; touching intervals do not overlap.
4. The GiST exclusion constraint `room_inventory_blocks_active_overlap_excl` prevents overlapping active blocks for a physical room, including maintenance blocks.
5. HOLD allocation uses the complete interval and `FOR UPDATE SKIP LOCKED`; no nightly allocation or room stitching is legal.
6. Price, payment amount, cancellation policy, and room assignment become server-owned snapshots at the relevant commitment boundary.
7. A continuing stay never becomes dirty between nights and never creates a nightly turnover task.
8. Final checkout is one booking transition, one inventory release, one dirty transition, and one idempotent final `TURNOVER` task.
9. Public/customer contracts do not expose physical room code, internal inventory ids, provider secrets, or client-authoritative amounts.

## Derived values

`durationMinutes` is deterministically derived from immutable instants. `displayNightCount` is a presentation value derived from those instants plus an immutable property-timezone snapshot; it should not be a second authority. If a timezone snapshot is not present in the old quote shape, the adapter must use the captured cancellation-policy timezone or explicitly mark the old quote as legacy rather than guessing.

## Compatibility boundary

The current booking state enum is retained in B0. Operational/activation, occupancy, housekeeping, and maintenance are separate axes described in `03_STATE_MACHINES.md`; none may be represented by a second booking per night.
