CREATE TABLE "agent_prompts" (
	"agent_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_prompts_pkey" PRIMARY KEY("agent_id","prompt_id")
);
--> statement-breakpoint
CREATE TABLE "persona_prompts" (
	"persona_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "persona_prompts_pkey" PRIMARY KEY("persona_id","prompt_id")
);
--> statement-breakpoint
ALTER TABLE "agents" DROP CONSTRAINT "agents_prompt_id_fkey";
--> statement-breakpoint
ALTER TABLE "personas" DROP CONSTRAINT "personas_prompt_id_fkey";
--> statement-breakpoint
ALTER TABLE "agent_prompts" ADD CONSTRAINT "agent_prompts_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_prompts" ADD CONSTRAINT "agent_prompts_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_prompts" ADD CONSTRAINT "persona_prompts_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_prompts" ADD CONSTRAINT "persona_prompts_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_prompts_agent_id_active_idx" ON "agent_prompts" USING btree ("agent_id" uuid_ops,"active" bool_ops);--> statement-breakpoint
CREATE INDEX "agent_prompts_agent_id_idx" ON "agent_prompts" USING btree ("agent_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "agent_prompts_one_active_per_agent" ON "agent_prompts" USING btree ("agent_id" uuid_ops) WHERE (active = true);--> statement-breakpoint
CREATE INDEX "agent_prompts_prompt_id_idx" ON "agent_prompts" USING btree ("prompt_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "persona_prompts_one_active_per_persona" ON "persona_prompts" USING btree ("persona_id" uuid_ops) WHERE (active = true);--> statement-breakpoint
CREATE INDEX "persona_prompts_persona_id_active_idx" ON "persona_prompts" USING btree ("persona_id" bool_ops,"active" bool_ops);--> statement-breakpoint
CREATE INDEX "persona_prompts_persona_id_idx" ON "persona_prompts" USING btree ("persona_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "persona_prompts_prompt_id_idx" ON "persona_prompts" USING btree ("prompt_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "prompt_id";--> statement-breakpoint
ALTER TABLE "personas" DROP COLUMN "prompt_id";