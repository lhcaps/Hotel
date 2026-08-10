ALTER TABLE "housekeeping_tasks" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "verified_by" uuid;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "reopened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "reopened_by" uuid;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "reopen_reason" text;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_verified_by_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_reopened_by_fk" FOREIGN KEY ("reopened_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;