# Current room state model

## Authority

PostgreSQL is the authoritative store for room, booking, maintenance, housekeeping, and inventory state. Redis is an operational cache/lock aid and is not the source of truth. Availability is derived from interval overlap against room_inventory_blocks and the server-side catalog/pricing rules.

No direct production database query or DDL was used in this audit. The model below is derived from the current source, contracts, local PostgreSQL tests, and the sanitized production viewer projection.

## State layers

| Layer                  | Current model                                                                             | Public exposure                                            | Viewer exposure                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Physical room catalog  | Room belongs to a property and room type; room number/code exists server-side             | Never exposed by public catalog or availability            | Allowed only as room operational identity                                                      |
| Room operational state | Available/occupied/dirty/out-of-service style status from current room/housekeeping state | Not exposed                                                | Exposed as the minimum room-status projection                                                  |
| Booking block          | PostgreSQL room_inventory_blocks with interval, block type, status, and release state     | Aggregated to availableRoomCount                           | Occupancy window/next booking timing may be shown without customer identity or financial facts |
| Maintenance block      | PostgreSQL maintenance block plus corresponding inventory block                           | Not exposed                                                | Minimal maintenance indication/reason is bounded by the viewer projection                      |
| Housekeeping           | Current operational housekeeping task/state                                               | Not exposed                                                | Sanitized status only                                                                          |
| Commercial state       | Quotes, rate plans, payments, coupons, refunds, revenue                                   | Public totals only when server-calculated in a quote/offer | Not exposed to ROOM_STATUS_VIEWER                                                              |

## Lifecycle transitions

The current service protects booking transitions with PostgreSQL row locking and validates status, payment, timing, inventory, cancellation policy, and audit effects in one transaction. Cancellation without an immutable policy snapshot is intentionally rejected for operational review. The local lifecycle failures were caused by test fixtures that predate this rule, not by evidence that the production service bypasses it.

The safe public flow is:

public room type projection -> interval search -> server offer -> immutable quote -> supported HOLD request -> server allocation/inventory block -> customer or admin lifecycle.

The safe viewer flow is:

server-derived viewer identity -> sanitized room operations read -> no customer/payment/revenue/provider fields -> no mutation.

## Current closure

The authority model is coherent and public leakage checks passed. Closure remains PARTIAL because the viewer’s current UI/read scope is broader than the stated final viewer contract and the local lifecycle/reporting/concurrency fixtures need repair and rerun.
