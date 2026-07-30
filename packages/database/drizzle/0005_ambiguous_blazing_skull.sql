CREATE TABLE "booking_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"normalized_email" text NOT NULL,
	"normalized_phone_e164" text NOT NULL,
	"email_digest" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_contacts_full_name_nonempty_ck" CHECK (btrim("booking_contacts"."full_name") <> ''),
	CONSTRAINT "booking_contacts_normalized_email_nonempty_ck" CHECK (btrim("booking_contacts"."normalized_email") <> ''),
	CONSTRAINT "booking_contacts_normalized_phone_nonempty_ck" CHECK (btrim("booking_contacts"."normalized_phone_e164") <> ''),
	CONSTRAINT "booking_contacts_email_digest_length_ck" CHECK (octet_length("booking_contacts"."email_digest") = 32)
);
--> statement-breakpoint
CREATE TABLE "guest_otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"nonce" "bytea" NOT NULL,
	"email_digest" "bytea" NOT NULL,
	"request_ip_digest" "bytea" NOT NULL,
	"challenge_ref_digest" "bytea" NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"replaced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_otp_challenges_nonce_length_ck" CHECK (octet_length("guest_otp_challenges"."nonce") = 32),
	CONSTRAINT "guest_otp_challenges_email_digest_length_ck" CHECK (octet_length("guest_otp_challenges"."email_digest") = 32),
	CONSTRAINT "guest_otp_challenges_request_ip_digest_length_ck" CHECK (octet_length("guest_otp_challenges"."request_ip_digest") = 32),
	CONSTRAINT "guest_otp_challenges_challenge_ref_digest_length_ck" CHECK (octet_length("guest_otp_challenges"."challenge_ref_digest") = 32),
	CONSTRAINT "guest_otp_challenges_attempts_ck" CHECK ("guest_otp_challenges"."attempts" >= 0 AND "guest_otp_challenges"."attempts" <= "guest_otp_challenges"."max_attempts"),
	CONSTRAINT "guest_otp_challenges_max_attempts_ck" CHECK ("guest_otp_challenges"."max_attempts" = 5),
	CONSTRAINT "guest_otp_challenges_expiry_ck" CHECK ("guest_otp_challenges"."expires_at" > "guest_otp_challenges"."created_at"),
	CONSTRAINT "guest_otp_challenges_consumed_replaced_ck" CHECK ("guest_otp_challenges"."consumed_at" IS NULL OR "guest_otp_challenges"."replaced_at" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "guest_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"token_digest" "bytea" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_ip_digest" "bytea",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_sessions_token_digest_length_ck" CHECK (octet_length("guest_sessions"."token_digest") = 32),
	CONSTRAINT "guest_sessions_created_ip_digest_length_ck" CHECK ("guest_sessions"."created_ip_digest" IS NULL OR octet_length("guest_sessions"."created_ip_digest") = 32),
	CONSTRAINT "guest_sessions_expiry_ck" CHECK ("guest_sessions"."expires_at" > "guest_sessions"."created_at")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "quote_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "pricing_rule_version" text;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "lease_id" uuid;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "last_error_category" text;--> statement-breakpoint
ALTER TABLE "booking_contacts" ADD CONSTRAINT "booking_contacts_booking_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_otp_challenges" ADD CONSTRAINT "guest_otp_challenges_booking_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_booking_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_contacts_booking_id_uq" ON "booking_contacts" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_otp_challenges_one_active_booking_uq" ON "guest_otp_challenges" USING btree ("booking_id") WHERE "guest_otp_challenges"."consumed_at" IS NULL AND "guest_otp_challenges"."replaced_at" IS NULL;--> statement-breakpoint
CREATE INDEX "guest_otp_challenges_booking_email_created_idx" ON "guest_otp_challenges" USING btree ("booking_id","email_digest","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "guest_otp_challenges_ip_created_idx" ON "guest_otp_challenges" USING btree ("request_ip_digest","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "guest_sessions_token_digest_uq" ON "guest_sessions" USING btree ("token_digest");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quote_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_quote_id_uq" ON "bookings" USING btree ("quote_id") WHERE "bookings"."quote_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_lease_consistency_ck" CHECK (("outbox_events"."lease_id" IS NULL AND "outbox_events"."claimed_at" IS NULL AND "outbox_events"."lease_expires_at" IS NULL)
          OR ("outbox_events"."lease_id" IS NOT NULL AND "outbox_events"."claimed_at" IS NOT NULL AND "outbox_events"."lease_expires_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_lease_status_ck" CHECK ("outbox_events"."status" = 'PENDING' OR "outbox_events"."lease_id" IS NULL);