-- Phase 5 widens booking immutability to cover every fact captured at HOLD
-- creation. status, expired_at, and updated_at remain mutable for lifecycle
-- transitions.
CREATE OR REPLACE FUNCTION reject_booking_immutable_fact_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.quote_id IS DISTINCT FROM OLD.quote_id THEN
    RAISE EXCEPTION 'bookings.quote_id is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.booking_code IS DISTINCT FROM OLD.booking_code THEN
    RAISE EXCEPTION 'bookings.booking_code is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.property_id IS DISTINCT FROM OLD.property_id THEN
    RAISE EXCEPTION 'bookings.property_id is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.room_type_id IS DISTINCT FROM OLD.room_type_id THEN
    RAISE EXCEPTION 'bookings.room_type_id is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.room_id IS DISTINCT FROM OLD.room_id THEN
    RAISE EXCEPTION 'bookings.room_id is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.check_in IS DISTINCT FROM OLD.check_in THEN
    RAISE EXCEPTION 'bookings.check_in is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.check_out IS DISTINCT FROM OLD.check_out THEN
    RAISE EXCEPTION 'bookings.check_out is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.adults IS DISTINCT FROM OLD.adults THEN
    RAISE EXCEPTION 'bookings.adults is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.children IS DISTINCT FROM OLD.children THEN
    RAISE EXCEPTION 'bookings.children is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION 'bookings.currency is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.gross_amount_vnd IS DISTINCT FROM OLD.gross_amount_vnd THEN
    RAISE EXCEPTION 'bookings.gross_amount_vnd is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.discount_amount_vnd IS DISTINCT FROM OLD.discount_amount_vnd THEN
    RAISE EXCEPTION 'bookings.discount_amount_vnd is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.final_amount_vnd IS DISTINCT FROM OLD.final_amount_vnd THEN
    RAISE EXCEPTION 'bookings.final_amount_vnd is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.pricing_rule_version IS DISTINCT FROM OLD.pricing_rule_version THEN
    RAISE EXCEPTION 'bookings.pricing_rule_version is immutable' USING ERRCODE = 'P0001';
  END IF;
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
-- booking_contacts is written exactly once per booking and never mutated.
CREATE FUNCTION reject_booking_contact_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'booking_contacts is immutable' USING ERRCODE = 'P0001';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER booking_contacts_reject_mutation
BEFORE UPDATE OR DELETE ON booking_contacts
FOR EACH ROW EXECUTE FUNCTION reject_booking_contact_mutation();
--> statement-breakpoint
UPDATE schema_metadata
SET schema_version = 'phase-5-booking-hold-guest-access-v1', applied_at = CURRENT_TIMESTAMP
WHERE id = 1;
