ALTER TABLE "app_logs" ALTER COLUMN "event" SET DEFAULT 'default.event';--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "level" SET DEFAULT 'info';--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "message" SET DEFAULT 'Default Message';--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "correlation_id" SET DEFAULT 'default.correlation';--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "actor" SET DEFAULT '{"userId":null,"profileId":null}'::jsonb;--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "subject" SET DEFAULT '{"entityId":null,"entityType":null}'::jsonb;--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "metrics" SET DEFAULT '{"size":null,"count":null,"durationMs":null}'::jsonb;--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "context" SET DEFAULT '{"route":null,"function":null,"component":null}'::jsonb;--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "error" SET DEFAULT '{"code":null,"name":null,"stack":null,"message":null}'::jsonb;--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "checkpoints";--> statement-breakpoint
ALTER TABLE "simulation_chat_grades" DROP COLUMN "checkpoints_reached";