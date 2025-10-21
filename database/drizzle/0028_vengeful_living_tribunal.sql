ALTER TABLE "providers" DROP CONSTRAINT "providers_department_id_fkey";
--> statement-breakpoint
ALTER TABLE "parameters" ADD COLUMN "practice_parameter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" DROP COLUMN "department_id";