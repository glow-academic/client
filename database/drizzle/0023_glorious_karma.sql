CREATE TABLE "cohort_profiles" (
	"cohort_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	CONSTRAINT "cohort_profiles_pkey" PRIMARY KEY("cohort_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "cohort_simulations" (
	"cohort_id" uuid NOT NULL,
	"simulation_id" uuid NOT NULL,
	CONSTRAINT "cohort_simulations_pkey" PRIMARY KEY("cohort_id","simulation_id")
);
--> statement-breakpoint
CREATE TABLE "department_agents" (
	"department_id" uuid NOT NULL,
	"role" text NOT NULL,
	"agent_id" uuid NOT NULL,
	CONSTRAINT "department_agents_pkey" PRIMARY KEY("department_id","role")
);
--> statement-breakpoint
CREATE TABLE "profile_departments" (
	"profile_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_departments_pkey" PRIMARY KEY("profile_id","department_id")
);
--> statement-breakpoint
CREATE TABLE "scenario_documents" (
	"scenario_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	CONSTRAINT "scenario_documents_pkey" PRIMARY KEY("scenario_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "scenario_objectives" (
	"scenario_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"objective" text NOT NULL,
	CONSTRAINT "scenario_objectives_pkey" PRIMARY KEY("scenario_id","idx")
);
--> statement-breakpoint
CREATE TABLE "scenario_parameter_items" (
	"scenario_id" uuid NOT NULL,
	"parameter_item_id" uuid NOT NULL,
	CONSTRAINT "scenario_parameter_items_pkey" PRIMARY KEY("scenario_id","parameter_item_id")
);
--> statement-breakpoint
CREATE TABLE "scenario_tree" (
	"parent_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	CONSTRAINT "scenario_tree_pkey" PRIMARY KEY("parent_id","child_id")
);
--> statement-breakpoint
CREATE TABLE "simulation_scenarios" (
	"simulation_id" uuid NOT NULL,
	"scenario_id" uuid NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "simulation_scenarios_pkey" PRIMARY KEY("simulation_id","scenario_id")
);
--> statement-breakpoint
CREATE TABLE "simulation_tag_documents" (
	"simulation_id" uuid NOT NULL,
	"tag_idx" integer NOT NULL,
	"document_id" uuid NOT NULL,
	CONSTRAINT "simulation_tag_documents_pkey" PRIMARY KEY("simulation_id","tag_idx","document_id")
);
--> statement-breakpoint
CREATE TABLE "simulation_tag_parameter_items" (
	"simulation_id" uuid NOT NULL,
	"tag_idx" integer NOT NULL,
	"parameter_item_id" uuid NOT NULL,
	CONSTRAINT "simulation_tag_parameter_items_pkey" PRIMARY KEY("simulation_id","tag_idx","parameter_item_id")
);
--> statement-breakpoint
CREATE TABLE "simulation_tags" (
	"simulation_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"tag" text NOT NULL,
	CONSTRAINT "simulation_tags_pkey" PRIMARY KEY("simulation_id","idx")
);
--> statement-breakpoint
ALTER TABLE "migrations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "simulation_chat_crowdsourced_feedbacks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "simulation_crowdsourced_messages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP MATERIALIZED VIEW "public"."analytics";--> statement-breakpoint
DROP TABLE "migrations" CASCADE;--> statement-breakpoint
DROP TABLE "simulation_chat_crowdsourced_feedbacks" CASCADE;--> statement-breakpoint
DROP TABLE "simulation_crowdsourced_messages" CASCADE;--> statement-breakpoint
ALTER TABLE "scenarios" RENAME COLUMN "description" TO "problem_statement";--> statement-breakpoint
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_department_id_fkey";
--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN "output_guardrail_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN "input_guardrail_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN "image_input_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN "hints_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cohort_profiles" ADD CONSTRAINT "cohort_profiles_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_profiles" ADD CONSTRAINT "cohort_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_simulations" ADD CONSTRAINT "cohort_simulations_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_simulations" ADD CONSTRAINT "cohort_simulations_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_agents" ADD CONSTRAINT "department_agents_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "department_agents" ADD CONSTRAINT "department_agents_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_departments" ADD CONSTRAINT "profile_departments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_departments" ADD CONSTRAINT "profile_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_documents" ADD CONSTRAINT "scenario_documents_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_documents" ADD CONSTRAINT "scenario_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_objectives" ADD CONSTRAINT "scenario_objectives_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_parameter_items" ADD CONSTRAINT "scenario_parameter_items_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_parameter_items" ADD CONSTRAINT "scenario_parameter_items_parameter_item_id_fkey" FOREIGN KEY ("parameter_item_id") REFERENCES "public"."parameter_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_tree" ADD CONSTRAINT "scenario_tree_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_tree" ADD CONSTRAINT "scenario_tree_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_scenarios" ADD CONSTRAINT "simulation_scenarios_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_scenarios" ADD CONSTRAINT "simulation_scenarios_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_tag_documents" ADD CONSTRAINT "simulation_tag_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_tag_documents" ADD CONSTRAINT "simulation_tag_documents_tag_fk" FOREIGN KEY ("simulation_id","tag_idx") REFERENCES "public"."simulation_tags"("simulation_id","idx") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_tag_parameter_items" ADD CONSTRAINT "simulation_tag_parameter_items_parameter_item_id_fkey" FOREIGN KEY ("parameter_item_id") REFERENCES "public"."parameter_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_tag_parameter_items" ADD CONSTRAINT "simulation_tag_parameter_items_tag_fk" FOREIGN KEY ("simulation_id","tag_idx") REFERENCES "public"."simulation_tags"("simulation_id","idx") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_tags" ADD CONSTRAINT "simulation_tags_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cohort_profiles_cohort_id_idx" ON "cohort_profiles" USING btree ("cohort_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "cohort_profiles_profile_id_idx" ON "cohort_profiles" USING btree ("profile_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "cohort_simulations_cohort_id_idx" ON "cohort_simulations" USING btree ("cohort_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "cohort_simulations_simulation_id_idx" ON "cohort_simulations" USING btree ("simulation_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "department_agents_agent_id_idx" ON "department_agents" USING btree ("agent_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "department_agents_department_id_role_idx" ON "department_agents" USING btree ("department_id" uuid_ops,"role" uuid_ops);--> statement-breakpoint
CREATE INDEX "profile_departments_department_id_idx" ON "profile_departments" USING btree ("department_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "profile_departments_one_primary_per_profile" ON "profile_departments" USING btree ("profile_id" uuid_ops) WHERE is_primary;--> statement-breakpoint
CREATE INDEX "profile_departments_profile_id_is_primary_idx" ON "profile_departments" USING btree ("profile_id" bool_ops,"is_primary" bool_ops);--> statement-breakpoint
CREATE INDEX "scenario_documents_document_id_idx" ON "scenario_documents" USING btree ("document_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "scenario_documents_scenario_id_idx" ON "scenario_documents" USING btree ("scenario_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "scenario_objectives_scenario_id_idx" ON "scenario_objectives" USING btree ("scenario_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "scenario_parameter_items_parameter_item_id_idx" ON "scenario_parameter_items" USING btree ("parameter_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "scenario_parameter_items_scenario_id_idx" ON "scenario_parameter_items" USING btree ("scenario_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "scenario_tree_child_id_idx" ON "scenario_tree" USING btree ("child_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_tree_one_parent_per_child" ON "scenario_tree" USING btree ("child_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "scenario_tree_parent_id_idx" ON "scenario_tree" USING btree ("parent_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "simulation_scenarios_position_uniq" ON "simulation_scenarios" USING btree ("simulation_id" int4_ops,"position" int4_ops);--> statement-breakpoint
CREATE INDEX "simulation_scenarios_scenario_id_idx" ON "simulation_scenarios" USING btree ("scenario_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "simulation_scenarios_simulation_id_idx" ON "simulation_scenarios" USING btree ("simulation_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "simulation_tag_documents_document_id_idx" ON "simulation_tag_documents" USING btree ("document_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "simulation_tag_documents_simulation_id_tag_idx_idx" ON "simulation_tag_documents" USING btree ("simulation_id" int4_ops,"tag_idx" int4_ops);--> statement-breakpoint
CREATE INDEX "simulation_tag_parameter_items_parameter_item_id_idx" ON "simulation_tag_parameter_items" USING btree ("parameter_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "simulation_tag_parameter_items_simulation_id_tag_idx_idx" ON "simulation_tag_parameter_items" USING btree ("simulation_id" int4_ops,"tag_idx" int4_ops);--> statement-breakpoint
CREATE INDEX "simulation_tags_simulation_id_idx" ON "simulation_tags" USING btree ("simulation_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "simulation_tags_text_idx" ON "simulation_tags" USING btree (simulation_id,lower(tag));--> statement-breakpoint
CREATE UNIQUE INDEX "simulation_tags_unique_text_per_sim" ON "simulation_tags" USING btree (simulation_id,lower(tag));--> statement-breakpoint
ALTER TABLE "cohorts" DROP COLUMN "profile_ids";--> statement-breakpoint
ALTER TABLE "cohorts" DROP COLUMN "simulation_ids";--> statement-breakpoint
ALTER TABLE "departments" DROP COLUMN "title_agent_id";--> statement-breakpoint
ALTER TABLE "departments" DROP COLUMN "scenario_agent_id";--> statement-breakpoint
ALTER TABLE "departments" DROP COLUMN "classify_agent_id";--> statement-breakpoint
ALTER TABLE "departments" DROP COLUMN "assistant_agent_id";--> statement-breakpoint
ALTER TABLE "departments" DROP COLUMN "grade_agent_id";--> statement-breakpoint
ALTER TABLE "departments" DROP COLUMN "input_guardrail_agent_id";--> statement-breakpoint
ALTER TABLE "departments" DROP COLUMN "output_guardrail_agent_id";--> statement-breakpoint
ALTER TABLE "departments" DROP COLUMN "hint_agent_id";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "tags";--> statement-breakpoint
ALTER TABLE "parameter_items" DROP COLUMN "tags";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "department_id";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "objectives";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "parameter_item_ids";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "document_ids";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "practice_scenario";--> statement-breakpoint
ALTER TABLE "scenarios" DROP COLUMN "parent_id";--> statement-breakpoint
ALTER TABLE "simulations" DROP COLUMN "scenario_ids";--> statement-breakpoint
CREATE VIEW "public"."v_tagged_documents" AS (SELECT st.simulation_id, st.tag, std.document_id, d.name AS document_name FROM simulation_tags st JOIN simulation_tag_documents std ON std.simulation_id = st.simulation_id AND std.tag_idx = st.idx JOIN documents d ON d.id = std.document_id);--> statement-breakpoint
CREATE VIEW "public"."v_tagged_parameter_items" AS (SELECT st.simulation_id, st.tag, stpi.parameter_item_id, pi.name AS parameter_item_name FROM simulation_tags st JOIN simulation_tag_parameter_items stpi ON stpi.simulation_id = st.simulation_id AND stpi.tag_idx = st.idx JOIN parameter_items pi ON pi.id = stpi.parameter_item_id);--> statement-breakpoint
CREATE MATERIALIZED VIEW "public"."analytics" AS (WITH RECURSIVE scenario_roots AS ( SELECT s_1.id, st.parent_id, s_1.id AS root_id FROM scenarios s_1 JOIN scenario_tree st ON st.child_id = s_1.id AND st.parent_id = s_1.id UNION ALL SELECT s1.id, st.parent_id, sr.root_id FROM scenarios s1 JOIN scenario_tree st ON st.child_id = s1.id AND st.parent_id <> s1.id JOIN scenario_roots sr ON st.parent_id = sr.id ), root_map AS ( SELECT s_1.id AS leaf_scenario_id, COALESCE(sr.root_id, s_1.id) AS root_scenario_id FROM scenarios s_1 LEFT JOIN scenario_roots sr ON s_1.id = sr.id ), latest_grade AS ( SELECT DISTINCT ON (simulation_chat_grades.simulation_chat_id) simulation_chat_grades.simulation_chat_id, simulation_chat_grades.score::numeric AS score, simulation_chat_grades.time_taken::numeric AS time_taken_seconds, simulation_chat_grades.rubric_id, simulation_chat_grades.created_at FROM simulation_chat_grades ORDER BY simulation_chat_grades.simulation_chat_id, simulation_chat_grades.created_at DESC ), active_sims AS ( SELECT simulations.id, simulations.created_at, simulations.updated_at, simulations.title, simulations.description, simulations.time_limit, simulations.active, simulations.rubric_id, simulations.default_simulation, simulations.practice_simulation, simulations.department_id, simulations.output_guardrail_active, simulations.input_guardrail_active, simulations.image_input_active, simulations.hints_enabled FROM simulations WHERE simulations.active = true ), active_scenarios AS ( SELECT scenarios.id, scenarios.created_at, scenarios.updated_at, scenarios.name, scenarios.problem_statement, scenarios.persona_id, scenarios.default_scenario, scenarios.generated, scenarios.active, scenarios.department_id FROM scenarios WHERE scenarios.active = true ), cohorts_expanded AS ( SELECT c.id, c.active FROM cohorts c ), cohorts_by_sim AS ( SELECT s_1.id AS simulation_id, ARRAY( SELECT DISTINCT c.id FROM cohorts c JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = s_1.id WHERE c.active = true) AS cohort_ids FROM active_sims s_1 ), profile_cohorts_for_sim AS ( SELECT sa_1.id AS attempt_id, sa_1.profile_id, sa_1.simulation_id, ARRAY( SELECT c.id FROM cohorts c JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = sa_1.simulation_id JOIN cohort_profiles cp ON cp.cohort_id = c.id AND cp.profile_id = sa_1.profile_id WHERE c.active = true) AS profile_cohort_ids FROM simulation_attempts sa_1 ), message_counts AS ( SELECT sm.chat_id, count(*)::integer AS num_messages_total, count(*) FILTER (WHERE sm.type = 'query'::simulation_message_type)::integer AS num_query_messages, count(*) FILTER (WHERE sm.type = 'response'::simulation_message_type)::integer AS num_response_messages FROM simulation_messages sm GROUP BY sm.chat_id ), message_deltas AS ( SELECT m.chat_id, CASE WHEN lag(m.type) OVER (PARTITION BY m.chat_id ORDER BY m.created_at) = 'response'::simulation_message_type AND m.type = 'query'::simulation_message_type THEN GREATEST(EXTRACT(epoch FROM m.created_at - COALESCE(lag(COALESCE(m.updated_at, m.created_at)) OVER (PARTITION BY m.chat_id ORDER BY m.created_at), sc_1.created_at))::integer, 0) ELSE NULL::integer END AS delta_seconds, m.created_at FROM simulation_messages m JOIN simulation_chats sc_1 ON sc_1.id = m.chat_id ), message_deltas_agg AS ( SELECT message_deltas.chat_id, array_remove(array_agg(message_deltas.delta_seconds ORDER BY message_deltas.created_at), NULL::integer) AS message_time_taken_seconds FROM message_deltas GROUP BY message_deltas.chat_id ), effective_profile_department AS ( SELECT pd.profile_id, COALESCE(( SELECT pd1.department_id FROM profile_departments pd1 WHERE pd1.profile_id = pd.profile_id AND pd1.is_primary LIMIT 1), ( SELECT pd2.department_id FROM profile_departments pd2 WHERE pd2.profile_id = pd.profile_id ORDER BY pd2.created_at LIMIT 1)) AS department_id FROM ( SELECT DISTINCT simulation_attempts.profile_id FROM simulation_attempts) pd ) SELECT sc.id AS chat_id, sc.attempt_id, sa.profile_id, sa.simulation_id, rm.root_scenario_id AS scenario_id, rm.leaf_scenario_id, s.persona_id, p.color AS persona_color, sim.practice_simulation AS is_practice, sa.archived AS is_archived, NOT sim.practice_simulation AND NOT sa.archived AS is_general, pr.role AS profile_role, cbs.cohort_ids, sc.created_at AS chat_created_at, sc.completed_at AS chat_completed_at, CASE WHEN lg.score IS NULL OR r.points IS NULL OR r.points = 0 THEN NULL::numeric ELSE lg.score / r.points::numeric * 100.0 END AS grade_percent, CASE WHEN lg.score IS NULL OR r.points IS NULL OR r.pass_points IS NULL THEN NULL::boolean ELSE lg.score >= r.pass_points::numeric END AS passed, lg.time_taken_seconds, lg.rubric_id, r.points AS rubric_points, r.pass_points AS rubric_pass_points, sc.completed OR sc.completed_at IS NOT NULL OR lg.simulation_chat_id IS NOT NULL AS completed, COALESCE(mc.num_messages_total, 0) AS num_messages_total, COALESCE(mc.num_query_messages, 0) AS num_query_messages, COALESCE(mc.num_response_messages, 0) AS num_response_messages, COALESCE(mda.message_time_taken_seconds, '{}'::integer[]) AS message_time_taken_seconds, sa.created_at AS attempt_created_at, pcs.profile_cohort_ids, (( SELECT count(*) AS count FROM simulation_scenarios ss WHERE ss.simulation_id = sim.id))::integer AS sim_scenario_count, lg.created_at AS grade_created_at, COALESCE(epd.department_id, sim.department_id, r.department_id, s.department_id, p.department_id) AS department_id FROM simulation_chats sc JOIN simulation_attempts sa ON sa.id = sc.attempt_id JOIN active_sims sim ON sim.id = sa.simulation_id JOIN profiles pr ON pr.id = sa.profile_id JOIN active_scenarios s ON s.id = sc.scenario_id JOIN root_map rm ON rm.leaf_scenario_id = s.id LEFT JOIN personas p ON p.id = s.persona_id LEFT JOIN latest_grade lg ON lg.simulation_chat_id = sc.id LEFT JOIN rubrics r ON r.id = lg.rubric_id LEFT JOIN cohorts_by_sim cbs ON cbs.simulation_id = sa.simulation_id LEFT JOIN profile_cohorts_for_sim pcs ON pcs.attempt_id = sa.id LEFT JOIN message_counts mc ON mc.chat_id = sc.id LEFT JOIN message_deltas_agg mda ON mda.chat_id = sc.id LEFT JOIN effective_profile_department epd ON epd.profile_id = sa.profile_id);