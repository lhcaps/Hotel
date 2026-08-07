CREATE TYPE "public"."pricing_policy_applicability_basis" AS ENUM('QUOTE_INSTANT', 'STAY_START');--> statement-breakpoint
CREATE TYPE "public"."pricing_policy_billing_model" AS ENUM('FIXED_OCCURRENCE', 'STARTED_UNIT');--> statement-breakpoint
CREATE TYPE "public"."pricing_policy_boundary_position" AS ENUM('LEADING', 'TRAILING');--> statement-breakpoint
CREATE TYPE "public"."pricing_policy_component_kind" AS ENUM('BASE_STAY', 'EXTENSION');--> statement-breakpoint
CREATE TYPE "public"."pricing_policy_coverage_model" AS ENUM('FIXED_ELAPSED', 'LOCAL_CLOCK_WINDOW', 'REQUEST_BOUNDARY');--> statement-breakpoint
CREATE TYPE "public"."pricing_policy_version_status" AS ENUM('DRAFT', 'PUBLISHED', 'RETIRED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "pricing_policy_component_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_version_id" uuid NOT NULL,
	"predecessor_component_id" uuid NOT NULL,
	"successor_component_id" uuid NOT NULL,
	"restriction_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_policy_component_edges_policy_id_uq" UNIQUE("policy_version_id","id"),
	CONSTRAINT "pricing_policy_component_edges_directed_uq" UNIQUE("policy_version_id","predecessor_component_id","successor_component_id"),
	CONSTRAINT "pricing_policy_component_edges_metadata_ck" CHECK ("pricing_policy_component_edges"."restriction_metadata" IS NULL OR jsonb_typeof("pricing_policy_component_edges"."restriction_metadata") = 'object')
);
--> statement-breakpoint
CREATE TABLE "pricing_policy_component_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"policy_version_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"price_tier_id" uuid NOT NULL,
	"amount_vnd" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_policy_component_prices_policy_component_tier_uq" UNIQUE("policy_version_id","component_id","price_tier_id"),
	CONSTRAINT "pricing_policy_component_prices_amount_positive_ck" CHECK ("pricing_policy_component_prices"."amount_vnd" > 0)
);
--> statement-breakpoint
CREATE TABLE "pricing_policy_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_version_id" uuid NOT NULL,
	"component_code" text NOT NULL,
	"component_kind" "pricing_policy_component_kind" NOT NULL,
	"coverage_model" "pricing_policy_coverage_model" NOT NULL,
	"billing_model" "pricing_policy_billing_model" NOT NULL,
	"fixed_duration_minutes" integer,
	"local_start_minute_inclusive" integer,
	"local_end_minute_exclusive" integer,
	"local_end_day_offset" smallint,
	"boundary_position" "pricing_policy_boundary_position",
	"boundary_min_duration_minutes" integer,
	"boundary_max_duration_minutes" integer,
	"billing_unit_minutes" integer,
	"minimum_billing_units" integer,
	"maximum_billing_units" integer,
	"maximum_occurrences_per_candidate" integer DEFAULT 1 NOT NULL,
	"condition_complexity_rank" integer DEFAULT 0 NOT NULL,
	"tie_break_rank" integer DEFAULT 0 NOT NULL,
	"restriction_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"display_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"legacy_provenance" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_policy_components_policy_version_id_id_uq" UNIQUE("policy_version_id","id"),
	CONSTRAINT "pricing_policy_components_policy_code_uq" UNIQUE("policy_version_id","component_code"),
	CONSTRAINT "pricing_policy_components_code_ck" CHECK ("pricing_policy_components"."component_code" ~ '^[A-Z0-9_]{1,64}$'),
	CONSTRAINT "pricing_policy_components_coverage_shape_ck" CHECK (("pricing_policy_components"."coverage_model" = 'FIXED_ELAPSED'
            AND "pricing_policy_components"."fixed_duration_minutes" IS NOT NULL
            AND "pricing_policy_components"."fixed_duration_minutes" BETWEEN 15 AND 44640
            AND "pricing_policy_components"."fixed_duration_minutes" % 15 = 0
            AND "pricing_policy_components"."local_start_minute_inclusive" IS NULL
            AND "pricing_policy_components"."local_end_minute_exclusive" IS NULL
            AND "pricing_policy_components"."local_end_day_offset" IS NULL
            AND "pricing_policy_components"."boundary_position" IS NULL
            AND "pricing_policy_components"."boundary_min_duration_minutes" IS NULL
            AND "pricing_policy_components"."boundary_max_duration_minutes" IS NULL)
          OR ("pricing_policy_components"."coverage_model" = 'LOCAL_CLOCK_WINDOW'
            AND "pricing_policy_components"."fixed_duration_minutes" IS NULL
            AND "pricing_policy_components"."local_start_minute_inclusive" IS NOT NULL
            AND "pricing_policy_components"."local_end_minute_exclusive" IS NOT NULL
            AND "pricing_policy_components"."local_end_day_offset" IS NOT NULL
            AND "pricing_policy_components"."local_start_minute_inclusive" BETWEEN 0 AND 1425
            AND "pricing_policy_components"."local_start_minute_inclusive" % 15 = 0
            AND "pricing_policy_components"."local_end_minute_exclusive" BETWEEN 15 AND 1440
            AND "pricing_policy_components"."local_end_minute_exclusive" % 15 = 0
            AND "pricing_policy_components"."local_end_day_offset" IN (0, 1)
            AND "pricing_policy_components"."local_end_minute_exclusive" + "pricing_policy_components"."local_end_day_offset" * 1440 > "pricing_policy_components"."local_start_minute_inclusive"
            AND "pricing_policy_components"."boundary_position" IS NULL
            AND "pricing_policy_components"."boundary_min_duration_minutes" IS NULL
            AND "pricing_policy_components"."boundary_max_duration_minutes" IS NULL)
          OR ("pricing_policy_components"."coverage_model" = 'REQUEST_BOUNDARY'
            AND "pricing_policy_components"."fixed_duration_minutes" IS NULL
            AND "pricing_policy_components"."local_start_minute_inclusive" IS NULL
            AND "pricing_policy_components"."local_end_minute_exclusive" IS NULL
            AND "pricing_policy_components"."local_end_day_offset" IS NULL
            AND "pricing_policy_components"."boundary_position" IS NOT NULL
            AND "pricing_policy_components"."boundary_min_duration_minutes" IS NOT NULL
            AND "pricing_policy_components"."boundary_max_duration_minutes" IS NOT NULL
            AND "pricing_policy_components"."boundary_min_duration_minutes" BETWEEN 15 AND 44640
            AND "pricing_policy_components"."boundary_min_duration_minutes" % 15 = 0
            AND "pricing_policy_components"."boundary_max_duration_minutes" BETWEEN "pricing_policy_components"."boundary_min_duration_minutes" AND 44640
            AND "pricing_policy_components"."boundary_max_duration_minutes" % 15 = 0
            AND "pricing_policy_components"."maximum_occurrences_per_candidate" = 1)),
	CONSTRAINT "pricing_policy_components_billing_shape_ck" CHECK (("pricing_policy_components"."billing_model" = 'FIXED_OCCURRENCE'
            AND "pricing_policy_components"."billing_unit_minutes" IS NULL
            AND "pricing_policy_components"."minimum_billing_units" IS NULL
            AND "pricing_policy_components"."maximum_billing_units" IS NULL)
          OR ("pricing_policy_components"."billing_model" = 'STARTED_UNIT'
            AND "pricing_policy_components"."billing_unit_minutes" IS NOT NULL
            AND "pricing_policy_components"."billing_unit_minutes" BETWEEN 15 AND 44640
            AND "pricing_policy_components"."billing_unit_minutes" % 15 = 0
            AND ("pricing_policy_components"."minimum_billing_units" IS NULL OR "pricing_policy_components"."minimum_billing_units" > 0)
            AND ("pricing_policy_components"."maximum_billing_units" IS NULL OR "pricing_policy_components"."maximum_billing_units" > 0)
            AND ("pricing_policy_components"."maximum_billing_units" IS NULL OR "pricing_policy_components"."minimum_billing_units" IS NULL
              OR "pricing_policy_components"."maximum_billing_units" >= "pricing_policy_components"."minimum_billing_units"))),
	CONSTRAINT "pricing_policy_components_occurrence_rank_ck" CHECK ("pricing_policy_components"."maximum_occurrences_per_candidate" BETWEEN 1 AND 64
        AND "pricing_policy_components"."condition_complexity_rank" BETWEEN 0 AND 1000
        AND "pricing_policy_components"."tie_break_rank" BETWEEN 0 AND 1000000),
	CONSTRAINT "pricing_policy_components_metadata_ck" CHECK (jsonb_typeof("pricing_policy_components"."restriction_metadata") = 'object'
        AND jsonb_typeof("pricing_policy_components"."display_metadata") = 'object'
        AND ("pricing_policy_components"."legacy_provenance" IS NULL OR jsonb_typeof("pricing_policy_components"."legacy_provenance") = 'object'))
);
--> statement-breakpoint
CREATE TABLE "pricing_policy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"version_number" bigint NOT NULL,
	"internal_name" text NOT NULL,
	"status" "pricing_policy_version_status" DEFAULT 'DRAFT' NOT NULL,
	"applicability_basis" "pricing_policy_applicability_basis" NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_until" timestamp with time zone,
	"timezone_snapshot" text NOT NULL,
	"rule_schema_version" text NOT NULL,
	"maximum_component_lines" integer DEFAULT 64 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by" uuid,
	"published_at" timestamp with time zone,
	"retired_by" uuid,
	"retired_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"change_note" text,
	"legacy_provenance" jsonb,
	CONSTRAINT "pricing_policy_versions_property_id_id_uq" UNIQUE("property_id","id"),
	CONSTRAINT "pricing_policy_versions_property_version_uq" UNIQUE("property_id","version_number"),
	CONSTRAINT "pricing_policy_versions_version_positive_ck" CHECK ("pricing_policy_versions"."version_number" > 0),
	CONSTRAINT "pricing_policy_versions_name_ck" CHECK (btrim("pricing_policy_versions"."internal_name") <> '' AND char_length("pricing_policy_versions"."internal_name") <= 200),
	CONSTRAINT "pricing_policy_versions_effective_interval_ck" CHECK ("pricing_policy_versions"."effective_until" IS NULL OR "pricing_policy_versions"."effective_until" > "pricing_policy_versions"."effective_from"),
	CONSTRAINT "pricing_policy_versions_timezone_ck" CHECK (btrim("pricing_policy_versions"."timezone_snapshot") <> '' AND char_length("pricing_policy_versions"."timezone_snapshot") <= 100),
	CONSTRAINT "pricing_policy_versions_rule_schema_ck" CHECK ("pricing_policy_versions"."rule_schema_version" ~ '^operations-v3-b0\.2-policy-v[0-9]+$'),
	CONSTRAINT "pricing_policy_versions_component_limit_ck" CHECK ("pricing_policy_versions"."maximum_component_lines" BETWEEN 1 AND 64),
	CONSTRAINT "pricing_policy_versions_legacy_provenance_ck" CHECK ("pricing_policy_versions"."legacy_provenance" IS NULL OR jsonb_typeof("pricing_policy_versions"."legacy_provenance") = 'object'),
	CONSTRAINT "pricing_policy_versions_status_metadata_ck" CHECK (("pricing_policy_versions"."status" = 'DRAFT'
            AND "pricing_policy_versions"."published_by" IS NULL AND "pricing_policy_versions"."published_at" IS NULL
            AND "pricing_policy_versions"."retired_by" IS NULL AND "pricing_policy_versions"."retired_at" IS NULL
            AND "pricing_policy_versions"."cancelled_by" IS NULL AND "pricing_policy_versions"."cancelled_at" IS NULL
            AND "pricing_policy_versions"."cancellation_reason" IS NULL)
          OR ("pricing_policy_versions"."status" = 'PUBLISHED'
            AND "pricing_policy_versions"."published_by" IS NOT NULL AND "pricing_policy_versions"."published_at" IS NOT NULL
            AND "pricing_policy_versions"."retired_by" IS NULL AND "pricing_policy_versions"."retired_at" IS NULL
            AND "pricing_policy_versions"."cancelled_by" IS NULL AND "pricing_policy_versions"."cancelled_at" IS NULL
            AND "pricing_policy_versions"."cancellation_reason" IS NULL)
          OR ("pricing_policy_versions"."status" = 'RETIRED'
            AND "pricing_policy_versions"."published_by" IS NOT NULL AND "pricing_policy_versions"."published_at" IS NOT NULL
            AND "pricing_policy_versions"."retired_by" IS NOT NULL AND "pricing_policy_versions"."retired_at" IS NOT NULL
            AND "pricing_policy_versions"."cancelled_by" IS NULL AND "pricing_policy_versions"."cancelled_at" IS NULL
            AND "pricing_policy_versions"."cancellation_reason" IS NULL)
          OR ("pricing_policy_versions"."status" = 'CANCELLED'
            AND "pricing_policy_versions"."published_by" IS NULL AND "pricing_policy_versions"."published_at" IS NULL
            AND "pricing_policy_versions"."retired_by" IS NULL AND "pricing_policy_versions"."retired_at" IS NULL
            AND "pricing_policy_versions"."cancelled_by" IS NOT NULL AND "pricing_policy_versions"."cancelled_at" IS NOT NULL
            AND btrim("pricing_policy_versions"."cancellation_reason") <> ''))
);
--> statement-breakpoint
ALTER TABLE "pricing_policy_component_edges" ADD CONSTRAINT "pricing_policy_component_edges_policy_predecessor_fk" FOREIGN KEY ("policy_version_id","predecessor_component_id") REFERENCES "public"."pricing_policy_components"("policy_version_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_policy_component_edges" ADD CONSTRAINT "pricing_policy_component_edges_policy_successor_fk" FOREIGN KEY ("policy_version_id","successor_component_id") REFERENCES "public"."pricing_policy_components"("policy_version_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_policy_component_prices" ADD CONSTRAINT "pricing_policy_component_prices_policy_component_fk" FOREIGN KEY ("policy_version_id","component_id") REFERENCES "public"."pricing_policy_components"("policy_version_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_policy_component_prices" ADD CONSTRAINT "pricing_policy_component_prices_property_policy_fk" FOREIGN KEY ("property_id","policy_version_id") REFERENCES "public"."pricing_policy_versions"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_policy_component_prices" ADD CONSTRAINT "pricing_policy_component_prices_property_tier_fk" FOREIGN KEY ("property_id","price_tier_id") REFERENCES "public"."price_tiers"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_policy_components" ADD CONSTRAINT "pricing_policy_components_policy_version_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."pricing_policy_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_policy_versions" ADD CONSTRAINT "pricing_policy_versions_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_policy_versions" ADD CONSTRAINT "pricing_policy_versions_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_policy_versions" ADD CONSTRAINT "pricing_policy_versions_published_by_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_policy_versions" ADD CONSTRAINT "pricing_policy_versions_retired_by_fk" FOREIGN KEY ("retired_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_policy_versions" ADD CONSTRAINT "pricing_policy_versions_cancelled_by_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pricing_policy_component_edges_predecessor_idx" ON "pricing_policy_component_edges" USING btree ("policy_version_id","predecessor_component_id");--> statement-breakpoint
CREATE INDEX "pricing_policy_component_edges_successor_idx" ON "pricing_policy_component_edges" USING btree ("policy_version_id","successor_component_id");--> statement-breakpoint
CREATE INDEX "pricing_policy_component_prices_policy_idx" ON "pricing_policy_component_prices" USING btree ("policy_version_id");--> statement-breakpoint
CREATE INDEX "pricing_policy_components_policy_idx" ON "pricing_policy_components" USING btree ("policy_version_id");--> statement-breakpoint
CREATE INDEX "pricing_policy_versions_property_status_effective_idx" ON "pricing_policy_versions" USING btree ("property_id","status","effective_from");--> statement-breakpoint
CREATE INDEX "pricing_policy_versions_property_basis_idx" ON "pricing_policy_versions" USING btree ("property_id","applicability_basis");--> statement-breakpoint
ALTER TABLE "pricing_policy_versions"
  ADD CONSTRAINT "pricing_policy_versions_published_no_overlap"
  EXCLUDE USING gist (
    "property_id" WITH =,
    tstzrange(
      "effective_from",
      COALESCE("effective_until", 'infinity'::timestamptz),
      '[)'
    ) WITH &&
  )
  WHERE ("status" IN ('PUBLISHED', 'RETIRED'))
  DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
CREATE FUNCTION "operations_v3_validate_policy_root"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('RETIRED', 'CANCELLED') THEN
      RAISE EXCEPTION 'RETIRED and CANCELLED policy roots must be reached through lifecycle transitions'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'pricing policy roots are not deletable'
      USING ERRCODE = 'P0001';
  END IF;

  IF OLD.status = 'DRAFT' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.property_id IS DISTINCT FROM OLD.property_id
       OR NEW.version_number IS DISTINCT FROM OLD.version_number
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'draft pricing policy identity is immutable'
        USING ERRCODE = 'P0001';
    END IF;
    IF NEW.status NOT IN ('DRAFT', 'PUBLISHED', 'CANCELLED') THEN
      RAISE EXCEPTION 'invalid pricing policy transition from DRAFT to %', NEW.status
        USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.property_id IS DISTINCT FROM OLD.property_id
     OR NEW.version_number IS DISTINCT FROM OLD.version_number
     OR NEW.internal_name IS DISTINCT FROM OLD.internal_name
     OR NEW.applicability_basis IS DISTINCT FROM OLD.applicability_basis
     OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
     OR NEW.timezone_snapshot IS DISTINCT FROM OLD.timezone_snapshot
     OR NEW.rule_schema_version IS DISTINCT FROM OLD.rule_schema_version
     OR NEW.maximum_component_lines IS DISTINCT FROM OLD.maximum_component_lines
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.legacy_provenance IS DISTINCT FROM OLD.legacy_provenance
     OR NEW.change_note IS DISTINCT FROM OLD.change_note
  THEN
    RAISE EXCEPTION 'pricing policy root identity and commercial content are immutable'
      USING ERRCODE = 'P0001';
  END IF;

  IF OLD.status = 'PUBLISHED' AND NEW.status = 'PUBLISHED' THEN
    IF NEW.published_by IS DISTINCT FROM OLD.published_by
       OR NEW.published_at IS DISTINCT FROM OLD.published_at
       OR NEW.retired_by IS DISTINCT FROM OLD.retired_by
       OR NEW.retired_at IS DISTINCT FROM OLD.retired_at
       OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
       OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
       OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason
    THEN
      RAISE EXCEPTION 'published pricing policy metadata is immutable'
        USING ERRCODE = 'P0001';
    END IF;

    IF NEW.effective_until IS DISTINCT FROM OLD.effective_until THEN
      IF NEW.effective_until IS NULL
         OR NEW.effective_until < NEW.effective_from
         OR NEW.effective_until < transaction_timestamp()
         OR (OLD.effective_until IS NOT NULL AND NEW.effective_until >= OLD.effective_until)
      THEN
        RAISE EXCEPTION 'published pricing policy closure must be a future interval boundary'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'PUBLISHED' AND NEW.status = 'RETIRED' THEN
    IF OLD.effective_until IS NULL
       OR OLD.effective_until > transaction_timestamp()
       OR NEW.effective_until IS DISTINCT FROM OLD.effective_until
       OR NEW.published_by IS DISTINCT FROM OLD.published_by
       OR NEW.published_at IS DISTINCT FROM OLD.published_at
       OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by
       OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
       OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason
       OR NEW.retired_by IS NULL
       OR NEW.retired_at IS NULL
       OR NEW.retired_at < OLD.effective_until
       OR NEW.retired_at > transaction_timestamp()
    THEN
      RAISE EXCEPTION 'published pricing policy cannot retire before its effective interval ends'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'PUBLISHED' AND NEW.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'PUBLISHED to CANCELLED is not supported by migration 0029'
      USING ERRCODE = 'P0001';
  END IF;

  RAISE EXCEPTION 'pricing policy status transition from % to % is not allowed', OLD.status, NEW.status
    USING ERRCODE = 'P0001';
END;
$$;--> statement-breakpoint
CREATE FUNCTION "operations_v3_enforce_property_basis"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  conflicting_basis text;
BEGIN
  IF NEW.status NOT IN ('PUBLISHED', 'RETIRED') THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM "properties" WHERE "id" = NEW.property_id FOR UPDATE;

  SELECT v.applicability_basis::text
    INTO conflicting_basis
    FROM "pricing_policy_versions" v
   WHERE v.property_id = NEW.property_id
     AND v.id <> NEW.id
     AND v.status IN ('PUBLISHED', 'RETIRED')
     AND v.applicability_basis <> NEW.applicability_basis
   LIMIT 1;

  IF conflicting_basis IS NOT NULL THEN
    RAISE EXCEPTION 'property % already has published pricing basis %', NEW.property_id, conflicting_basis
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE FUNCTION "operations_v3_validate_policy_cutover_final_state"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'PUBLISHED'
     AND NEW.status = 'PUBLISHED'
     AND NEW.effective_until IS DISTINCT FROM OLD.effective_until
  THEN
    IF NOT EXISTS (
      SELECT 1
        FROM "pricing_policy_versions" successor
       WHERE successor.property_id = NEW.property_id
         AND successor.id <> NEW.id
         AND successor.status = 'PUBLISHED'
         AND successor.applicability_basis = NEW.applicability_basis
         AND successor.effective_from = NEW.effective_until
    ) THEN
      RAISE EXCEPTION 'published policy closure requires an exact published successor at the cutover'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE FUNCTION "operations_v3_freeze_policy_child"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  policy_id uuid;
  policy_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    policy_id := OLD.policy_version_id;
  ELSE
    policy_id := NEW.policy_version_id;
  END IF;

  SELECT status::text
    INTO policy_status
    FROM "pricing_policy_versions"
   WHERE id = policy_id;

  IF policy_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'pricing policy children are immutable after publication or cancellation'
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.policy_version_id IS DISTINCT FROM OLD.policy_version_id THEN
    SELECT status::text
      INTO policy_status
      FROM "pricing_policy_versions"
     WHERE id = OLD.policy_version_id;
    IF policy_status IS DISTINCT FROM 'DRAFT' THEN
      RAISE EXCEPTION 'pricing policy children cannot move out of a frozen policy'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE FUNCTION "operations_v3_validate_policy_edge"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  predecessor record;
  successor record;
BEGIN
  SELECT coverage_model::text AS coverage_model,
         boundary_position::text AS boundary_position,
         maximum_occurrences_per_candidate
    INTO predecessor
    FROM "pricing_policy_components"
   WHERE policy_version_id = NEW.policy_version_id
     AND id = NEW.predecessor_component_id;

  SELECT coverage_model::text AS coverage_model,
         boundary_position::text AS boundary_position,
         maximum_occurrences_per_candidate
    INTO successor
    FROM "pricing_policy_components"
   WHERE policy_version_id = NEW.policy_version_id
     AND id = NEW.successor_component_id;

  IF predecessor IS NULL OR successor IS NULL THEN
    RAISE EXCEPTION 'pricing policy edge endpoints must belong to the same policy'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.predecessor_component_id = NEW.successor_component_id
     AND (predecessor.maximum_occurrences_per_candidate = 1
          OR predecessor.coverage_model = 'REQUEST_BOUNDARY'
          OR predecessor.boundary_position IS NOT NULL)
  THEN
    RAISE EXCEPTION 'pricing policy self-edge is incompatible with bounded or boundary components'
      USING ERRCODE = 'P0001';
  END IF;

  IF predecessor.boundary_position = 'TRAILING' THEN
    RAISE EXCEPTION 'TRAILING request-boundary component cannot have a successor'
      USING ERRCODE = 'P0001';
  END IF;

  IF successor.boundary_position = 'LEADING' THEN
    RAISE EXCEPTION 'LEADING request-boundary component cannot have a predecessor'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "pricing_policy_versions_root_immutability"
  BEFORE INSERT OR UPDATE OR DELETE ON "pricing_policy_versions"
  FOR EACH ROW EXECUTE FUNCTION "operations_v3_validate_policy_root"();--> statement-breakpoint
CREATE TRIGGER "pricing_policy_versions_basis_guard"
  BEFORE INSERT OR UPDATE ON "pricing_policy_versions"
  FOR EACH ROW EXECUTE FUNCTION "operations_v3_enforce_property_basis"();--> statement-breakpoint
CREATE TRIGGER "pricing_policy_components_freeze_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "pricing_policy_components"
  FOR EACH ROW EXECUTE FUNCTION "operations_v3_freeze_policy_child"();--> statement-breakpoint
CREATE TRIGGER "pricing_policy_component_prices_freeze_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "pricing_policy_component_prices"
  FOR EACH ROW EXECUTE FUNCTION "operations_v3_freeze_policy_child"();--> statement-breakpoint
CREATE TRIGGER "pricing_policy_component_edges_freeze_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "pricing_policy_component_edges"
  FOR EACH ROW EXECUTE FUNCTION "operations_v3_freeze_policy_child"();--> statement-breakpoint
CREATE TRIGGER "pricing_policy_component_edges_shape_guard"
  BEFORE INSERT OR UPDATE ON "pricing_policy_component_edges"
  FOR EACH ROW EXECUTE FUNCTION "operations_v3_validate_policy_edge"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "pricing_policy_versions_cutover_final_state"
  AFTER UPDATE OF "effective_until" ON "pricing_policy_versions"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "operations_v3_validate_policy_cutover_final_state"();
