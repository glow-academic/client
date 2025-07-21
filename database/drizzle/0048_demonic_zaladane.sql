ALTER TABLE "profiles" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "role" SET DEFAULT 'guest'::text;--> statement-breakpoint
DROP TYPE "public"."profile_role";--> statement-breakpoint
CREATE TYPE "public"."profile_role" AS ENUM('superadmin', 'admin', 'instructional', 'ta', 'guest');--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "role" SET DEFAULT 'guest'::"public"."profile_role";--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "role" SET DATA TYPE "public"."profile_role" USING "role"::"public"."profile_role";