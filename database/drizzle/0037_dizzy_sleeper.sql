CREATE TABLE "agent_department_prompts" (
	"agent_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_department_prompts_pkey" PRIMARY KEY("agent_id","department_id","prompt_id")
);
--> statement-breakpoint
CREATE TABLE "persona_department_prompts" (
	"persona_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "persona_department_prompts_pkey" PRIMARY KEY("persona_id","department_id","prompt_id")
);
--> statement-breakpoint
ALTER TABLE "agent_departments" DROP CONSTRAINT "agent_departments_prompt_id_fkey";
--> statement-breakpoint
ALTER TABLE "persona_departments" DROP CONSTRAINT "persona_departments_prompt_id_fkey";
--> statement-breakpoint
DROP INDEX "agent_departments_one_active_per_agent_prompt_dept";--> statement-breakpoint
DROP INDEX "agent_departments_prompt_id_idx";--> statement-breakpoint
DROP INDEX "persona_departments_one_active_per_persona_prompt_dept";--> statement-breakpoint
DROP INDEX "persona_departments_prompt_id_idx";--> statement-breakpoint
ALTER TABLE "agent_department_prompts" ADD CONSTRAINT "agent_department_prompts_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_department_prompts" ADD CONSTRAINT "agent_department_prompts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_department_prompts" ADD CONSTRAINT "agent_department_prompts_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_department_prompts" ADD CONSTRAINT "persona_department_prompts_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_department_prompts" ADD CONSTRAINT "persona_department_prompts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_department_prompts" ADD CONSTRAINT "persona_department_prompts_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_department_prompts_agent_id_idx" ON "agent_department_prompts" USING btree ("agent_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "agent_department_prompts_department_id_idx" ON "agent_department_prompts" USING btree ("department_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "agent_department_prompts_one_active_per_agent_prompt_dept" ON "agent_department_prompts" USING btree ("agent_id" uuid_ops,"prompt_id" uuid_ops,"department_id" uuid_ops) WHERE (active = true);--> statement-breakpoint
CREATE INDEX "agent_department_prompts_prompt_id_idx" ON "agent_department_prompts" USING btree ("prompt_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "persona_department_prompts_department_id_idx" ON "persona_department_prompts" USING btree ("department_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "persona_department_prompts_one_active_per_persona_prompt_dept" ON "persona_department_prompts" USING btree ("persona_id" uuid_ops,"prompt_id" uuid_ops,"department_id" uuid_ops) WHERE (active = true);--> statement-breakpoint
CREATE INDEX "persona_department_prompts_persona_id_idx" ON "persona_department_prompts" USING btree ("persona_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "persona_department_prompts_prompt_id_idx" ON "persona_department_prompts" USING btree ("prompt_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "agent_departments_active_idx" ON "agent_departments" USING btree ("active" bool_ops);--> statement-breakpoint
CREATE INDEX "persona_departments_active_idx" ON "persona_departments" USING btree ("active" bool_ops);--> statement-breakpoint
ALTER TABLE "agent_departments" DROP COLUMN "prompt_id";--> statement-breakpoint
ALTER TABLE "persona_departments" DROP COLUMN "prompt_id";--> statement-breakpoint
ALTER TABLE "agent_departments" DROP CONSTRAINT "agent_departments_pkey";
--> statement-breakpoint
ALTER TABLE "agent_departments" ADD CONSTRAINT "agent_departments_pkey" PRIMARY KEY("agent_id","department_id");--> statement-breakpoint
ALTER TABLE "persona_departments" DROP CONSTRAINT "persona_departments_pkey";
--> statement-breakpoint
ALTER TABLE "persona_departments" ADD CONSTRAINT "persona_departments_pkey" PRIMARY KEY("persona_id","department_id");