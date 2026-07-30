-- Phase 6C coupon reference closure (migration 0010).
--
-- Forward-only migration. Does not modify 0000..0009.
--
-- Closes the application insert / disable race identified in Stage B:
--
--   1. application validation trigger (booking_coupon_applications_validate_insert)
--      read the coupon row WITHOUT FOR UPDATE;
--   2. first-reference marker trigger
--      (mark_coupon_first_referenced_on_application_insert) acquired the
--      coupon lock AFTER the validation had already read ACTIVE;
--   3. a concurrent ADMIN disable that committed between the two reads
--      left the application insert committing against a now-DISABLED
--      definition.
--
-- Replaces the two BEFORE INSERT triggers on
-- booking_coupon_applications with a single deterministic trigger/function
-- that locks the parent coupon row FOR UPDATE before validating and that
-- sets first_referenced_at inside the same transaction. The replacement
-- does not depend on alphabetical trigger ordering.
--
-- Tightens coupons.first_referenced_at immutability: once a non-null
-- value is set, the column is strictly immutable. Any subsequent UPDATE
-- that would change, clear, or move the value is rejected.
--
-- Preserves:
--   - first_referenced_at backfill from 0009;
--   - DISABLED -> ACTIVE rejection and disabled_at clear rejection
--     from 0009;
--   - economic and scope immutability from 0008/0009;
--   - application snapshot immutability and lifecycle transitions from
--     0008 (RESERVED -> REDEEMED|RELEASED still permitted after disable);
--   - 0000..0009 byte identity.
DROP TRIGGER IF EXISTS booking_coupon_applications_validate_insert ON booking_coupon_applications;--> statement-breakpoint
DROP TRIGGER IF EXISTS mark_coupon_first_referenced_on_application_insert ON booking_coupon_applications;--> statement-breakpoint
-- Single deterministic BEFORE INSERT trigger that locks the parent coupon
-- row FOR UPDATE before validating and that establishes the first-reference
-- marker inside the same transaction. This trigger does not depend on
-- alphabetical ordering of other triggers; it is the only BEFORE INSERT
-- trigger on this table.
CREATE OR REPLACE FUNCTION validate_booking_coupon_application_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  definition coupons%ROWTYPE;
  booking_row bookings%ROWTYPE;
  quote_coupon_id uuid;
BEGIN
  -- Lock the coupon row first so a concurrent ADMIN disable cannot
  -- interleave between validation and the first-reference marker.
  SELECT * INTO definition
    FROM coupons
   WHERE id = NEW.coupon_id AND property_id = NEW.property_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'coupon application definition mismatch' USING ERRCODE = '23503';
  END IF;
  IF definition.status = 'DISABLED' THEN
    RAISE EXCEPTION 'coupon is disabled' USING ERRCODE = 'P0001';
  END IF;

  -- Establish first_referenced_at using PostgreSQL time inside the same
  -- lock window. The protect_coupon_first_referenced_at trigger enforces
  -- strict immutability on subsequent UPDATEs.
  UPDATE coupons
     SET first_referenced_at = COALESCE(first_referenced_at, CURRENT_TIMESTAMP)
   WHERE id = NEW.coupon_id;

  SELECT * INTO booking_row FROM bookings WHERE id = NEW.booking_id AND property_id = NEW.property_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'coupon application booking mismatch' USING ERRCODE = '23503';
  END IF;

  SELECT q.coupon_id INTO quote_coupon_id FROM quotes q WHERE q.id = booking_row.quote_id;
  IF quote_coupon_id IS DISTINCT FROM NEW.coupon_id THEN
    RAISE EXCEPTION 'coupon application does not match booking quote' USING ERRCODE = '23514';
  END IF;

  IF NEW.gross_amount_vnd IS DISTINCT FROM booking_row.gross_amount_vnd
     OR NEW.discount_amount_vnd IS DISTINCT FROM booking_row.discount_amount_vnd
     OR NEW.final_amount_vnd IS DISTINCT FROM booking_row.final_amount_vnd THEN
    RAISE EXCEPTION 'coupon application amounts do not match booking' USING ERRCODE = '23514';
  END IF;

  IF definition.total_usage_limit IS NULL AND definition.per_customer_limit IS NULL THEN
    IF NEW.application_status <> 'ASSOCIATED' OR NEW.quota_reserved THEN
      RAISE EXCEPTION 'unlimited coupon application must be associated' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.application_status <> 'RESERVED' OR NOT NEW.quota_reserved THEN
      RAISE EXCEPTION 'limited coupon application must be reserved' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER booking_coupon_applications_validate_insert
BEFORE INSERT ON booking_coupon_applications
FOR EACH ROW EXECUTE FUNCTION validate_booking_coupon_application_insert();--> statement-breakpoint
-- Tighten first_referenced_at immutability. Once a non-null value is set,
-- any UPDATE that would change the value is rejected. Direct SQL cannot
-- bypass this. The trigger permits the marker to be set for the first
-- time (OLD IS NULL, NEW IS NOT NULL) and silently leaves later
-- identical-value writes alone.
CREATE OR REPLACE FUNCTION protect_coupon_first_referenced_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.first_referenced_at IS NOT NULL
     AND NEW.first_referenced_at IS DISTINCT FROM OLD.first_referenced_at THEN
    RAISE EXCEPTION 'coupons.first_referenced_at is strictly immutable after first non-null value' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
-- Bump schema version. The expected version constant lives in
-- packages/database/src/schema-status.ts and is updated to match.
UPDATE schema_metadata
SET schema_version = 'phase-6-coupon-core-v3', applied_at = CURRENT_TIMESTAMP
WHERE id = 1;