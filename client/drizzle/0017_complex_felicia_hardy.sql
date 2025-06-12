ALTER TABLE "profiles" RENAME COLUMN "email" TO "alias";--> statement-breakpoint
ALTER TABLE "simulation_attempts" DROP CONSTRAINT "simulation_attempts_class_id_fkey";
--> statement-breakpoint
ALTER TABLE "simulations" DROP CONSTRAINT "simulations_class_id_fkey";
--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "first_name" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "last_name" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "last_login" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_attempts" DROP COLUMN "class_id";--> statement-breakpoint
ALTER TABLE "simulations" DROP COLUMN "class_id";