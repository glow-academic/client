ALTER TABLE "app_logs" ADD COLUMN "event" text NOT NULL;--> statement-breakpoint
ALTER TABLE "app_logs" ADD COLUMN "correlation_id" text;--> statement-breakpoint
ALTER TABLE "app_logs" ADD COLUMN "actor" jsonb;--> statement-breakpoint
ALTER TABLE "app_logs" ADD COLUMN "subject" jsonb;--> statement-breakpoint
ALTER TABLE "app_logs" ADD COLUMN "metrics" jsonb;--> statement-breakpoint
ALTER TABLE "app_logs" ADD COLUMN "error" jsonb;--> statement-breakpoint
CREATE INDEX "idx_app_logs_correlation_id" ON "app_logs" USING btree ("correlation_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_app_logs_event_created_at" ON "app_logs" USING btree ("event" timestamptz_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_app_logs_level_created_at" ON "app_logs" USING btree ("level" timestamptz_ops,"created_at" text_ops);