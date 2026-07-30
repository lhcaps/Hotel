-- Phase 6C coupon concurrency hardening (migration 0009).
--
-- Forward-only migration. Does not modify 0000..0008.
--
-- Adds:
--  - coupons.first_referenced_at timestamptz nullable column;
--  - first-reference triggers on booking_coupon_applications and quotes;
--  - replacement scope-mutation trigger that locks the parent coupon row
--    and uses first_referenced_at instead of SELECT EXISTS;
--  - replacement economic-mutation trigger that also rejects DISABLED ->
--    ACTIVE and clearing of disabled_at;
--  - DISABLED-aware validate-insert trigger for booking_coupon_applications.
--
-- Backfills first_referenced_at for already-referenced coupons using the
-- minimum available timestamp from quotes.created_at and
-- booking_coupon_applications.created_at. When neither is available, the
-- migration time is used and the approximation is documented.
ALTER TABLE coupons ADD COLUMN first_referenced_at timestamptz;--> statement-breakpoint
UPDATE coupons
   SET first_referenced_at = LEAST(
         (SELECT min(q.created_at) FROM quotes q WHERE q.coupon_id = coupons.id),
         (SELECT min(bca.created_at) FROM booking_coupon_applications bca WHERE bca.coupon_id = coupons.id),
         CURRENT_TIMESTAMP
       )
 WHERE EXISTS (SELECT 1 FROM quotes q WHERE q.coupon_id = coupons.id)
    OR EXISTS (SELECT 1 FROM booking_coupon_applications bca WHERE bca.coupon_id = coupons.id);--> statement-breakpoint
-- Hard invariant: first_referenced_at can only be set once and cannot be
-- cleared or moved backwards. Direct SQL cannot bypass this.
CREATE OR REPLACE FUNCTION protect_coupon_first_referenced_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.first_referenced_at IS NOT NULL AND (
        NEW.first_referenced_at IS NULL
        OR NEW.first_referenced_at < OLD.first_referenced_at
      ) THEN
    RAISE EXCEPTION 'coupons.first_referenced_at is monotonic and cannot be cleared' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER coupons_protect_first_referenced_at
BEFORE UPDATE ON coupons
FOR EACH ROW EXECUTE FUNCTION protect_coupon_first_referenced_at();--> statement-breakpoint
-- Mark first reference on a quote that carries a coupon_id.
-- Locks the parent coupon row first so a concurrent first-reference
-- transaction cannot interleave with an ADMIN mutation.
CREATE OR REPLACE FUNCTION mark_coupon_first_referenced_on_quote()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.coupon_id IS NOT NULL THEN
    PERFORM 1 FROM coupons WHERE id = NEW.coupon_id FOR UPDATE;
    UPDATE coupons
       SET first_referenced_at = COALESCE(first_referenced_at, CURRENT_TIMESTAMP)
     WHERE id = NEW.coupon_id;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER mark_coupon_first_referenced_on_quote_insert
BEFORE INSERT ON quotes
FOR EACH ROW EXECUTE FUNCTION mark_coupon_first_referenced_on_quote();--> statement-breakpoint
-- Mark first reference on a booking coupon application.
-- Locks the parent coupon row first.
CREATE OR REPLACE FUNCTION mark_coupon_first_referenced_on_application()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1 FROM coupons WHERE id = NEW.coupon_id FOR UPDATE;
  UPDATE coupons
     SET first_referenced_at = COALESCE(first_referenced_at, CURRENT_TIMESTAMP)
   WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER mark_coupon_first_referenced_on_application_insert
BEFORE INSERT ON booking_coupon_applications
FOR EACH ROW EXECUTE FUNCTION mark_coupon_first_referenced_on_application();--> statement-breakpoint
-- Replace the existing economic-mutation trigger to also enforce the
-- terminal-state policy: DISABLED -> ACTIVE is rejected and disabled_at
-- cannot be cleared after disable. The first_reference_at check replaces
-- the SELECT EXISTS race window.
DROP TRIGGER IF EXISTS coupons_reject_referenced_economic_mutation ON coupons;--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_referenced_coupon_economic_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'DISABLED' AND NEW.status = 'ACTIVE' THEN
    RAISE EXCEPTION 'disabled coupon cannot be re-enabled' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.disabled_at IS NOT NULL AND NEW.disabled_at IS NULL THEN
    RAISE EXCEPTION 'disabled_at cannot be cleared after disable' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.first_referenced_at IS NOT NULL AND (
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
      ) THEN
    RAISE EXCEPTION 'referenced coupon economics are immutable' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER coupons_reject_referenced_economic_mutation
BEFORE UPDATE ON coupons
FOR EACH ROW EXECUTE FUNCTION reject_referenced_coupon_economic_mutation();--> statement-breakpoint
-- Replace the existing scope-mutation trigger. The new trigger locks the
-- parent coupon row(s) before deciding whether mutation is allowed.
-- For UPDATE that changes coupon_id, both parent rows are locked in
-- deterministic UUID order to avoid cross-coupon deadlocks.
DROP TRIGGER IF EXISTS coupon_room_types_reject_referenced_mutation ON coupon_room_types;--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_referenced_coupon_scope_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_parent_id uuid;
  new_parent_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_parent_id := OLD.coupon_id;
    PERFORM 1 FROM coupons WHERE id = old_parent_id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM coupons WHERE id = old_parent_id AND first_referenced_at IS NOT NULL) THEN
      RAISE EXCEPTION 'referenced coupon room scope is immutable' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;

  new_parent_id := NEW.coupon_id;
  IF TG_OP = 'UPDATE' THEN
    old_parent_id := OLD.coupon_id;
    IF old_parent_id <> new_parent_id THEN
      -- Lock both parents in deterministic UUID order to avoid cross-coupon deadlocks.
      IF old_parent_id < new_parent_id THEN
        PERFORM 1 FROM coupons WHERE id = old_parent_id FOR UPDATE;
        PERFORM 1 FROM coupons WHERE id = new_parent_id FOR UPDATE;
      ELSE
        PERFORM 1 FROM coupons WHERE id = new_parent_id FOR UPDATE;
        PERFORM 1 FROM coupons WHERE id = old_parent_id FOR UPDATE;
      END IF;
    ELSE
      PERFORM 1 FROM coupons WHERE id = new_parent_id FOR UPDATE;
    END IF;
  ELSE
    -- INSERT
    PERFORM 1 FROM coupons WHERE id = new_parent_id FOR UPDATE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM coupons
     WHERE id IN (old_parent_id, new_parent_id)
       AND first_referenced_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'referenced coupon room scope is immutable' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER coupon_room_types_reject_referenced_mutation
BEFORE INSERT OR UPDATE OR DELETE ON coupon_room_types
FOR EACH ROW EXECUTE FUNCTION reject_referenced_coupon_scope_mutation();--> statement-breakpoint
-- Reject inserts of new applications against a DISABLED coupon.
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
  IF definition.status = 'DISABLED' THEN
    RAISE EXCEPTION 'coupon is disabled' USING ERRCODE = 'P0001';
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
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS booking_coupon_applications_validate_insert ON booking_coupon_applications;--> statement-breakpoint
CREATE TRIGGER booking_coupon_applications_validate_insert
BEFORE INSERT ON booking_coupon_applications
FOR EACH ROW EXECUTE FUNCTION validate_booking_coupon_application_insert();--> statement-breakpoint
UPDATE schema_metadata
SET schema_version = 'phase-6-coupon-core-v2', applied_at = CURRENT_TIMESTAMP
WHERE id = 1;
