-- BCNF Migration: Convert array columns to junction tables, rename columns, and restructure schema
-- This migration normalizes the database to BCNF form and implements several architectural improvements

BEGIN;

-- 1) New junction tables (BCNF)
CREATE TABLE simulation_scenarios (
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  scenario_id   UUID NOT NULL REFERENCES scenarios(id)   ON DELETE CASCADE,
  position      INT  NOT NULL DEFAULT 1,
  PRIMARY KEY (simulation_id, scenario_id)
);

CREATE TABLE scenario_objectives (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  idx         INT  NOT NULL,
  objective   TEXT NOT NULL,
  PRIMARY KEY (scenario_id, idx)
);

CREATE TABLE scenario_parameter_items (
  scenario_id      UUID NOT NULL REFERENCES scenarios(id)       ON DELETE CASCADE,
  parameter_item_id UUID NOT NULL REFERENCES parameter_items(id) ON DELETE CASCADE,
  PRIMARY KEY (scenario_id, parameter_item_id)
);

CREATE TABLE scenario_documents (
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (scenario_id, document_id)
);

CREATE TABLE cohort_profiles (
  cohort_id  UUID NOT NULL REFERENCES cohorts(id)    ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  PRIMARY KEY (cohort_id, profile_id)
);

CREATE TABLE cohort_simulations (
  cohort_id    UUID NOT NULL REFERENCES cohorts(id)      ON DELETE CASCADE,
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  PRIMARY KEY (cohort_id, simulation_id)
);

-- 2) Tags now live on simulations (ordered, BCNF)
CREATE TABLE simulation_tags (
  simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  idx           INT  NOT NULL,
  tag           TEXT NOT NULL,
  PRIMARY KEY (simulation_id, idx)
);

-- 3) Scenario hierarchy with no NULLs (self-edge denotes root)
CREATE TABLE scenario_tree (
  parent_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  child_id  UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id, child_id)
);

-- 3b) Profile ↔ Department M:N relationship
CREATE TABLE profile_departments (
  profile_id    UUID NOT NULL REFERENCES profiles(id)    ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, department_id)
);
CREATE INDEX ON profile_departments (department_id);
CREATE INDEX ON profile_departments (profile_id, is_primary);

-- Enforce max one primary department per profile
CREATE UNIQUE INDEX profile_departments_one_primary_per_profile
  ON profile_departments (profile_id)
  WHERE is_primary;

-- Backfill from existing profiles.department_id
INSERT INTO profile_departments (profile_id, department_id, is_primary)
SELECT id, department_id, TRUE
FROM profiles
WHERE department_id IS NOT NULL;

-- 4) New simulation flags (guardrails/image/hints)
ALTER TABLE simulations
  ADD COLUMN output_guardrail_active BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN input_guardrail_active  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN image_input_active      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN hints_enabled           BOOLEAN NOT NULL DEFAULT FALSE;

-- 5) Rename scenarios.description -> problem_statement
ALTER TABLE scenarios RENAME COLUMN description TO problem_statement;

-- 6) Backfill junctions from arrays (keeping order where useful)

-- simulations.scenario_ids[] -> simulation_scenarios
WITH exploded AS (
  SELECT s.id AS simulation_id
       , unnest(s.scenario_ids) WITH ORDINALITY AS (scenario_id, position)
  FROM simulations s
)
INSERT INTO simulation_scenarios (simulation_id, scenario_id, position)
SELECT simulation_id, scenario_id, position
FROM exploded
ON CONFLICT DO NOTHING;

-- scenarios.objectives[] -> scenario_objectives
WITH exploded AS (
  SELECT sc.id AS scenario_id
       , unnest(sc.objectives) WITH ORDINALITY AS (objective, idx)
  FROM scenarios sc
)
INSERT INTO scenario_objectives (scenario_id, idx, objective)
SELECT scenario_id, idx, objective
FROM exploded
WHERE objective IS NOT NULL AND btrim(objective) <> ''
ON CONFLICT DO NOTHING;

-- scenarios.parameter_item_ids[] -> scenario_parameter_items
WITH exploded AS (
  SELECT sc.id AS scenario_id
       , unnest(sc.parameter_item_ids) AS parameter_item_id
  FROM scenarios sc
)
INSERT INTO scenario_parameter_items (scenario_id, parameter_item_id)
SELECT scenario_id, parameter_item_id
FROM exploded
WHERE parameter_item_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- scenarios.document_ids[] -> scenario_documents
WITH exploded AS (
  SELECT sc.id AS scenario_id
       , unnest(sc.document_ids) AS document_id
  FROM scenarios sc
)
INSERT INTO scenario_documents (scenario_id, document_id)
SELECT scenario_id, document_id
FROM exploded
WHERE document_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- cohorts.profile_ids[] -> cohort_profiles
WITH exploded AS (
  SELECT c.id AS cohort_id
       , unnest(c.profile_ids) AS profile_id
  FROM cohorts c
)
INSERT INTO cohort_profiles (cohort_id, profile_id)
SELECT cohort_id, profile_id
FROM exploded
WHERE profile_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- cohorts.simulation_ids[] -> cohort_simulations
WITH exploded AS (
  SELECT c.id AS cohort_id
       , unnest(c.simulation_ids) AS simulation_id
  FROM cohorts c
)
INSERT INTO cohort_simulations (cohort_id, simulation_id)
SELECT cohort_id, simulation_id
FROM exploded
WHERE simulation_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 7) Scenario hierarchy backfill -> scenario_tree
-- Self-edge for roots, direct edges for existing parent links
INSERT INTO scenario_tree (parent_id, child_id)
SELECT COALESCE(parent_id, id) AS parent_id, id AS child_id
FROM scenarios
ON CONFLICT DO NOTHING;

-- 8) Set "output guardrail"/"image input" on simulations based on persona/department defaults (best-effort heuristic)
-- If any scenario in the sim has a persona with guardrail_active, set output_guardrail_active = true
WITH per_sim AS (
  SELECT ss.simulation_id, bool_or(COALESCE(p.guardrail_active,false)) AS any_guard
  FROM simulation_scenarios ss
  JOIN scenarios sc ON sc.id = ss.scenario_id
  LEFT JOIN personas p ON p.id = sc.persona_id
  GROUP BY ss.simulation_id
)
UPDATE simulations s
SET output_guardrail_active = ps.any_guard
FROM per_sim ps
WHERE s.id = ps.simulation_id;

-- If any scenario persona had image_input_active, set simulation.image_input_active = true
WITH per_sim AS (
  SELECT ss.simulation_id, bool_or(COALESCE(p.image_input_active,false)) AS any_img
  FROM simulation_scenarios ss
  JOIN scenarios sc ON sc.id = ss.scenario_id
  LEFT JOIN personas p ON p.id = sc.persona_id
  GROUP BY ss.simulation_id
)
UPDATE simulations s
SET image_input_active = ps.any_img
FROM per_sim ps
WHERE s.id = ps.simulation_id;

-- Note: Guardrail agent selection is now handled via department_agents junction table
-- No per-simulation agent override columns needed

-- 9) Drop / tighten old columns for BCNF & "no nulls"
-- Remove arrays
ALTER TABLE simulations DROP COLUMN scenario_ids;

ALTER TABLE scenarios
  DROP COLUMN objectives,
  DROP COLUMN parameter_item_ids,
  DROP COLUMN document_ids,
  DROP COLUMN parent_id,          -- now modeled via scenario_tree
  DROP COLUMN practice_scenario;  -- lives only on simulations

ALTER TABLE cohorts
  DROP COLUMN profile_ids,
  DROP COLUMN simulation_ids;

-- Hard cut-over: Drop the old denormalized profile.department_id column
ALTER TABLE profiles DROP COLUMN department_id;

-- Hard cut-over: Drop legacy tag arrays (now managed via simulation_tag_* junctions)
ALTER TABLE documents DROP COLUMN IF EXISTS tags;
ALTER TABLE parameter_items DROP COLUMN IF EXISTS tags;

-- 10) Remove both crowdsourcing tables
DROP TABLE IF EXISTS simulation_chat_crowdsourced_feedbacks;
DROP TABLE IF EXISTS simulation_crowdsourced_messages;

-- 11) Create indexes for performance
CREATE INDEX ON simulation_scenarios (simulation_id);
CREATE INDEX ON simulation_scenarios (scenario_id);
CREATE INDEX ON scenario_tree (child_id);
CREATE INDEX ON scenario_objectives (scenario_id);
CREATE INDEX ON scenario_parameter_items (scenario_id);
CREATE INDEX ON scenario_parameter_items (parameter_item_id);
CREATE INDEX ON scenario_documents (scenario_id);
CREATE INDEX ON scenario_documents (document_id);
CREATE INDEX ON cohort_profiles (profile_id);
CREATE INDEX ON cohort_profiles (cohort_id);
CREATE INDEX ON cohort_simulations (simulation_id);
CREATE INDEX ON cohort_simulations (cohort_id);
CREATE INDEX ON simulation_tags (simulation_id);
CREATE INDEX ON scenario_tree (parent_id);

-- Integrity constraints for hard BCNF enforcement
-- Enforce single parent per scenario (tree structure, not DAG)
CREATE UNIQUE INDEX scenario_tree_one_parent_per_child ON scenario_tree(child_id);

-- Enforce unique ordering within each simulation
CREATE UNIQUE INDEX simulation_scenarios_position_uniq
  ON simulation_scenarios(simulation_id, position);

-- Prevent duplicate tag text within a simulation (case-insensitive)
CREATE UNIQUE INDEX simulation_tags_unique_text_per_sim
  ON simulation_tags (simulation_id, lower(tag));

-- Fast lookups by tag text within a simulation
CREATE INDEX simulation_tags_text_idx
  ON simulation_tags (simulation_id, lower(tag));

-- 12) Update analytics materialized view
DROP MATERIALIZED VIEW IF EXISTS analytics;

CREATE MATERIALIZED VIEW analytics AS
WITH RECURSIVE scenario_roots AS (
  SELECT s.id, st.parent_id, s.id AS root_id
  FROM scenarios s
  JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id = s.id -- self-edge = root
  UNION ALL
  SELECT s1.id, st.parent_id, sr.root_id
  FROM scenarios s1
  JOIN scenario_tree st ON st.child_id = s1.id AND st.parent_id <> s1.id
  JOIN scenario_roots sr ON st.parent_id = sr.id
),
root_map AS (
  SELECT s.id AS leaf_scenario_id,
         COALESCE(sr.root_id, s.id) AS root_scenario_id
  FROM scenarios s
  LEFT JOIN scenario_roots sr ON s.id = sr.id
),
latest_grade AS (
  SELECT DISTINCT ON (scg.simulation_chat_id)
         scg.simulation_chat_id, scg.score::numeric AS score,
         scg.time_taken::numeric AS time_taken_seconds,
         scg.rubric_id, scg.created_at
  FROM simulation_chat_grades scg
  ORDER BY scg.simulation_chat_id, scg.created_at DESC
),
active_sims AS (
  SELECT id, created_at, updated_at, title, description, time_limit,
         active, rubric_id, default_simulation, practice_simulation, department_id
  FROM simulations WHERE active = TRUE
),
active_scenarios AS (
  SELECT id, created_at, updated_at, name, problem_statement, persona_id,
         default_scenario, generated, active, department_id
  FROM scenarios WHERE active = TRUE
),
cohorts_expanded AS (SELECT c.id, c.active FROM cohorts c),
cohorts_by_sim AS (
  SELECT s.id AS simulation_id,
         ARRAY(SELECT DISTINCT c.id FROM cohorts c
               JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = s.id
               WHERE c.active = TRUE) AS cohort_ids
  FROM active_sims s
),
profile_cohorts_for_sim AS (
  SELECT sa.id AS attempt_id, sa.profile_id, sa.simulation_id,
         ARRAY(
           SELECT c.id
           FROM cohorts c
           JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = sa.simulation_id
           JOIN cohort_profiles cp ON cp.cohort_id = c.id AND cp.profile_id = sa.profile_id
           WHERE c.active = TRUE
         ) AS profile_cohort_ids
  FROM simulation_attempts sa
),
message_counts AS (
  SELECT sm.chat_id,
         count(*)::int AS num_messages_total,
         count(*) FILTER (WHERE sm.type = 'query')::int AS num_query_messages,
         count(*) FILTER (WHERE sm.type = 'response')::int AS num_response_messages
  FROM simulation_messages sm
  GROUP BY sm.chat_id
),
message_deltas AS (
  SELECT m.chat_id,
         CASE WHEN lag(m.type) OVER (PARTITION BY m.chat_id ORDER BY m.created_at) = 'response'
                   AND m.type = 'query'
              THEN GREATEST(EXTRACT(epoch FROM m.created_at -
                     COALESCE(lag(COALESCE(m.updated_at, m.created_at))
                              OVER (PARTITION BY m.chat_id ORDER BY m.created_at),
                              sc.created_at)))::int
              ELSE NULL::int
         END AS delta_seconds,
         m.created_at
  FROM simulation_messages m
  JOIN simulation_chats sc ON sc.id = m.chat_id
),
message_deltas_agg AS (
  SELECT chat_id,
         array_remove(array_agg(delta_seconds ORDER BY created_at), NULL) AS message_time_taken_seconds
  FROM message_deltas GROUP BY chat_id
),
effective_profile_department AS (
  -- Choose the primary department if set; otherwise earliest assignment
  SELECT pd.profile_id,
         COALESCE(
           (SELECT pd1.department_id
              FROM profile_departments pd1
             WHERE pd1.profile_id = pd.profile_id AND pd1.is_primary
             LIMIT 1),
           (SELECT pd2.department_id
              FROM profile_departments pd2
             WHERE pd2.profile_id = pd.profile_id
             ORDER BY pd2.created_at ASC
             LIMIT 1)
         ) AS department_id
  FROM (SELECT DISTINCT profile_id FROM simulation_attempts) pd
)
SELECT
  sc.id AS chat_id,
  sc.attempt_id,
  sa.profile_id,
  sa.simulation_id,
  rm.root_scenario_id AS scenario_id,
  rm.leaf_scenario_id,
  s.persona_id,
  p.color AS persona_color,
  sim.practice_simulation AS is_practice,
  sa.archived AS is_archived,
  NOT sim.practice_simulation AND NOT sa.archived AS is_general,
  pr.role AS profile_role,
  cbs.cohort_ids,
  sc.created_at  AS chat_created_at,
  sc.completed_at AS chat_completed_at,
  CASE WHEN lg.score IS NULL OR r.points IS NULL OR r.points = 0
       THEN NULL::numeric
       ELSE lg.score / r.points::numeric * 100.0 END AS grade_percent,
  CASE WHEN lg.score IS NULL OR r.points IS NULL OR r.pass_points IS NULL
       THEN NULL::boolean
       ELSE lg.score >= r.pass_points::numeric END AS passed,
  lg.time_taken_seconds,
  lg.rubric_id,
  r.points AS rubric_points,
  r.pass_points AS rubric_pass_points,
  (sc.completed OR sc.completed_at IS NOT NULL OR lg.simulation_chat_id IS NOT NULL) AS completed,
  COALESCE(mc.num_messages_total, 0)  AS num_messages_total,
  COALESCE(mc.num_query_messages, 0)  AS num_query_messages,
  COALESCE(mc.num_response_messages,0) AS num_response_messages,
  COALESCE(mda.message_time_taken_seconds, '{}'::int[]) AS message_time_taken_seconds,
  sa.created_at AS attempt_created_at,
  pcs.profile_cohort_ids,
  (SELECT COUNT(*) FROM simulation_scenarios ss WHERE ss.simulation_id = sim.id)::int AS sim_scenario_count,
  lg.created_at AS grade_created_at,
  COALESCE(epd.department_id, sim.department_id, r.department_id, s.department_id, p.department_id) AS department_id
FROM simulation_chats sc
JOIN simulation_attempts sa ON sa.id = sc.attempt_id
JOIN active_sims sim ON sim.id = sa.simulation_id
JOIN profiles pr ON pr.id = sa.profile_id
JOIN active_scenarios s ON s.id = sc.scenario_id
JOIN root_map rm ON rm.leaf_scenario_id = s.id
LEFT JOIN personas p ON p.id = s.persona_id
LEFT JOIN latest_grade lg ON lg.simulation_chat_id = sc.id
LEFT JOIN rubrics r ON r.id = lg.rubric_id
LEFT JOIN cohorts_by_sim cbs ON cbs.simulation_id = sa.simulation_id
LEFT JOIN profile_cohorts_for_sim pcs ON pcs.attempt_id = sa.id
LEFT JOIN message_counts mc ON mc.chat_id = sc.id
LEFT JOIN message_deltas_agg mda ON mda.chat_id = sc.id
LEFT JOIN effective_profile_department epd ON epd.profile_id = sa.profile_id;

-- 13) Link documents & parameter items to *simulation tags*
-- We keep your existing simulation_tags (simulation_id, idx, tag) as the PK
-- and reference it via a composite FK (minimal change; no new surrogate IDs).

CREATE TABLE simulation_tag_documents (
  simulation_id UUID NOT NULL,
  tag_idx       INT  NOT NULL,
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (simulation_id, tag_idx, document_id),
  CONSTRAINT simulation_tag_documents_tag_fk
    FOREIGN KEY (simulation_id, tag_idx)
    REFERENCES simulation_tags(simulation_id, idx)
    ON DELETE CASCADE
);

CREATE TABLE simulation_tag_parameter_items (
  simulation_id     UUID NOT NULL,
  tag_idx           INT  NOT NULL,
  parameter_item_id UUID NOT NULL REFERENCES parameter_items(id) ON DELETE CASCADE,
  PRIMARY KEY (simulation_id, tag_idx, parameter_item_id),
  CONSTRAINT simulation_tag_parameter_items_tag_fk
    FOREIGN KEY (simulation_id, tag_idx)
    REFERENCES simulation_tags(simulation_id, idx)
    ON DELETE CASCADE
);

-- Helpful indexes
CREATE INDEX ON simulation_tag_documents (document_id);
CREATE INDEX ON simulation_tag_parameter_items (parameter_item_id);
CREATE INDEX ON simulation_tag_documents (simulation_id, tag_idx);
CREATE INDEX ON simulation_tag_parameter_items (simulation_id, tag_idx);

-- Optional, LOW-RISK seed (only if you want a default association):
-- Attach existing scenario-level docs/params to the *first* tag of each simulation (idx=1),
-- but only when that first tag exists. Comment out if you prefer manual tagging.

WITH first_tag AS (
  SELECT st.simulation_id, st.idx
  FROM simulation_tags st
  WHERE st.idx = 1
),
sim_docs AS (
  SELECT ss.simulation_id, sd.document_id
  FROM simulation_scenarios ss
  JOIN scenario_documents sd ON sd.scenario_id = ss.scenario_id
  GROUP BY ss.simulation_id, sd.document_id
),
sim_params AS (
  SELECT ss.simulation_id, spi.parameter_item_id
  FROM simulation_scenarios ss
  JOIN scenario_parameter_items spi ON spi.scenario_id = ss.scenario_id
  GROUP BY ss.simulation_id, spi.parameter_item_id
)
INSERT INTO simulation_tag_documents (simulation_id, tag_idx, document_id)
SELECT d.simulation_id, ft.idx, d.document_id
FROM sim_docs d
JOIN first_tag ft ON ft.simulation_id = d.simulation_id
ON CONFLICT DO NOTHING;

INSERT INTO simulation_tag_parameter_items (simulation_id, tag_idx, parameter_item_id)
SELECT p.simulation_id, ft.idx, p.parameter_item_id
FROM sim_params p
JOIN first_tag ft ON ft.simulation_id = p.simulation_id
ON CONFLICT DO NOTHING;

-- 14) Department agents → BCNF pivot
-- Minimal: create the new table, backfill from existing columns, then drop the old columns.

CREATE TABLE department_agents (
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  role          TEXT NOT NULL,
  agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  PRIMARY KEY (department_id, role)
);
CREATE INDEX ON department_agents (agent_id);
-- If you want to enforce a controlled vocabulary:
-- ALTER TABLE department_agents ADD CONSTRAINT department_agents_role_chk
-- CHECK (role IN ('title','scenario','classify','assistant','grade','input_guardrail','output_guardrail','hint'));

-- Backfill from denormalized columns on departments
INSERT INTO department_agents (department_id, role, agent_id)
SELECT id, 'title',           title_agent_id        FROM departments
UNION ALL SELECT id, 'scenario',        scenario_agent_id      FROM departments
UNION ALL SELECT id, 'classify',        classify_agent_id      FROM departments
UNION ALL SELECT id, 'assistant',       assistant_agent_id     FROM departments
UNION ALL SELECT id, 'grade',           grade_agent_id         FROM departments
UNION ALL SELECT id, 'input_guardrail', input_guardrail_agent_id FROM departments
UNION ALL SELECT id, 'output_guardrail',output_guardrail_agent_id FROM departments
UNION ALL SELECT id, 'hint',            hint_agent_id          FROM departments;

-- Drop the old agent columns (schema is now BCNF and future-proof)
ALTER TABLE departments
  DROP COLUMN title_agent_id,
  DROP COLUMN scenario_agent_id,
  DROP COLUMN classify_agent_id,
  DROP COLUMN assistant_agent_id,
  DROP COLUMN grade_agent_id,
  DROP COLUMN input_guardrail_agent_id,
  DROP COLUMN output_guardrail_agent_id,
  DROP COLUMN hint_agent_id;

-- 15) Optional: Convenience views for cross-simulation tag discovery
CREATE OR REPLACE VIEW v_tagged_documents AS
SELECT st.simulation_id, st.tag, std.document_id, d.name AS document_name
FROM simulation_tags st
JOIN simulation_tag_documents std
  ON std.simulation_id = st.simulation_id AND std.tag_idx = st.idx
JOIN documents d ON d.id = std.document_id;

CREATE OR REPLACE VIEW v_tagged_parameter_items AS
SELECT st.simulation_id, st.tag, stpi.parameter_item_id, pi.name AS parameter_item_name
FROM simulation_tags st
JOIN simulation_tag_parameter_items stpi
  ON stpi.simulation_id = st.simulation_id AND stpi.tag_idx = st.idx
JOIN parameter_items pi ON pi.id = stpi.parameter_item_id;

COMMIT;

