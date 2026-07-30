CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_type_id" uuid NOT NULL,
	"check_in" timestamp with time zone NOT NULL,
	"check_out" timestamp with time zone NOT NULL,
	"adults" integer NOT NULL,
	"children" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"base_amount_vnd" bigint NOT NULL,
	"extra_amount_vnd" bigint DEFAULT 0 NOT NULL,
	"total_amount_vnd" bigint NOT NULL,
	"pricing_snapshot" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_duration_ck" CHECK ("quotes"."check_out" >= "quotes"."check_in" + interval '60 minutes'
          AND "quotes"."check_out" <= "quotes"."check_in" + interval '24 hours'),
	CONSTRAINT "quotes_quarter_hour_ck" CHECK (date_trunc('minute', "quotes"."check_in") = "quotes"."check_in"
          AND date_trunc('minute', "quotes"."check_out") = "quotes"."check_out"
          AND mod(extract(epoch FROM "quotes"."check_in")::numeric, 900) = 0
          AND mod(extract(epoch FROM "quotes"."check_out")::numeric, 900) = 0),
	CONSTRAINT "quotes_occupancy_ck" CHECK ("quotes"."adults" >= 1 AND "quotes"."children" >= 0),
	CONSTRAINT "quotes_currency_vnd_ck" CHECK ("quotes"."currency" = 'VND'),
	CONSTRAINT "quotes_money_ck" CHECK ("quotes"."base_amount_vnd" >= 0
          AND "quotes"."extra_amount_vnd" >= 0
          AND "quotes"."total_amount_vnd" = "quotes"."base_amount_vnd" + "quotes"."extra_amount_vnd"),
	CONSTRAINT "quotes_pricing_snapshot_ck" CHECK (jsonb_typeof("quotes"."pricing_snapshot") = 'object' AND "quotes"."pricing_snapshot" <> '{}'::jsonb),
	CONSTRAINT "quotes_expiry_ck" CHECK ("quotes"."expires_at" > "quotes"."created_at")
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_property_room_type_fk" FOREIGN KEY ("property_id","room_type_id") REFERENCES "public"."room_types"("property_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quotes_expiry_idx" ON "quotes" USING btree ("expires_at");
--> statement-breakpoint
-- Phase 4 quote facts are immutable. Retrieval enforces expiry with database time.
CREATE FUNCTION reject_quote_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'quotes are immutable' USING ERRCODE = 'P0001';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER quotes_reject_mutation
BEFORE UPDATE OR DELETE ON quotes
FOR EACH ROW EXECUTE FUNCTION reject_quote_mutation();
--> statement-breakpoint
UPDATE schema_metadata
SET schema_version = 'phase-4-pricing-availability-v1', applied_at = CURRENT_TIMESTAMP
WHERE id = 1;
