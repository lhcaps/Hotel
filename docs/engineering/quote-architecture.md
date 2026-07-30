# Quote architecture

`POST /api/v1/quotes` validates a public request, revalidates capacity and inventory, loads the current tier-scoped catalog, and persists an immutable snapshot. The client cannot submit a total or chosen plan.

Quotes contain a room type, interval, occupancy, server pricing breakdown, and expiry only; no PII or physical room is stored. PostgreSQL rejects quote UPDATE and DELETE. TTL is exactly 15 minutes from PostgreSQL `CURRENT_TIMESTAMP`; retrieval compares expiry with PostgreSQL time and returns a typed unavailable result without mutating the row.

Phase 5 must revalidate an unexpired quote and current inventory before creating a HOLD; this phase never allocates or reserves a room.
