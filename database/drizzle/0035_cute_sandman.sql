ALTER TABLE "agent_prompts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "persona_prompts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prompt_departments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "agent_prompts" CASCADE;--> statement-breakpoint
DROP TABLE "persona_prompts" CASCADE;--> statement-breakpoint
DROP TABLE "prompt_departments" CASCADE;--> statement-breakpoint
ALTER TABLE "agent_departments" ADD COLUMN "prompt_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "prompt_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "persona_departments" ADD COLUMN "prompt_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "personas" ADD COLUMN "prompt_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_departments" ADD CONSTRAINT "agent_departments_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_departments" ADD CONSTRAINT "persona_departments_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_departments_one_active_per_agent_prompt_dept" ON "agent_departments" USING btree ("agent_id" uuid_ops,"prompt_id" uuid_ops,"department_id" uuid_ops) WHERE (active = true);--> statement-breakpoint
CREATE INDEX "agent_departments_prompt_id_idx" ON "agent_departments" USING btree ("prompt_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "persona_departments_one_active_per_persona_prompt_dept" ON "persona_departments" USING btree ("persona_id" uuid_ops,"prompt_id" uuid_ops,"department_id" uuid_ops) WHERE (active = true);--> statement-breakpoint
CREATE INDEX "persona_departments_prompt_id_idx" ON "persona_departments" USING btree ("prompt_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "agent_departments" DROP CONSTRAINT "agent_departments_pkey";
--> statement-breakpoint
ALTER TABLE "agent_departments" ADD CONSTRAINT "agent_departments_pkey" PRIMARY KEY("agent_id","department_id","prompt_id");--> statement-breakpoint
ALTER TABLE "persona_departments" DROP CONSTRAINT "persona_departments_pkey";
--> statement-breakpoint
ALTER TABLE "persona_departments" ADD CONSTRAINT "persona_departments_pkey" PRIMARY KEY("persona_id","department_id","prompt_id");