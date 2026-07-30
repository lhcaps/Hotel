-- Phase 6C enforces coupon scope, immutable economics after reference,
-- application creation invariants, and lifecycle protection in PostgreSQL.
CREATE OR REPLACE FUNCTION assert_coupon_room_type_scope(target_coupon_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  applies_to_all boolean;
  scope_count bigint;
BEGIN
  SELECT c.applies_to_all_room_types
    INTO applies_to_all
    FROM coupons c
   WHERE c.id = target_coupon_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*)
    INTO scope_count
    FROM coupon_room_types crt
   WHERE crt.coupon_id = target_coupon_id;

  IF applies_to_all AND scope_count <> 0 THEN
    RAISE EXCEPTION 'all-room coupon cannot have room-type rows' USING ERRCODE = '23514';
  END IF;
  IF NOT applies_to_all AND scope_count = 0 THEN
    RAISE EXCEPTION 'scoped coupon requires at least one room type' USING ERRCODE = '23514';
  END IF;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION check_coupon_scope_from_coupon()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM assert_coupon_room_type_scope(NEW.id);
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION check_coupon_scope_from_room_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM assert_coupon_room_type_scope(COALESCE(NEW.coupon_id, OLD.coupon_id));
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER coupons_scope_consistency
AFTER INSERT OR UPDATE OF applies_to_all_room_types ON coupons
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_coupon_scope_from_coupon();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER coupon_room_types_scope_consistency
AFTER INSERT OR UPDATE OR DELETE ON coupon_room_types
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_coupon_scope_from_room_type();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_referenced_coupon_economic_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    NEW.property_id IS DISTINCT FROM OLD.property_id
    OR NEW.normalized_code IS DISTINCT FROM OLD.normalized_code
    OR NEW.discount_type IS DISTINCT FROM OLD.discount_type
    OR NEW.fixed_amount_vnd IS DISTINCT FROM OLD.fixed_amount_vnd
    OR NEW.percentage_basis_points IS DISTINCT FROM OLD.percentage_basis_points
    OR NEW.maximum_discount_vnd IS DISTINCT FROM OLD.maximum_discount_vnd
    OR NEW.minimum_order_amount_vnd IS DISTINCT FROM OLD.minimum_order_amount_vnd
    OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
    OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
    OR NEW.applies_to_all_room_types IS DISTINCT FROM OLD.applies_to_all_room_types
    OR NEW.total_usage_limit IS DISTINCT FROM OLD.total_usage_limit
    OR NEW.per_customer_limit IS DISTINCT FROM OLD.per_customer_limit
  ) AND (
    EXISTS (SELECT 1 FROM quotes q WHERE q.coupon_id = OLD.id)
    OR EXISTS (SELECT 1 FROM booking_coupon_applications bca WHERE bca.coupon_id = OLD.id)
  ) THEN
    RAISE EXCEPTION 'referenced coupon economics are immutable' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER coupons_reject_referenced_economic_mutation
BEFORE UPDATE ON coupons
FOR EACH ROW EXECUTE FUNCTION reject_referenced_coupon_economic_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_referenced_coupon_scope_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_coupon_id uuid := COALESCE(OLD.coupon_id, NEW.coupon_id);
BEGIN
  IF EXISTS (SELECT 1 FROM quotes q WHERE q.coupon_id = target_coupon_id)
     OR EXISTS (SELECT 1 FROM booking_coupon_applications bca WHERE bca.coupon_id = target_coupon_id) THEN
    RAISE EXCEPTION 'referenced coupon room scope is immutable' USING ERRCODE = 'P0001';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint
CREATE TRIGGER coupon_room_types_reject_referenced_mutation
BEFORE INSERT OR UPDATE OR DELETE ON coupon_room_types
FOR EACH ROW EXECUTE FUNCTION reject_referenced_coupon_scope_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION validate_booking_coupon_application_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  definition coupons%ROWTYPE;
  booking_row bookings%ROWTYPE;
  quote_coupon_id uuid;
BEGIN
  SELECT * INTO definition FROM coupons WHERE id = NEW.coupon_id AND property_id = NEW.property_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'coupon application definition mismatch' USING ERRCODE = '23503';
  END IF;

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
$$;
--> statement-breakpoint
CREATE TRIGGER booking_coupon_applications_validate_insert
BEFORE INSERT ON booking_coupon_applications
FOR EACH ROW EXECUTE FUNCTION validate_booking_coupon_application_insert();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION protect_booking_coupon_application()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.property_id IS DISTINCT FROM OLD.property_id
     OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
     OR NEW.coupon_id IS DISTINCT FROM OLD.coupon_id
     OR NEW.customer_email_digest IS DISTINCT FROM OLD.customer_email_digest
     OR NEW.discount_type IS DISTINCT FROM OLD.discount_type
     OR NEW.fixed_amount_vnd IS DISTINCT FROM OLD.fixed_amount_vnd
     OR NEW.percentage_basis_points IS DISTINCT FROM OLD.percentage_basis_points
     OR NEW.maximum_discount_vnd IS DISTINCT FROM OLD.maximum_discount_vnd
     OR NEW.minimum_order_amount_vnd IS DISTINCT FROM OLD.minimum_order_amount_vnd
     OR NEW.gross_amount_vnd IS DISTINCT FROM OLD.gross_amount_vnd
     OR NEW.discount_amount_vnd IS DISTINCT FROM OLD.discount_amount_vnd
     OR NEW.final_amount_vnd IS DISTINCT FROM OLD.final_amount_vnd
     OR NEW.coupon_code_snapshot IS DISTINCT FROM OLD.coupon_code_snapshot
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'coupon application snapshot is immutable' USING ERRCODE = 'P0001';
  END IF;

  IF OLD.application_status = 'ASSOCIATED'
     AND NEW.application_status NOT IN ('ASSOCIATED', 'REDEEMED', 'RELEASED') THEN
    RAISE EXCEPTION 'invalid associated coupon transition' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.application_status = 'RESERVED'
     AND NEW.application_status NOT IN ('RESERVED', 'REDEEMED', 'RELEASED') THEN
    RAISE EXCEPTION 'invalid reserved coupon transition' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.application_status IN ('REDEEMED', 'RELEASED')
     AND NEW.application_status IS DISTINCT FROM OLD.application_status THEN
    RAISE EXCEPTION 'terminal coupon application cannot transition' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER booking_coupon_applications_protect_update
BEFORE UPDATE ON booking_coupon_applications
FOR EACH ROW EXECUTE FUNCTION protect_booking_coupon_application();
--> statement-breakpoint
UPDATE schema_metadata
SET schema_version = 'phase-6-coupon-core-v1', applied_at = CURRENT_TIMESTAMP
WHERE id = 1;
