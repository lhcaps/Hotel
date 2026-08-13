CREATE TABLE "property_arrival_access_configs" (
	"property_id" uuid PRIMARY KEY NOT NULL,
	"gate_pass_encrypted" text,
	"wifi_ssid" text,
	"wifi_password_encrypted" text,
	"support_contact" text,
	"default_arrival_instruction" text,
	"preparation_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_arrival_access_configs_gate_pass_nonempty_ck" CHECK ("property_arrival_access_configs"."gate_pass_encrypted" IS NULL OR btrim("property_arrival_access_configs"."gate_pass_encrypted") <> ''),
	CONSTRAINT "property_arrival_access_configs_wifi_ssid_nonempty_ck" CHECK ("property_arrival_access_configs"."wifi_ssid" IS NULL OR btrim("property_arrival_access_configs"."wifi_ssid") <> ''),
	CONSTRAINT "property_arrival_access_configs_wifi_password_nonempty_ck" CHECK ("property_arrival_access_configs"."wifi_password_encrypted" IS NULL OR btrim("property_arrival_access_configs"."wifi_password_encrypted") <> ''),
	CONSTRAINT "property_arrival_access_configs_support_nonempty_ck" CHECK ("property_arrival_access_configs"."support_contact" IS NULL OR btrim("property_arrival_access_configs"."support_contact") <> ''),
	CONSTRAINT "property_arrival_access_configs_instruction_nonempty_ck" CHECK ("property_arrival_access_configs"."default_arrival_instruction" IS NULL OR btrim("property_arrival_access_configs"."default_arrival_instruction") <> ''),
	CONSTRAINT "property_arrival_access_configs_preparation_nonempty_ck" CHECK ("property_arrival_access_configs"."preparation_note" IS NULL OR btrim("property_arrival_access_configs"."preparation_note") <> '')
);
--> statement-breakpoint
CREATE TABLE "room_arrival_access_configs" (
	"room_id" uuid PRIMARY KEY NOT NULL,
	"property_id" uuid NOT NULL,
	"room_pass_encrypted" text,
	"room_location" text,
	"arrival_instruction" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_arrival_access_configs_room_pass_nonempty_ck" CHECK ("room_arrival_access_configs"."room_pass_encrypted" IS NULL OR btrim("room_arrival_access_configs"."room_pass_encrypted") <> ''),
	CONSTRAINT "room_arrival_access_configs_location_nonempty_ck" CHECK ("room_arrival_access_configs"."room_location" IS NULL OR btrim("room_arrival_access_configs"."room_location") <> ''),
	CONSTRAINT "room_arrival_access_configs_instruction_nonempty_ck" CHECK ("room_arrival_access_configs"."arrival_instruction" IS NULL OR btrim("room_arrival_access_configs"."arrival_instruction") <> '')
);
--> statement-breakpoint
ALTER TABLE "property_arrival_access_configs" ADD CONSTRAINT "property_arrival_access_configs_property_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_arrival_access_configs" ADD CONSTRAINT "room_arrival_access_configs_room_fk" FOREIGN KEY ("property_id","room_id") REFERENCES "public"."rooms"("property_id","id") ON DELETE cascade ON UPDATE no action;