-- INV-001/INV-002: GiST equality plus tstzrange overlap enforces one ACTIVE
-- allocation per physical room using half-open [start, end) intervals.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE room_inventory_blocks
  ADD CONSTRAINT room_inventory_blocks_active_overlap_excl
  EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status = 'ACTIVE');
--> statement-breakpoint
-- Operational partial indexes intentionally contain no CURRENT_TIMESTAMP predicate.
-- A valid HOLD is selected transactionally with
-- status = 'HOLD' AND hold_expires_at > CURRENT_TIMESTAMP.
CREATE INDEX bookings_current_hold_idx
  ON bookings (property_id, hold_expires_at)
  WHERE status = 'HOLD';
--> statement-breakpoint
CREATE INDEX bookings_blocking_room_interval_idx
  ON bookings (room_id, check_in, check_out)
  WHERE status IN ('HOLD', 'CONFIRMED', 'CHECKED_IN');
--> statement-breakpoint
CREATE INDEX room_inventory_blocks_active_room_interval_idx
  ON room_inventory_blocks (room_id, starts_at, ends_at)
  WHERE status = 'ACTIVE';
--> statement-breakpoint
CREATE INDEX outbox_events_pending_available_idx
  ON outbox_events (available_at, created_at)
  WHERE status = 'PENDING';
--> statement-breakpoint
CREATE INDEX rate_plans_active_property_code_idx
  ON rate_plans (property_id, code)
  WHERE status = 'ACTIVE';
--> statement-breakpoint
-- Expression indexes make catalog identifiers case-insensitive at the database boundary.
CREATE UNIQUE INDEX properties_code_ci_uq ON properties (lower(code));
--> statement-breakpoint
CREATE UNIQUE INDEX rooms_property_room_number_ci_uq
  ON rooms (property_id, lower(room_number));
--> statement-breakpoint
-- INV-025: audit_events is append-only. PostgreSQL rejects every UPDATE/DELETE,
-- including direct SQL that bypasses the application.
CREATE FUNCTION reject_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only' USING ERRCODE = 'P0001';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_events_reject_mutation
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();
--> statement-breakpoint
-- INV-006 and HOLD TTL: the captured price and hold deadline are immutable facts.
-- No clock-dependent CHECK is used; only changes to those facts are rejected.
CREATE FUNCTION reject_booking_immutable_fact_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.hold_expires_at IS DISTINCT FROM OLD.hold_expires_at THEN
    RAISE EXCEPTION 'bookings.hold_expires_at is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.price_snapshot IS DISTINCT FROM OLD.price_snapshot THEN
    RAISE EXCEPTION 'bookings.price_snapshot is immutable' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER bookings_reject_immutable_fact_mutation
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION reject_booking_immutable_fact_mutation();
--> statement-breakpoint
INSERT INTO schema_metadata (id, schema_version, applied_at)
VALUES (1, 'phase-2-initial-v1', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE
SET schema_version = EXCLUDED.schema_version,
    applied_at = EXCLUDED.applied_at;
