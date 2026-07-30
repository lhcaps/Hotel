# Admin catalog architecture

`CatalogService` is the transaction boundary for Property, Price Tier, Room Type, Amenity, Room, and Maintenance mutations. `CatalogRepository` uses the transaction client and `AuditRepository` appends scrubbed `audit_events` before commit; an audit failure therefore rolls back the mutation.

Archive is a state transition, not a delete. Catalog scope is the one current property and database composite foreign keys enforce property ownership.

Maintenance creation inserts both `maintenance_blocks` and ACTIVE `room_inventory_blocks`. PostgreSQL's GiST exclusion constraint is the final overlap authority; SQLSTATE `23P01` becomes a safe catalog conflict. Cancellation preserves source history, marks its ledger record RELEASED, and is idempotent.
