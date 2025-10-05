-- Simulation → Scenario Performance (raw)
-- Params: start, end, cohortIds, roles, simulationFilters, profileId
-- Returns:
-- {
--   validSimulationIds: string[],               -- sims present in filtered data
--   scenarioFacts: [{                           -- per-scenario metrics
--     simulationId, scenarioId, scenarioName,
--     avgScore, successRate, totalAttempts, completedAttempts
--   }]
-- }

CREATE OR REPLACE FUNCTION analytics_simulation_performance_fn(
  p_start        timestamptz,
  p_end          timestamptz,
  p_cohort_ids   uuid[],
  p_roles        profile_role[],
  p_sim_filters  text[],
  p_profile_id   uuid
) RETURNS jsonb
LANGUAGE sql STABLE AS $$
/* -------- Params and flags -------- */
WITH params AS (
  SELECT
    COALESCE(p_cohort_ids, '{}')               AS cohort_ids,
    COALESCE(p_roles, '{}')                    AS roles,
    COALESCE(p_sim_filters, ARRAY['general'])  AS sim_filters,
    p_profile_id                               AS profile_id,
    p_start                                    AS start_at,
    p_end                                      AS end_at,
    'general'  = ANY (COALESCE(p_sim_filters, ARRAY['general'])) AS want_general,
    'practice' = ANY (COALESCE(p_sim_filters, ARRAY['general'])) AS want_practice,
    'archived' = ANY (COALESCE(p_sim_filters, ARRAY['general'])) AS want_archived
),
want AS (
  SELECT
    want_general, want_practice, want_archived,
    (want_general OR want_practice) AS want_nonarchived_or_any
  FROM params
),

/* -------- Base selection from analytics (chat date window) -------- */
base_general AS MATERIALIZED (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_general
    AND a.is_general = TRUE
    AND a.chat_created_at >= pr.start_at
    AND a.chat_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
base_practice AS MATERIALIZED (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_practice
    AND a.is_practice = TRUE
    AND a.chat_created_at >= pr.start_at
    AND a.chat_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
base_union AS MATERIALIZED (
  SELECT * FROM base_general
  UNION ALL
  SELECT * FROM base_practice
),

/* -------- Archived tri-state -------- */
base_archived AS MATERIALIZED (
  SELECT bu.*
  FROM base_union bu
  CROSS JOIN want w
  WHERE
    CASE
      WHEN w.want_archived AND w.want_nonarchived_or_any THEN TRUE
      WHEN w.want_archived AND NOT w.want_nonarchived_or_any THEN bu.is_archived = TRUE
      WHEN NOT w.want_archived AND w.want_nonarchived_or_any THEN bu.is_archived = FALSE
      ELSE FALSE
    END
),

/* -------- Cohort scoping (if passed) -------- */
cohort_scoped AS MATERIALIZED (
  SELECT b.*
  FROM base_archived b
  CROSS JOIN params pr
  WHERE cardinality(pr.cohort_ids) = 0
     OR (b.cohort_ids && pr.cohort_ids OR b.profile_cohort_ids && pr.cohort_ids)
),

base AS (
  SELECT * FROM cohort_scoped
),
valid_sims AS (
  SELECT jsonb_agg(DISTINCT b.simulation_id::text ORDER BY b.simulation_id::text) AS payload
  FROM base b
  WHERE b.simulation_id IS NOT NULL
),
scenario_perf AS (
  SELECT
    b.simulation_id::text AS simulation_id,
    b.scenario_id::text   AS scenario_id,
    MIN(sc.name)          AS scenario_name,
    AVG(b.grade_percent)::float                      AS avg_score,
    (100.0 * AVG((b.completed OR b.grade_percent IS NOT NULL)::int))::float AS success_rate,
    COUNT(*)::int                                    AS attempts,
    SUM((b.completed OR b.grade_percent IS NOT NULL)::int)::int AS completed
  FROM base b
  JOIN scenarios sc ON sc.id = b.scenario_id
  GROUP BY b.simulation_id, b.scenario_id
),
facts AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'simulationId',      simulation_id,
             'scenarioId',        scenario_id,
             'scenarioName',      scenario_name,
             'avgScore',          COALESCE(ROUND(avg_score), 0)::int,
             'successRate',       ROUND(success_rate)::int,
             'totalAttempts',     attempts,
             'completedAttempts', completed
           )
         ) AS payload
  FROM scenario_perf
)
SELECT jsonb_build_object(
  'validSimulationIds', COALESCE((SELECT payload FROM valid_sims), '[]'::jsonb),
  'scenarioFacts',      COALESCE((SELECT payload FROM facts), '[]'::jsonb)
);
$$;