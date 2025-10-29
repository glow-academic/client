CREATE TYPE "public"."agent_role" AS ENUM('assistant', 'classify', 'grade', 'hint', 'input_guardrail', 'output_guardrail', 'scenario', 'title');--> statement-breakpoint
CREATE TABLE "cohort_departments" (
	"cohort_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cohort_departments_pkey" PRIMARY KEY("cohort_id","department_id")
);
--> statement-breakpoint
CREATE TABLE "document_departments" (
	"document_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_departments_pkey" PRIMARY KEY("document_id","department_id")
);
--> statement-breakpoint
CREATE TABLE "parameter_departments" (
	"parameter_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parameter_departments_pkey" PRIMARY KEY("parameter_id","department_id")
);
--> statement-breakpoint
CREATE TABLE "persona_departments" (
	"persona_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "persona_departments_pkey" PRIMARY KEY("persona_id","department_id")
);
--> statement-breakpoint
CREATE TABLE "rubric_departments" (
	"rubric_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rubric_departments_pkey" PRIMARY KEY("rubric_id","department_id")
);
--> statement-breakpoint
CREATE TABLE "scenario_departments" (
	"scenario_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scenario_departments_pkey" PRIMARY KEY("scenario_id","department_id")
);
--> statement-breakpoint
CREATE TABLE "simulation_departments" (
	"simulation_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "simulation_departments_pkey" PRIMARY KEY("simulation_id","department_id")
);
--> statement-breakpoint
DROP MATERIALIZED VIEW "public"."analytics";--> statement-breakpoint
ALTER TABLE "department_agents" RENAME TO "agent_departments";--> statement-breakpoint
ALTER TABLE "cohorts" DROP CONSTRAINT "cohorts_department_id_fkey";
--> statement-breakpoint
ALTER TABLE "agent_departments" DROP CONSTRAINT "department_agents_department_id_fkey";
--> statement-breakpoint
ALTER TABLE "agent_departments" DROP CONSTRAINT "department_agents_agent_id_fkey";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_department_id_fkey";
--> statement-breakpoint
ALTER TABLE "model_runs" DROP CONSTRAINT "model_runs_department_id_fkey";
--> statement-breakpoint
ALTER TABLE "parameters" DROP CONSTRAINT "parameters_department_id_fkey";
--> statement-breakpoint
ALTER TABLE "personas" DROP CONSTRAINT "personas_department_id_fkey";
--> statement-breakpoint
ALTER TABLE "rubrics" DROP CONSTRAINT "rubrics_department_id_fkey";
--> statement-breakpoint
ALTER TABLE "scenarios" DROP CONSTRAINT "scenarios_department_id_fkey";
--> statement-breakpoint
ALTER TABLE "simulations" DROP CONSTRAINT "simulations_department_id_fkey";
--> statement-breakpoint
DROP INDEX "department_agents_agent_id_idx";--> statement-breakpoint
DROP INDEX "department_agents_department_id_role_idx";--> statement-breakpoint
ALTER TABLE "agent_departments" DROP CONSTRAINT "department_agents_pkey";--> statement-breakpoint
ALTER TABLE "agent_departments" ADD CONSTRAINT "agent_departments_pkey" PRIMARY KEY("agent_id","department_id");--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "role" "agent_role" DEFAULT 'assistant' NOT NULL;--> statement-breakpoint
ALTER TABLE "cohort_departments" ADD CONSTRAINT "cohort_departments_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_departments" ADD CONSTRAINT "cohort_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_departments" ADD CONSTRAINT "document_departments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_departments" ADD CONSTRAINT "document_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parameter_departments" ADD CONSTRAINT "parameter_departments_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "public"."parameters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parameter_departments" ADD CONSTRAINT "parameter_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_departments" ADD CONSTRAINT "persona_departments_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_departments" ADD CONSTRAINT "persona_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric_departments" ADD CONSTRAINT "rubric_departments_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric_departments" ADD CONSTRAINT "rubric_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_departments" ADD CONSTRAINT "scenario_departments_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_departments" ADD CONSTRAINT "scenario_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_departments" ADD CONSTRAINT "simulation_departments_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_departments" ADD CONSTRAINT "simulation_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cohort_departments_cohort_id_idx" ON "cohort_departments" USING btree ("cohort_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "cohort_departments_department_id_idx" ON "cohort_departments" USING btree ("department_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "document_departments_department_id_idx" ON "document_departments" USING btree ("department_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "document_departments_document_id_idx" ON "document_departments" USING btree ("document_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "parameter_departments_department_id_idx" ON "parameter_departments" USING btree ("department_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "parameter_departments_parameter_id_idx" ON "parameter_departments" USING btree ("parameter_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "persona_departments_department_id_idx" ON "persona_departments" USING btree ("department_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "persona_departments_persona_id_idx" ON "persona_departments" USING btree ("persona_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "rubric_departments_department_id_idx" ON "rubric_departments" USING btree ("department_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "rubric_departments_rubric_id_idx" ON "rubric_departments" USING btree ("rubric_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "scenario_departments_department_id_idx" ON "scenario_departments" USING btree ("department_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "scenario_departments_scenario_id_idx" ON "scenario_departments" USING btree ("scenario_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "simulation_departments_department_id_idx" ON "simulation_departments" USING btree ("department_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "simulation_departments_simulation_id_idx" ON "simulation_departments" USING btree ("simulation_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "agent_departments" ADD CONSTRAINT "agent_departments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_departments" ADD CONSTRAINT "agent_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_departments_agent_id_idx" ON "agent_departments" USING btree ("agent_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "agent_departments_department_id_idx" ON "agent_departments" USING btree ("department_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "default_agent";--> statement-breakpoint
ALTER TABLE "cohorts" DROP COLUMN "default_cohort";--> statement-breakpoint
ALTER TABLE "cohorts" DROP COLUMN "department_id";--> statement-breakpoint
ALTER TABLE "agent_departments" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "departments" DROP COLUMN "default_department";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "department_id";--> statement-breakpoint
ALTER TABLE "model_runs" DROP COLUMN "department_id";--> statement-breakpoint
ALTER TABLE "parameters" DROP COLUMN "default_parameter";--> statement-breakpoint
ALTER TABLE "parameters" DROP COLUMN "department_id";--> statement-breakpoint
ALTER TABLE "personas" DROP COLUMN "default_persona";--> statement-breakpoint
ALTER TABLE "personas" DROP COLUMN "department_id";--> statement-breakpoint
ALTER TABLE "rubrics" DROP COLUMN "default_rubric";--> statement-breakpoint
ALTER TABLE "rubrics" DROP COLUMN "department_id";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "default_scenario";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "department_id";--> statement-breakpoint
ALTER TABLE "simulations" DROP COLUMN "default_simulation";--> statement-breakpoint
ALTER TABLE "simulations" DROP COLUMN "department_id";--> statement-breakpoint
CREATE MATERIALIZED VIEW "public"."analytics" AS (WITH RECURSIVE scenario_roots AS ( SELECT s_1.id, st.parent_id, s_1.id AS root_id FROM scenarios s_1 JOIN scenario_tree st ON st.child_id = s_1.id AND st.parent_id = s_1.id UNION ALL SELECT s1.id, st.parent_id, sr.root_id FROM scenarios s1 JOIN scenario_tree st ON st.child_id = s1.id AND st.parent_id <> s1.id JOIN scenario_roots sr ON st.parent_id = sr.id ), root_map AS ( SELECT s_1.id AS leaf_scenario_id, COALESCE(sr.root_id, s_1.id) AS root_scenario_id FROM scenarios s_1 LEFT JOIN scenario_roots sr ON s_1.id = sr.id ), latest_grade AS ( SELECT DISTINCT ON (simulation_chat_grades.simulation_chat_id) simulation_chat_grades.simulation_chat_id, simulation_chat_grades.score::numeric AS score, simulation_chat_grades.time_taken::numeric AS time_taken_seconds, simulation_chat_grades.rubric_id, simulation_chat_grades.created_at FROM simulation_chat_grades ORDER BY simulation_chat_grades.simulation_chat_id, simulation_chat_grades.created_at DESC ), active_sims AS ( SELECT simulations.id, simulations.created_at, simulations.updated_at, simulations.title, simulations.description, simulations.active, simulations.rubric_id, simulations.practice_simulation, simulations.output_guardrail_active, simulations.input_guardrail_active, simulations.image_input_active, simulations.hints_enabled, simulations.objectives_enabled FROM simulations WHERE simulations.active = true ), active_scenarios AS ( SELECT scenarios.id, scenarios.created_at, scenarios.updated_at, scenarios.name, scenarios.use_documents, scenarios.generated, scenarios.active FROM scenarios WHERE scenarios.active = true ), cohorts_expanded AS ( SELECT c.id, c.active FROM cohorts c ), cohorts_by_sim AS ( SELECT s_1.id AS simulation_id, ARRAY( SELECT DISTINCT c.id FROM cohorts c JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = s_1.id WHERE c.active = true) AS cohort_ids FROM active_sims s_1 ), profile_cohorts_for_sim AS ( SELECT sa_1.id AS attempt_id, ap_1.profile_id, sa_1.simulation_id, ARRAY( SELECT c.id FROM cohorts c JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = sa_1.simulation_id JOIN cohort_profiles cp ON cp.cohort_id = c.id AND cp.profile_id = ap_1.profile_id WHERE c.active = true) AS profile_cohort_ids FROM simulation_attempts sa_1 LEFT JOIN attempt_profiles ap_1 ON ap_1.attempt_id = sa_1.id AND ap_1.active = true ), message_counts AS ( SELECT sm.chat_id, count(*)::integer AS num_messages_total, count(*) FILTER (WHERE sm.type = 'query'::simulation_message_type)::integer AS num_query_messages, count(*) FILTER (WHERE sm.type = 'response'::simulation_message_type)::integer AS num_response_messages FROM simulation_messages sm GROUP BY sm.chat_id ), message_deltas AS ( SELECT m.chat_id, CASE WHEN lag(m.type) OVER (PARTITION BY m.chat_id ORDER BY m.created_at) = 'response'::simulation_message_type AND m.type = 'query'::simulation_message_type THEN GREATEST(EXTRACT(epoch FROM m.created_at - COALESCE(lag(COALESCE(m.updated_at, m.created_at)) OVER (PARTITION BY m.chat_id ORDER BY m.created_at), sc_1.created_at))::integer, 0) ELSE NULL::integer END AS delta_seconds, m.created_at FROM simulation_messages m JOIN simulation_chats sc_1 ON sc_1.id = m.chat_id ), message_deltas_agg AS ( SELECT message_deltas.chat_id, array_remove(array_agg(message_deltas.delta_seconds ORDER BY message_deltas.created_at), NULL::integer) AS message_time_taken_seconds FROM message_deltas GROUP BY message_deltas.chat_id ), effective_profile_department AS ( SELECT pd.profile_id, COALESCE(( SELECT pd1.department_id FROM profile_departments pd1 WHERE pd1.profile_id = pd.profile_id AND pd1.is_primary LIMIT 1), ( SELECT pd2.department_id FROM profile_departments pd2 WHERE pd2.profile_id = pd.profile_id ORDER BY pd2.created_at LIMIT 1)) AS department_id FROM ( SELECT DISTINCT ap_1.profile_id FROM simulation_attempts sa_1 JOIN attempt_profiles ap_1 ON ap_1.attempt_id = sa_1.id AND ap_1.active = true) pd ), simulation_first_dept AS ( SELECT DISTINCT ON (simulation_departments.simulation_id) simulation_departments.simulation_id, simulation_departments.department_id FROM simulation_departments WHERE simulation_departments.active = true ORDER BY simulation_departments.simulation_id, simulation_departments.created_at ), rubric_first_dept AS ( SELECT DISTINCT ON (rubric_departments.rubric_id) rubric_departments.rubric_id, rubric_departments.department_id FROM rubric_departments WHERE rubric_departments.active = true ORDER BY rubric_departments.rubric_id, rubric_departments.created_at ), scenario_first_dept AS ( SELECT DISTINCT ON (scenario_departments.scenario_id) scenario_departments.scenario_id, scenario_departments.department_id FROM scenario_departments WHERE scenario_departments.active = true ORDER BY scenario_departments.scenario_id, scenario_departments.created_at ), persona_first_dept AS ( SELECT DISTINCT ON (persona_departments.persona_id) persona_departments.persona_id, persona_departments.department_id FROM persona_departments WHERE persona_departments.active = true ORDER BY persona_departments.persona_id, persona_departments.created_at ) SELECT sc.id AS chat_id, sc.attempt_id, ap.profile_id, sa.simulation_id, rm.root_scenario_id AS scenario_id, rm.leaf_scenario_id, sp.persona_id, p.color AS persona_color, sim.practice_simulation AS is_practice, sa.archived AS is_archived, NOT sim.practice_simulation AND NOT sa.archived AS is_general, pr.role AS profile_role, cbs.cohort_ids, sc.created_at AS chat_created_at, CASE WHEN lg.score IS NULL OR r.points IS NULL OR r.points = 0 THEN NULL::numeric ELSE lg.score / r.points::numeric * 100.0 END AS grade_percent, CASE WHEN lg.score IS NULL OR r.points IS NULL OR r.pass_points IS NULL THEN NULL::boolean ELSE lg.score >= r.pass_points::numeric END AS passed, lg.time_taken_seconds, lg.rubric_id, r.points AS rubric_points, r.pass_points AS rubric_pass_points, sc.completed OR lg.simulation_chat_id IS NOT NULL AS completed, COALESCE(mc.num_messages_total, 0) AS num_messages_total, COALESCE(mc.num_query_messages, 0) AS num_query_messages, COALESCE(mc.num_response_messages, 0) AS num_response_messages, COALESCE(mda.message_time_taken_seconds, '{}'::integer[]) AS message_time_taken_seconds, sa.created_at AS attempt_created_at, pcs.profile_cohort_ids, (( SELECT count(*) AS count FROM simulation_scenarios ss WHERE ss.simulation_id = sim.id))::integer AS sim_scenario_count, lg.created_at AS grade_created_at, COALESCE(epd.department_id, sfd.department_id, rfd.department_id, scfd.department_id, pfd.department_id) AS department_id FROM simulation_chats sc JOIN simulation_attempts sa ON sa.id = sc.attempt_id LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true JOIN active_sims sim ON sim.id = sa.simulation_id JOIN profiles pr ON pr.id = ap.profile_id JOIN active_scenarios s ON s.id = sc.scenario_id JOIN root_map rm ON rm.leaf_scenario_id = s.id LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = true LEFT JOIN personas p ON p.id = sp.persona_id LEFT JOIN latest_grade lg ON lg.simulation_chat_id = sc.id LEFT JOIN rubrics r ON r.id = lg.rubric_id LEFT JOIN cohorts_by_sim cbs ON cbs.simulation_id = sa.simulation_id LEFT JOIN profile_cohorts_for_sim pcs ON pcs.attempt_id = sa.id LEFT JOIN message_counts mc ON mc.chat_id = sc.id LEFT JOIN message_deltas_agg mda ON mda.chat_id = sc.id LEFT JOIN effective_profile_department epd ON epd.profile_id = ap.profile_id LEFT JOIN simulation_first_dept sfd ON sfd.simulation_id = sim.id LEFT JOIN rubric_first_dept rfd ON rfd.rubric_id = r.id LEFT JOIN scenario_first_dept scfd ON scfd.scenario_id = s.id LEFT JOIN persona_first_dept pfd ON pfd.persona_id = p.id);