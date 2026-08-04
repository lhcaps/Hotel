ALTER TABLE "rooms" ADD COLUMN "physical_room_code" text;--> statement-breakpoint
UPDATE "rooms"
   SET "physical_room_code" = "room_number"
 WHERE "physical_room_code" IS NULL;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "rooms_fill_physical_room_code"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."physical_room_code" IS NULL THEN
    NEW."physical_room_code" := NEW."room_number";
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "rooms_fill_physical_room_code_trg"
BEFORE INSERT OR UPDATE OF "room_number" ON "rooms"
FOR EACH ROW EXECUTE FUNCTION "rooms_fill_physical_room_code"();--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "physical_room_code" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_property_physical_room_code_uq" ON "rooms" USING btree ("property_id", "physical_room_code");--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_physical_room_code_nonempty_ck" CHECK (btrim("physical_room_code") <> '');