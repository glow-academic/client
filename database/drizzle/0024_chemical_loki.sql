CREATE TABLE "app_feedback_profiles" (
	"app_feedback_id" integer NOT NULL,
	"profile_id" uuid NOT NULL,
	"role" text DEFAULT 'author' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_feedback_profiles_pkey" PRIMARY KEY("app_feedback_id","profile_id","role")
);
--> statement-breakpoint
CREATE TABLE "attempt_profiles" (
	"attempt_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempt_profiles_pkey" PRIMARY KEY("attempt_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "model_run_agents" (
	"model_run_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_run_agents_pkey" PRIMARY KEY("model_run_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE "model_run_models" (
	"model_run_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_run_models_pkey" PRIMARY KEY("model_run_id","model_id")
);
--> statement-breakpoint
CREATE TABLE "model_run_personas" (
	"model_run_id" uuid NOT NULL,
	"persona_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_run_personas_pkey" PRIMARY KEY("model_run_id","persona_id")
);
--> statement-breakpoint
CREATE TABLE "model_run_profiles" (
	"model_run_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_run_profiles_pkey" PRIMARY KEY("model_run_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "scenario_personas" (
	"scenario_id" uuid NOT NULL,
	"persona_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenario_personas_pkey" PRIMARY KEY("scenario_id","persona_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" integer NOT NULL,
	"profile_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_pkey" PRIMARY KEY("user_id","profile_id")
);
--> statement-breakpoint
DROP MATERIALIZED VIEW "public"."analytics";--> statement-breakpoint
ALTER TABLE "agents" DROP CONSTRAINT "agents_model_id_fkey";
--> statement-breakpoint
ALTER TABLE "app_feedback" DROP CONSTRAINT "app_feedback_profile_id_fkey";
--> statement-breakpoint
ALTER TABLE "model_runs" DROP CONSTRAINT "model_runs_model_id_fkey";
--> statement-breakpoint
ALTER TABLE "model_runs" DROP CONSTRAINT "model_runs_persona_id_fkey";
--> statement-breakpoint
ALTER TABLE "model_runs" DROP CONSTRAINT "model_runs_agent_id_fkey";
--> statement-breakpoint
ALTER TABLE "model_runs" DROP CONSTRAINT "model_runs_profile_id_fkey";
--> statement-breakpoint
ALTER TABLE "personas" DROP CONSTRAINT "personas_model_id_fkey";
--> statement-breakpoint
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "scenarios" DROP CONSTRAINT "scenarios_persona_id_fkey";
--> statement-breakpoint
ALTER TABLE "simulation_attempts" DROP CONSTRAINT "simulation_attempts_profile_id_fkey";
--> statement-breakpoint
DROP INDEX "simulation_attempts_id_profile_archived_idx";--> statement-breakpoint
DROP INDEX "simulation_attempts_profile_sim_idx";--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "model_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "personas" ALTER COLUMN "model_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cohort_profiles" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "cohort_profiles" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "cohort_profiles" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "cohort_simulations" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "cohort_simulations" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "cohort_simulations" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "department_agents" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "department_agents" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "department_agents" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_departments" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_departments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_documents" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_documents" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_documents" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_parameter_items" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_parameter_items" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_parameter_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_tree" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_tree" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "scenario_tree" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_scenarios" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_scenarios" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_scenarios" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_tag_documents" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_tag_documents" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_tag_documents" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_tag_parameter_items" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_tag_parameter_items" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_tag_parameter_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_tags" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_tags" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_tags" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "app_feedback_profiles" ADD CONSTRAINT "app_feedback_profiles_app_feedback_id_fkey" FOREIGN KEY ("app_feedback_id") REFERENCES "public"."app_feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_feedback_profiles" ADD CONSTRAINT "app_feedback_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_profiles" ADD CONSTRAINT "attempt_profiles_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."simulation_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_profiles" ADD CONSTRAINT "attempt_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_run_agents" ADD CONSTRAINT "model_run_agents_model_run_id_fkey" FOREIGN KEY ("model_run_id") REFERENCES "public"."model_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_run_agents" ADD CONSTRAINT "model_run_agents_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_run_models" ADD CONSTRAINT "model_run_models_model_run_id_fkey" FOREIGN KEY ("model_run_id") REFERENCES "public"."model_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_run_models" ADD CONSTRAINT "model_run_models_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_run_personas" ADD CONSTRAINT "model_run_personas_model_run_id_fkey" FOREIGN KEY ("model_run_id") REFERENCES "public"."model_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_run_personas" ADD CONSTRAINT "model_run_personas_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_run_profiles" ADD CONSTRAINT "model_run_profiles_model_run_id_fkey" FOREIGN KEY ("model_run_id") REFERENCES "public"."model_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_run_profiles" ADD CONSTRAINT "model_run_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_personas" ADD CONSTRAINT "scenario_personas_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_personas" ADD CONSTRAINT "scenario_personas_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_feedback_profiles_app_feedback_id_idx" ON "app_feedback_profiles" USING btree ("app_feedback_id" int4_ops);--> statement-breakpoint
CREATE INDEX "app_feedback_profiles_profile_id_idx" ON "app_feedback_profiles" USING btree ("profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "attempt_profiles_attempt_active_idx" ON "attempt_profiles" USING btree ("attempt_id" uuid_ops,"profile_id" uuid_ops) WHERE (active = true);--> statement-breakpoint
CREATE INDEX "attempt_profiles_attempt_id_active_idx" ON "attempt_profiles" USING btree ("attempt_id" bool_ops,"active" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_profiles_one_active_per_attempt" ON "attempt_profiles" USING btree ("attempt_id" uuid_ops) WHERE active;--> statement-breakpoint
CREATE INDEX "attempt_profiles_profile_active_idx" ON "attempt_profiles" USING btree ("profile_id" uuid_ops,"attempt_id" uuid_ops) WHERE (active = true);--> statement-breakpoint
CREATE INDEX "attempt_profiles_profile_id_idx" ON "attempt_profiles" USING btree ("profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "model_run_agents_agent_id_idx" ON "model_run_agents" USING btree ("agent_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "one_agent_per_run" ON "model_run_agents" USING btree ("model_run_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "model_run_models_model_id_idx" ON "model_run_models" USING btree ("model_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "one_model_per_run" ON "model_run_models" USING btree ("model_run_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "model_run_personas_persona_id_idx" ON "model_run_personas" USING btree ("persona_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "one_persona_per_run" ON "model_run_personas" USING btree ("model_run_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "model_run_profiles_profile_id_idx" ON "model_run_profiles" USING btree ("profile_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "one_profile_per_run" ON "model_run_profiles" USING btree ("model_run_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_personas_one_active_per_scenario" ON "scenario_personas" USING btree ("scenario_id" uuid_ops) WHERE active;--> statement-breakpoint
CREATE INDEX "scenario_personas_persona_id_idx" ON "scenario_personas" USING btree ("persona_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "scenario_personas_scenario_active_idx" ON "scenario_personas" USING btree ("scenario_id" uuid_ops,"persona_id" uuid_ops) WHERE (active = true);--> statement-breakpoint
CREATE INDEX "scenario_personas_scenario_id_active_idx" ON "scenario_personas" USING btree ("scenario_id" uuid_ops,"active" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_one_primary_per_user" ON "user_profiles" USING btree ("user_id" int4_ops) WHERE is_primary;--> statement-breakpoint
CREATE INDEX "user_profiles_profile_id_idx" ON "user_profiles" USING btree ("profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "user_profiles_user_id_is_primary_idx" ON "user_profiles" USING btree ("user_id" int4_ops,"is_primary" int4_ops);--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personas" ADD CONSTRAINT "personas_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_feedback" DROP COLUMN "profile_id";--> statement-breakpoint
ALTER TABLE "model_runs" DROP COLUMN "model_id";--> statement-breakpoint
ALTER TABLE "model_runs" DROP COLUMN "persona_id";--> statement-breakpoint
ALTER TABLE "model_runs" DROP COLUMN "agent_id";--> statement-breakpoint
ALTER TABLE "model_runs" DROP COLUMN "profile_id";--> statement-breakpoint
ALTER TABLE "personas" DROP COLUMN "guardrail_active";--> statement-breakpoint
ALTER TABLE "personas" DROP COLUMN "image_input_active";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "persona_id";--> statement-breakpoint
ALTER TABLE "simulation_attempts" DROP COLUMN "profile_id";--> statement-breakpoint
CREATE MATERIALIZED VIEW "public"."analytics" AS (WITH RECURSIVE scenario_roots AS ( SELECT s_1.id, st.parent_id, s_1.id AS root_id FROM scenarios s_1 JOIN scenario_tree st ON st.child_id = s_1.id AND st.parent_id = s_1.id UNION ALL SELECT s1.id, st.parent_id, sr.root_id FROM scenarios s1 JOIN scenario_tree st ON st.child_id = s1.id AND st.parent_id <> s1.id JOIN scenario_roots sr ON st.parent_id = sr.id ), root_map AS ( SELECT s_1.id AS leaf_scenario_id, COALESCE(sr.root_id, s_1.id) AS root_scenario_id FROM scenarios s_1 LEFT JOIN scenario_roots sr ON s_1.id = sr.id ), latest_grade AS ( SELECT DISTINCT ON (simulation_chat_grades.simulation_chat_id) simulation_chat_grades.simulation_chat_id, simulation_chat_grades.score::numeric AS score, simulation_chat_grades.time_taken::numeric AS time_taken_seconds, simulation_chat_grades.rubric_id, simulation_chat_grades.created_at FROM simulation_chat_grades ORDER BY simulation_chat_grades.simulation_chat_id, simulation_chat_grades.created_at DESC ), active_sims AS ( SELECT simulations.id, simulations.created_at, simulations.updated_at, simulations.title, simulations.description, simulations.time_limit, simulations.active, simulations.rubric_id, simulations.default_simulation, simulations.practice_simulation, simulations.department_id, simulations.output_guardrail_active, simulations.input_guardrail_active, simulations.image_input_active, simulations.hints_enabled FROM simulations WHERE simulations.active = true ), active_scenarios AS ( SELECT scenarios.id, scenarios.created_at, scenarios.updated_at, scenarios.name, scenarios.problem_statement, scenarios.default_scenario, scenarios.generated, scenarios.active, scenarios.department_id FROM scenarios WHERE scenarios.active = true ), cohorts_expanded AS ( SELECT c.id, c.active FROM cohorts c ), cohorts_by_sim AS ( SELECT s_1.id AS simulation_id, ARRAY( SELECT DISTINCT c.id FROM cohorts c JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = s_1.id WHERE c.active = true) AS cohort_ids FROM active_sims s_1 ), profile_cohorts_for_sim AS ( SELECT sa_1.id AS attempt_id, ap_1.profile_id, sa_1.simulation_id, ARRAY( SELECT c.id FROM cohorts c JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = sa_1.simulation_id JOIN cohort_profiles cp ON cp.cohort_id = c.id AND cp.profile_id = ap_1.profile_id WHERE c.active = true) AS profile_cohort_ids FROM simulation_attempts sa_1 LEFT JOIN attempt_profiles ap_1 ON ap_1.attempt_id = sa_1.id AND ap_1.active = true ), message_counts AS ( SELECT sm.chat_id, count(*)::integer AS num_messages_total, count(*) FILTER (WHERE sm.type = 'query'::simulation_message_type)::integer AS num_query_messages, count(*) FILTER (WHERE sm.type = 'response'::simulation_message_type)::integer AS num_response_messages FROM simulation_messages sm GROUP BY sm.chat_id ), message_deltas AS ( SELECT m.chat_id, CASE WHEN lag(m.type) OVER (PARTITION BY m.chat_id ORDER BY m.created_at) = 'response'::simulation_message_type AND m.type = 'query'::simulation_message_type THEN GREATEST(EXTRACT(epoch FROM m.created_at - COALESCE(lag(COALESCE(m.updated_at, m.created_at)) OVER (PARTITION BY m.chat_id ORDER BY m.created_at), sc_1.created_at))::integer, 0) ELSE NULL::integer END AS delta_seconds, m.created_at FROM simulation_messages m JOIN simulation_chats sc_1 ON sc_1.id = m.chat_id ), message_deltas_agg AS ( SELECT message_deltas.chat_id, array_remove(array_agg(message_deltas.delta_seconds ORDER BY message_deltas.created_at), NULL::integer) AS message_time_taken_seconds FROM message_deltas GROUP BY message_deltas.chat_id ), effective_profile_department AS ( SELECT pd.profile_id, COALESCE(( SELECT pd1.department_id FROM profile_departments pd1 WHERE pd1.profile_id = pd.profile_id AND pd1.is_primary LIMIT 1), ( SELECT pd2.department_id FROM profile_departments pd2 WHERE pd2.profile_id = pd.profile_id ORDER BY pd2.created_at LIMIT 1)) AS department_id FROM ( SELECT DISTINCT ap_1.profile_id FROM simulation_attempts sa_1 JOIN attempt_profiles ap_1 ON ap_1.attempt_id = sa_1.id AND ap_1.active = true) pd ) SELECT sc.id AS chat_id, sc.attempt_id, ap.profile_id, sa.simulation_id, rm.root_scenario_id AS scenario_id, rm.leaf_scenario_id, sp.persona_id, p.color AS persona_color, sim.practice_simulation AS is_practice, sa.archived AS is_archived, NOT sim.practice_simulation AND NOT sa.archived AS is_general, pr.role AS profile_role, cbs.cohort_ids, sc.created_at AS chat_created_at, sc.completed_at AS chat_completed_at, CASE WHEN lg.score IS NULL OR r.points IS NULL OR r.points = 0 THEN NULL::numeric ELSE lg.score / r.points::numeric * 100.0 END AS grade_percent, CASE WHEN lg.score IS NULL OR r.points IS NULL OR r.pass_points IS NULL THEN NULL::boolean ELSE lg.score >= r.pass_points::numeric END AS passed, lg.time_taken_seconds, lg.rubric_id, r.points AS rubric_points, r.pass_points AS rubric_pass_points, sc.completed OR sc.completed_at IS NOT NULL OR lg.simulation_chat_id IS NOT NULL AS completed, COALESCE(mc.num_messages_total, 0) AS num_messages_total, COALESCE(mc.num_query_messages, 0) AS num_query_messages, COALESCE(mc.num_response_messages, 0) AS num_response_messages, COALESCE(mda.message_time_taken_seconds, '{}'::integer[]) AS message_time_taken_seconds, sa.created_at AS attempt_created_at, pcs.profile_cohort_ids, (( SELECT count(*) AS count FROM simulation_scenarios ss WHERE ss.simulation_id = sim.id))::integer AS sim_scenario_count, lg.created_at AS grade_created_at, COALESCE(epd.department_id, sim.department_id, r.department_id, s.department_id, p.department_id) AS department_id FROM simulation_chats sc JOIN simulation_attempts sa ON sa.id = sc.attempt_id LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true JOIN active_sims sim ON sim.id = sa.simulation_id JOIN profiles pr ON pr.id = ap.profile_id JOIN active_scenarios s ON s.id = sc.scenario_id JOIN root_map rm ON rm.leaf_scenario_id = s.id LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true LEFT JOIN personas p ON p.id = sp.persona_id LEFT JOIN latest_grade lg ON lg.simulation_chat_id = sc.id LEFT JOIN rubrics r ON r.id = lg.rubric_id LEFT JOIN cohorts_by_sim cbs ON cbs.simulation_id = sa.simulation_id LEFT JOIN profile_cohorts_for_sim pcs ON pcs.attempt_id = sa.id LEFT JOIN message_counts mc ON mc.chat_id = sc.id LEFT JOIN message_deltas_agg mda ON mda.chat_id = sc.id LEFT JOIN effective_profile_department epd ON epd.profile_id = ap.profile_id);