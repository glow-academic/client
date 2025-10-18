ALTER TYPE "public"."reasoning_effort" ADD VALUE 'none' BEFORE 'minimal';--> statement-breakpoint
CREATE TABLE "document_parameter_items" (
	"document_id" uuid NOT NULL,
	"parameter_item_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_parameter_items_pkey" PRIMARY KEY("document_id","parameter_item_id")
);
--> statement-breakpoint
CREATE TABLE "profile_request_limits" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"requests_per_day" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_request_limits_requests_per_day_check" CHECK (requests_per_day > 0)
);
--> statement-breakpoint
CREATE TABLE "provider_endpoints" (
	"provider_id" uuid PRIMARY KEY NOT NULL,
	"base_url" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_endpoints_base_url_check" CHECK (base_url <> ''::text)
);
--> statement-breakpoint
CREATE TABLE "simulation_time_limits" (
	"simulation_id" uuid PRIMARY KEY NOT NULL,
	"time_limit_seconds" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "simulation_time_limits_time_limit_seconds_check" CHECK (time_limit_seconds > 0)
);
--> statement-breakpoint
ALTER TABLE "accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "simulation_tag_documents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "simulation_tag_parameter_items" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "simulation_tags" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_profiles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification_token" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP VIEW "public"."v_tagged_documents";--> statement-breakpoint
DROP VIEW "public"."v_tagged_parameter_items";--> statement-breakpoint
DROP MATERIALIZED VIEW "public"."analytics";--> statement-breakpoint
DROP TABLE "accounts" CASCADE;--> statement-breakpoint
DROP TABLE "sessions" CASCADE;--> statement-breakpoint
DROP TABLE "simulation_tag_documents" CASCADE;--> statement-breakpoint
DROP TABLE "simulation_tag_parameter_items" CASCADE;--> statement-breakpoint
DROP TABLE "simulation_tags" CASCADE;--> statement-breakpoint
DROP TABLE "user_profiles" CASCADE;--> statement-breakpoint
DROP TABLE "users" CASCADE;--> statement-breakpoint
DROP TABLE "verification_token" CASCADE;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "reasoning" SET DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "reasoning" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_feedback" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_feedback" ALTER COLUMN "message" SET DEFAULT 'No message provided';--> statement-breakpoint
ALTER TABLE "app_feedback" ALTER COLUMN "message" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "message" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "correlation_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "actor" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "subject" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "context" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "error" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_logs" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cohorts" ALTER COLUMN "description" SET DEFAULT 'No description provided';--> statement-breakpoint
ALTER TABLE "cohorts" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "file_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "personas" ALTER COLUMN "reasoning" SET DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "personas" ALTER COLUMN "reasoning" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "last_active" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "last_active" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_chat_feedbacks" ALTER COLUMN "feedback" SET DEFAULT 'No feedback provided';--> statement-breakpoint
ALTER TABLE "simulation_chat_feedbacks" ALTER COLUMN "feedback" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_chats" ALTER COLUMN "trace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_hints" ADD CONSTRAINT "simulation_hints_pkey" PRIMARY KEY("simulation_message_id","idx");--> statement-breakpoint
ALTER TABLE "scenario_objectives" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "simulation_hints" ADD COLUMN "idx" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "document_parameter_items" ADD CONSTRAINT "document_parameter_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_parameter_items" ADD CONSTRAINT "document_parameter_items_parameter_item_id_fkey" FOREIGN KEY ("parameter_item_id") REFERENCES "public"."parameter_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_request_limits" ADD CONSTRAINT "profile_request_limits_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_endpoints" ADD CONSTRAINT "provider_endpoints_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_time_limits" ADD CONSTRAINT "simulation_time_limits_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_parameter_items_document_id_idx" ON "document_parameter_items" USING btree ("document_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "document_parameter_items_parameter_item_id_idx" ON "document_parameter_items" USING btree ("parameter_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "profile_request_limits_profile_id_idx" ON "profile_request_limits" USING btree ("profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "provider_endpoints_provider_id_idx" ON "provider_endpoints" USING btree ("provider_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "simulation_time_limits_simulation_id_idx" ON "simulation_time_limits" USING btree ("simulation_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_alias_unique" ON "profiles" USING btree ("alias" text_ops);--> statement-breakpoint
CREATE INDEX "simulation_hints_simulation_message_id_idx" ON "simulation_hints" USING btree ("simulation_message_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "app_logs" DROP COLUMN "metrics";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "req_per_day";--> statement-breakpoint
ALTER TABLE "providers" DROP COLUMN "base_url";--> statement-breakpoint
ALTER TABLE "simulation_attempts" DROP COLUMN "infinite_mode_time_limit";--> statement-breakpoint
ALTER TABLE "simulation_chats" DROP COLUMN "completed_at";--> statement-breakpoint
ALTER TABLE "simulation_hints" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "simulation_hints" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "simulations" DROP COLUMN "time_limit";--> statement-breakpoint
CREATE MATERIALIZED VIEW "public"."analytics" AS (WITH RECURSIVE scenario_roots AS ( SELECT s_1.id, st.parent_id, s_1.id AS root_id FROM scenarios s_1 JOIN scenario_tree st ON st.child_id = s_1.id AND st.parent_id = s_1.id UNION ALL SELECT s1.id, st.parent_id, sr.root_id FROM scenarios s1 JOIN scenario_tree st ON st.child_id = s1.id AND st.parent_id <> s1.id JOIN scenario_roots sr ON st.parent_id = sr.id ), root_map AS ( SELECT s_1.id AS leaf_scenario_id, COALESCE(sr.root_id, s_1.id) AS root_scenario_id FROM scenarios s_1 LEFT JOIN scenario_roots sr ON s_1.id = sr.id ), latest_grade AS ( SELECT DISTINCT ON (simulation_chat_grades.simulation_chat_id) simulation_chat_grades.simulation_chat_id, simulation_chat_grades.score::numeric AS score, simulation_chat_grades.time_taken::numeric AS time_taken_seconds, simulation_chat_grades.rubric_id, simulation_chat_grades.created_at FROM simulation_chat_grades ORDER BY simulation_chat_grades.simulation_chat_id, simulation_chat_grades.created_at DESC ), active_sims AS ( SELECT simulations.id, simulations.created_at, simulations.updated_at, simulations.title, simulations.description, simulations.active, simulations.rubric_id, simulations.default_simulation, simulations.practice_simulation, simulations.department_id, simulations.output_guardrail_active, simulations.input_guardrail_active, simulations.image_input_active, simulations.hints_enabled FROM simulations WHERE simulations.active = true ), active_scenarios AS ( SELECT scenarios.id, scenarios.created_at, scenarios.updated_at, scenarios.name, scenarios.problem_statement, scenarios.default_scenario, scenarios.generated, scenarios.active, scenarios.department_id FROM scenarios WHERE scenarios.active = true ), cohorts_expanded AS ( SELECT c.id, c.active FROM cohorts c ), cohorts_by_sim AS ( SELECT s_1.id AS simulation_id, ARRAY( SELECT DISTINCT c.id FROM cohorts c JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = s_1.id WHERE c.active = true) AS cohort_ids FROM active_sims s_1 ), profile_cohorts_for_sim AS ( SELECT sa_1.id AS attempt_id, ap_1.profile_id, sa_1.simulation_id, ARRAY( SELECT c.id FROM cohorts c JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = sa_1.simulation_id JOIN cohort_profiles cp ON cp.cohort_id = c.id AND cp.profile_id = ap_1.profile_id WHERE c.active = true) AS profile_cohort_ids FROM simulation_attempts sa_1 LEFT JOIN attempt_profiles ap_1 ON ap_1.attempt_id = sa_1.id AND ap_1.active = true ), message_counts AS ( SELECT sm.chat_id, count(*)::integer AS num_messages_total, count(*) FILTER (WHERE sm.type = 'query'::simulation_message_type)::integer AS num_query_messages, count(*) FILTER (WHERE sm.type = 'response'::simulation_message_type)::integer AS num_response_messages FROM simulation_messages sm GROUP BY sm.chat_id ), message_deltas AS ( SELECT m.chat_id, CASE WHEN lag(m.type) OVER (PARTITION BY m.chat_id ORDER BY m.created_at) = 'response'::simulation_message_type AND m.type = 'query'::simulation_message_type THEN GREATEST(EXTRACT(epoch FROM m.created_at - COALESCE(lag(COALESCE(m.updated_at, m.created_at)) OVER (PARTITION BY m.chat_id ORDER BY m.created_at), sc_1.created_at))::integer, 0) ELSE NULL::integer END AS delta_seconds, m.created_at FROM simulation_messages m JOIN simulation_chats sc_1 ON sc_1.id = m.chat_id ), message_deltas_agg AS ( SELECT message_deltas.chat_id, array_remove(array_agg(message_deltas.delta_seconds ORDER BY message_deltas.created_at), NULL::integer) AS message_time_taken_seconds FROM message_deltas GROUP BY message_deltas.chat_id ), effective_profile_department AS ( SELECT pd.profile_id, COALESCE(( SELECT pd1.department_id FROM profile_departments pd1 WHERE pd1.profile_id = pd.profile_id AND pd1.is_primary LIMIT 1), ( SELECT pd2.department_id FROM profile_departments pd2 WHERE pd2.profile_id = pd.profile_id ORDER BY pd2.created_at LIMIT 1)) AS department_id FROM ( SELECT DISTINCT ap_1.profile_id FROM simulation_attempts sa_1 JOIN attempt_profiles ap_1 ON ap_1.attempt_id = sa_1.id AND ap_1.active = true) pd ) SELECT sc.id AS chat_id, sc.attempt_id, ap.profile_id, sa.simulation_id, rm.root_scenario_id AS scenario_id, rm.leaf_scenario_id, sp.persona_id, p.color AS persona_color, sim.practice_simulation AS is_practice, sa.archived AS is_archived, NOT sim.practice_simulation AND NOT sa.archived AS is_general, pr.role AS profile_role, cbs.cohort_ids, sc.created_at AS chat_created_at, CASE WHEN lg.score IS NULL OR r.points IS NULL OR r.points = 0 THEN NULL::numeric ELSE lg.score / r.points::numeric * 100.0 END AS grade_percent, CASE WHEN lg.score IS NULL OR r.points IS NULL OR r.pass_points IS NULL THEN NULL::boolean ELSE lg.score >= r.pass_points::numeric END AS passed, lg.time_taken_seconds, lg.rubric_id, r.points AS rubric_points, r.pass_points AS rubric_pass_points, sc.completed OR lg.simulation_chat_id IS NOT NULL AS completed, COALESCE(mc.num_messages_total, 0) AS num_messages_total, COALESCE(mc.num_query_messages, 0) AS num_query_messages, COALESCE(mc.num_response_messages, 0) AS num_response_messages, COALESCE(mda.message_time_taken_seconds, '{}'::integer[]) AS message_time_taken_seconds, sa.created_at AS attempt_created_at, pcs.profile_cohort_ids, (( SELECT count(*) AS count FROM simulation_scenarios ss WHERE ss.simulation_id = sim.id))::integer AS sim_scenario_count, lg.created_at AS grade_created_at, COALESCE(epd.department_id, sim.department_id, r.department_id, s.department_id, p.department_id) AS department_id FROM simulation_chats sc JOIN simulation_attempts sa ON sa.id = sc.attempt_id LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true JOIN active_sims sim ON sim.id = sa.simulation_id JOIN profiles pr ON pr.id = ap.profile_id JOIN active_scenarios s ON s.id = sc.scenario_id JOIN root_map rm ON rm.leaf_scenario_id = s.id LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true LEFT JOIN personas p ON p.id = sp.persona_id LEFT JOIN latest_grade lg ON lg.simulation_chat_id = sc.id LEFT JOIN rubrics r ON r.id = lg.rubric_id LEFT JOIN cohorts_by_sim cbs ON cbs.simulation_id = sa.simulation_id LEFT JOIN profile_cohorts_for_sim pcs ON pcs.attempt_id = sa.id LEFT JOIN message_counts mc ON mc.chat_id = sc.id LEFT JOIN message_deltas_agg mda ON mda.chat_id = sc.id LEFT JOIN effective_profile_department epd ON epd.profile_id = ap.profile_id);