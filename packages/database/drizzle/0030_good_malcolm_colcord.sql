ALTER TABLE "housekeeping_tasks" ADD COLUMN "assigned_to" uuid;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "assigned_by" uuid;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "started_by" uuid;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "completed_by" uuid;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_assigned_to_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_assigned_by_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_started_by_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_completed_by_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_version_nonnegative_ck" CHECK ("housekeeping_tasks"."version" >= 0);
