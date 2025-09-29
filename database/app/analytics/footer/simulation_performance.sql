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
WITH base AS (
  SELECT *
  FROM analytics a
  WHERE a.chat_created_at > p_start
    AND a.chat_created_at < GREATEST(p_end, now())
    AND (p_cohort_ids IS NULL OR (a.cohort_ids && p_cohort_ids AND a.profile_cohort_ids && p_cohort_ids))
    AND (p_cohort_ids IS NOT NULL OR p_roles IS NULL OR a.profile_role = ANY(p_roles) OR (p_profile_id IS NOT NULL AND a.profile_id = p_profile_id))
    AND (
      p_sim_filters IS NULL
      OR cardinality(p_sim_filters) > 0
    )
    AND (
      p_sim_filters IS NULL OR (
        ('general'  = ANY (p_sim_filters) AND a.is_general)  OR
        ('practice' = ANY (p_sim_filters) AND a.is_practice) OR
        ('archived' = ANY (p_sim_filters) AND a.is_archived)
      )
    )
    AND (p_profile_id IS NULL OR a.profile_id = p_profile_id)
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