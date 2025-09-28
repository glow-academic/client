-- Simulation → Scenario Performance ------------------------------------------
CREATE OR REPLACE FUNCTION analytics_simulation_performance_fn(
  p_start         timestamptz,
  p_end           timestamptz,
  p_cohort_ids    uuid[],
  p_roles         profile_role[],
  p_sim_filters   text[],
  p_profile_id    uuid
) RETURNS jsonb
LANGUAGE sql STABLE AS $$
WITH base AS (
  SELECT *
  FROM analytics a
  WHERE a.chat_created_at >= p_start
    AND a.chat_created_at <  p_end
    AND (p_cohort_ids  IS NULL OR a.cohort_ids && p_cohort_ids)
    AND (p_roles       IS NULL OR a.profile_role = ANY (p_roles))
    AND (p_sim_filters IS NULL OR (
          ('general'  = ANY (p_sim_filters) AND a.is_general) OR
          ('practice' = ANY (p_sim_filters) AND a.is_practice) OR
          ('archived' = ANY (p_sim_filters) AND a.is_archived)
        ))
    AND (p_profile_id IS NULL OR a.profile_id = p_profile_id)
),
valid_sims AS (
  SELECT s.id::text AS id, s.title,
         s.scenario_ids AS scenario_ids
  FROM simulations s
  WHERE s.active = TRUE
),
scenario_perf AS (
  SELECT
    b.simulation_id::text AS simulation_id,
    b.scenario_id::text   AS scenario_id,
    MIN(sc.name)         AS scenario_name,
    AVG(b.grade_percent)::float AS avg_score,
    (100.0*AVG((b.passed)::int))::float AS success_rate,
    COUNT(*)::int AS attempts,
    SUM((b.passed)::int)::int AS completed
  FROM base b
  JOIN scenarios sc ON sc.id = b.scenario_id
  WHERE b.grade_percent IS NOT NULL
  GROUP BY b.simulation_id, b.scenario_id
)
SELECT jsonb_build_object(
  'validSimulations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'title', title, 'scenarioIds', scenario_ids
      ) ORDER BY title) FROM valid_sims
    ), '[]'::jsonb),
  'selectedSimulation', NULL,
  'scenarioPerformanceData', '[]'::jsonb,
  'insights', NULL,
  -- FACTS for instant client-side composition:
  'scenarioFacts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'simulationId', simulation_id,
        'scenarioId', scenario_id,
        'scenarioName', scenario_name,
        'avgScore', ROUND(avg_score)::int,
        'successRate', ROUND(success_rate)::int,
        'totalAttempts', attempts,
        'completedAttempts', completed
      ))
      FROM scenario_perf
    ), '[]'::jsonb)
);
$$;
