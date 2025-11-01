-- Create attempt_chats junction table
CREATE TABLE attempt_chats (
  attempt_id UUID NOT NULL REFERENCES simulation_attempts(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES simulation_chats(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (attempt_id, chat_id)
);

-- Create indexes for performance
CREATE INDEX ON attempt_chats (attempt_id);
CREATE INDEX ON attempt_chats (chat_id);
CREATE INDEX ON attempt_chats (attempt_id, chat_id);

-- Backfill existing data from simulation_chats.attempt_id
INSERT INTO attempt_chats (attempt_id, chat_id, created_at, updated_at)
SELECT attempt_id, id, created_at, updated_at
FROM simulation_chats;

-- Drop foreign key constraint before removing column
ALTER TABLE "simulation_chats" DROP CONSTRAINT IF EXISTS "simulation_chats_attempt_id_fkey";

-- Remove attempt_id column from simulation_chats
ALTER TABLE "simulation_chats" DROP COLUMN "attempt_id";

-- Add copy_paste_allowed column to scenarios table
ALTER TABLE "scenarios" ADD COLUMN "copy_paste_allowed" BOOLEAN NOT NULL DEFAULT FALSE;

-- Drop and recreate analytics materialized view to use junction table
DROP MATERIALIZED VIEW IF EXISTS "public"."analytics";

CREATE MATERIALIZED VIEW "public"."analytics" AS (
WITH RECURSIVE scenario_roots AS (
  SELECT s.id, st.parent_id, s.id AS root_id
  FROM scenarios s
  JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id = s.id
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
  SELECT DISTINCT ON (simulation_chat_id)
         simulation_chat_id,
         score::numeric AS score,
         time_taken::numeric AS time_taken_seconds,
         rubric_id,
         created_at
  FROM simulation_chat_grades
  ORDER BY simulation_chat_id, created_at DESC
),
active_sims AS (
  SELECT * FROM simulations WHERE active = TRUE
),
active_scenarios AS (
  SELECT * FROM scenarios WHERE active = TRUE
),
cohorts_expanded AS (
  SELECT c.id, c.active FROM cohorts c
),
cohorts_by_sim AS (
  SELECT s.id AS simulation_id,
         ARRAY(SELECT DISTINCT c.id FROM cohorts c
               JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = s.id
               WHERE c.active = TRUE) AS cohort_ids
  FROM active_sims s
),
profile_cohorts_for_sim AS (
  SELECT sa.id AS attempt_id, ap.profile_id, sa.simulation_id,
         ARRAY(
           SELECT c.id
           FROM cohorts c
           JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = sa.simulation_id
           JOIN cohort_profiles cp ON cp.cohort_id = c.id AND cp.profile_id = ap.profile_id
           WHERE c.active = TRUE
         ) AS profile_cohort_ids
  FROM simulation_attempts sa
  LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = TRUE
),
message_counts AS (
  SELECT
    sm.chat_id,
    COUNT(*)::int                                AS num_messages_total,
    COUNT(*) FILTER (WHERE sm.type = 'query')::int    AS num_query_messages,
    COUNT(*) FILTER (WHERE sm.type = 'response')::int AS num_response_messages
  FROM simulation_messages sm
  GROUP BY sm.chat_id
),
message_deltas AS (
  SELECT
    m.chat_id,
    CASE
      WHEN lag(m.type) OVER (PARTITION BY m.chat_id ORDER BY m.created_at) = 'response'
       AND m.type = 'query'
      THEN GREATEST(
             EXTRACT(epoch FROM m.created_at - COALESCE(lag(COALESCE(m.updated_at, m.created_at))
               OVER (PARTITION BY m.chat_id ORDER BY m.created_at), sc_1.created_at))::int, 0)
      ELSE NULL
    END AS delta_seconds,
    m.created_at
  FROM simulation_messages m
  JOIN simulation_chats sc_1 ON sc_1.id = m.chat_id
),
message_deltas_agg AS (
  SELECT chat_id,
         ARRAY_REMOVE(array_agg(delta_seconds ORDER BY created_at), NULL) AS message_time_taken_seconds
  FROM message_deltas
  GROUP BY chat_id
),
effective_profile_department AS (
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
  FROM (SELECT DISTINCT ap.profile_id FROM simulation_attempts sa
        JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = TRUE) pd
),
simulation_first_dept AS (
    SELECT DISTINCT ON (simulation_id) 
        simulation_id, 
        department_id
    FROM simulation_departments
    WHERE active = true
    ORDER BY simulation_id, created_at
),
rubric_first_dept AS (
    SELECT DISTINCT ON (rubric_id) 
        rubric_id, 
        department_id
    FROM rubric_departments
    WHERE active = true
    ORDER BY rubric_id, created_at
),
scenario_first_dept AS (
    SELECT DISTINCT ON (scenario_id) 
        scenario_id, 
        department_id
    FROM scenario_departments
    WHERE active = true
    ORDER BY scenario_id, created_at
),
persona_first_dept AS (
    SELECT DISTINCT ON (persona_id) 
        persona_id, 
        department_id
    FROM persona_departments
    WHERE active = true
    ORDER BY persona_id, created_at
)
SELECT
  sc.id                         AS chat_id,
  ac.attempt_id                 AS attempt_id,
  ap.profile_id                 AS profile_id,
  sa.simulation_id              AS simulation_id,
  rm.root_scenario_id           AS scenario_id,
  rm.leaf_scenario_id           AS leaf_scenario_id,
  sp.persona_id                 AS persona_id,
  p.color                       AS persona_color,
  sim.practice_simulation       AS is_practice,
  sa.archived                   AS is_archived,
  (NOT sim.practice_simulation AND NOT sa.archived) AS is_general,
  pr.role                       AS profile_role,
  cbs.cohort_ids                AS cohort_ids,
  sc.created_at                 AS chat_created_at,
  CASE
    WHEN lg.score IS NULL OR r.points IS NULL OR r.points = 0 THEN NULL
    ELSE (lg.score / r.points::numeric) * 100.0
  END                           AS grade_percent,
  CASE
    WHEN lg.score IS NULL OR r.points IS NULL OR r.pass_points IS NULL THEN NULL
    ELSE (lg.score >= r.pass_points::numeric)
  END                           AS passed,
  lg.time_taken_seconds         AS time_taken_seconds,
  lg.rubric_id                  AS rubric_id,
  r.points                      AS rubric_points,
  r.pass_points                 AS rubric_pass_points,
  (sc.completed OR lg.simulation_chat_id IS NOT NULL)
                               AS completed,
  COALESCE(mc.num_messages_total, 0)            AS num_messages_total,
  COALESCE(mc.num_query_messages, 0)            AS num_query_messages,
  COALESCE(mc.num_response_messages, 0)         AS num_response_messages,
  COALESCE(mda.message_time_taken_seconds, '{}') AS message_time_taken_seconds,
  sa.created_at                 AS attempt_created_at,
  pcs.profile_cohort_ids        AS profile_cohort_ids,
  (SELECT COUNT(*) FROM simulation_scenarios ss WHERE ss.simulation_id = sim.id)::int AS sim_scenario_count,
  lg.created_at                 AS grade_created_at,
  COALESCE(
    epd.department_id,
    sfd.department_id,
    rfd.department_id,
    scfd.department_id,
    pfd.department_id
  ) AS department_id
FROM simulation_chats sc
JOIN attempt_chats ac ON ac.chat_id = sc.id
JOIN simulation_attempts sa ON sa.id = ac.attempt_id
LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = TRUE
JOIN active_sims sim ON sim.id = sa.simulation_id
JOIN profiles pr ON pr.id = ap.profile_id
JOIN active_scenarios s ON s.id = sc.scenario_id
JOIN root_map rm ON rm.leaf_scenario_id = s.id
LEFT JOIN scenario_personas sp ON sp.scenario_id = s.id AND sp.active = TRUE
LEFT JOIN personas p ON p.id = sp.persona_id
LEFT JOIN latest_grade lg ON lg.simulation_chat_id = sc.id
LEFT JOIN rubrics r ON r.id = lg.rubric_id
LEFT JOIN cohorts_by_sim cbs ON cbs.simulation_id = sa.simulation_id
LEFT JOIN profile_cohorts_for_sim pcs ON pcs.attempt_id = sa.id
LEFT JOIN message_counts mc ON mc.chat_id = sc.id
LEFT JOIN message_deltas_agg mda ON mda.chat_id = sc.id
LEFT JOIN effective_profile_department epd ON epd.profile_id = ap.profile_id
LEFT JOIN simulation_first_dept sfd ON sfd.simulation_id = sim.id
LEFT JOIN rubric_first_dept rfd ON rfd.rubric_id = r.id
LEFT JOIN scenario_first_dept scfd ON scfd.scenario_id = s.id
LEFT JOIN persona_first_dept pfd ON pfd.persona_id = p.id
) WITH NO DATA;

-- Create unique index for CONCURRENT refresh
CREATE UNIQUE INDEX IF NOT EXISTS analytics_pk ON analytics (chat_id);

-- Recreate all analytics indexes
CREATE INDEX IF NOT EXISTS analytics_simulation_id_idx ON analytics (simulation_id);
CREATE INDEX IF NOT EXISTS analytics_profile_id_idx ON analytics (profile_id);
CREATE INDEX IF NOT EXISTS analytics_scenario_id_idx ON analytics (scenario_id);
CREATE INDEX IF NOT EXISTS analytics_leaf_scenario_id_idx ON analytics (leaf_scenario_id);
CREATE INDEX IF NOT EXISTS analytics_chat_created_at_idx ON analytics (chat_created_at);
CREATE INDEX IF NOT EXISTS analytics_is_practice_idx ON analytics (is_practice);
CREATE INDEX IF NOT EXISTS analytics_is_archived_idx ON analytics (is_archived);
CREATE INDEX IF NOT EXISTS analytics_is_general_idx ON analytics (is_general);
CREATE INDEX IF NOT EXISTS analytics_profile_role_idx ON analytics (profile_role);
CREATE INDEX IF NOT EXISTS analytics_cohort_ids_gin ON analytics USING GIN (cohort_ids);
CREATE INDEX IF NOT EXISTS analytics_passed_idx ON analytics (passed);
CREATE INDEX IF NOT EXISTS analytics_time_taken_idx ON analytics (time_taken_seconds);
CREATE INDEX IF NOT EXISTS analytics_profile_cohort_ids_gin ON analytics USING GIN (profile_cohort_ids);
CREATE INDEX IF NOT EXISTS analytics_attempt_created_at_idx ON analytics (attempt_created_at);
CREATE INDEX IF NOT EXISTS analytics_department_id_idx ON analytics (department_id);

-- Refresh analytics materialized view
REFRESH MATERIALIZED VIEW analytics;

