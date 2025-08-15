-- Consolidated migration combining changes from 0010, 0011, 0012, and 0013
-- This migration provides safe defaults and proper ordering of operations

-- 1. Add new columns to personas and profiles (from 0010)
ALTER TABLE "personas" ADD COLUMN "image_input_active" boolean DEFAULT false NOT NULL;
ALTER TABLE "profiles" ADD COLUMN "req_per_day" integer;

-- 1.5. Modify profiles last_active column (from 0014_mean_speed)
ALTER TABLE "profiles" ALTER COLUMN "last_active" DROP DEFAULT;
ALTER TABLE "profiles" ALTER COLUMN "last_active" DROP NOT NULL;

-- 2. Add new columns to app_logs with safe defaults (from 0011 + 0013)
ALTER TABLE "app_logs" ADD COLUMN "event" text DEFAULT 'default.event' NOT NULL;
ALTER TABLE "app_logs" ADD COLUMN "correlation_id" text DEFAULT 'default.correlation';
ALTER TABLE "app_logs" ADD COLUMN "actor" jsonb DEFAULT '{"userId":null,"profileId":null}'::jsonb;
ALTER TABLE "app_logs" ADD COLUMN "subject" jsonb DEFAULT '{"entityId":null,"entityType":null}'::jsonb;
ALTER TABLE "app_logs" ADD COLUMN "metrics" jsonb DEFAULT '{"size":null,"count":null,"durationMs":null}'::jsonb;
ALTER TABLE "app_logs" ADD COLUMN "error" jsonb DEFAULT '{"code":null,"name":null,"stack":null,"message":null}'::jsonb;

-- 3. Set defaults for existing app_logs columns (from 0013)
ALTER TABLE "app_logs" ALTER COLUMN "level" SET DEFAULT 'info';
ALTER TABLE "app_logs" ALTER COLUMN "message" SET DEFAULT 'Default Message';
ALTER TABLE "app_logs" ALTER COLUMN "context" SET DEFAULT '{"route":null,"function":null,"component":null}'::jsonb;

-- 4. Drop checkpoints columns (from 0013)
ALTER TABLE "scenarios" DROP COLUMN IF EXISTS "checkpoints";
ALTER TABLE "simulation_chat_grades" DROP COLUMN IF EXISTS "checkpoints_reached";

ALTER TABLE "models" ADD COLUMN "custom_model" boolean DEFAULT false NOT NULL;
