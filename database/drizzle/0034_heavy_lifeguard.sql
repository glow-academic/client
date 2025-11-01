DROP INDEX "agent_prompts_agent_id_active_idx";--> statement-breakpoint
DROP INDEX "persona_prompts_persona_id_active_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "agent_prompts_one_active_per_agent" ON "agent_prompts" USING btree ("agent_id" uuid_ops) WHERE active;--> statement-breakpoint
CREATE UNIQUE INDEX "persona_prompts_one_active_per_persona" ON "persona_prompts" USING btree ("persona_id" uuid_ops) WHERE active;--> statement-breakpoint
CREATE INDEX "agent_prompts_agent_id_active_idx" ON "agent_prompts" USING btree ("agent_id" uuid_ops,"active" bool_ops);--> statement-breakpoint
CREATE INDEX "persona_prompts_persona_id_active_idx" ON "persona_prompts" USING btree ("persona_id" bool_ops,"active" bool_ops);