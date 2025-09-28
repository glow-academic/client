-- Simulation Composition -------------------------------------------------------
CREATE OR REPLACE FUNCTION analytics_simulation_composition_fn(
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
-- summary per simulation
sim_summary AS (
  SELECT
    b.simulation_id,
    AVG(b.grade_percent)::float AS avg_score,
    (100.0*AVG((b.passed)::int))::float AS completion_rate,
    COUNT(*)::int AS attempts
  FROM base b
  WHERE b.grade_percent IS NOT NULL
  GROUP BY b.simulation_id
),
-- scenario counts per simulation
sim_scenarios AS (
  SELECT s.id AS simulation_id, array_length(s.scenario_ids, 1) AS scenario_count
  FROM simulations s
  WHERE s.active = TRUE
),
-- parameter breakdown per simulation (categorical)
sim_param_items AS (
  SELECT s.id AS simulation_id, p.name AS parameter_name, pi.name AS parameter_value,
         FALSE AS is_numerical, COUNT(DISTINCT sc.id)::int AS cnt
  FROM simulations s
  JOIN scenarios sc ON sc.id = ANY(s.scenario_ids)
  JOIN parameter_items pi ON pi.id = ANY(sc.parameter_item_ids)
  JOIN parameters p ON p.id = pi.parameter_id AND p.numerical = FALSE
  WHERE s.active = TRUE AND sc.active = TRUE
  GROUP BY s.id, p.name, pi.name
),
-- numerical summaries per simulation (avg value across scenarios)
sim_param_nums AS (
  SELECT s.id AS simulation_id, p.name AS parameter_name,
         to_char(AVG(pi.value::numeric),'FM999D0') AS parameter_value,
         TRUE AS is_numerical, COUNT(DISTINCT sc.id)::int AS cnt
  FROM simulations s
  JOIN scenarios sc ON sc.id = ANY(s.scenario_ids)
  JOIN parameter_items pi ON pi.id = ANY(sc.parameter_item_ids)
  JOIN parameters p ON p.id = pi.parameter_id AND p.numerical = TRUE
  WHERE s.active = TRUE AND sc.active = TRUE
  GROUP BY s.id, p.name
),
sim_params AS (
  SELECT * FROM sim_param_items
  UNION ALL
  SELECT * FROM sim_param_nums
),
-- base response bits
sims AS (
  SELECT s.id::text AS id, s.title
  FROM simulations s
  WHERE s.active = TRUE
),
preconfig AS (
  SELECT 'percentile'::text AS method, 25::int AS top_pct, 25::int AS bottom_pct
),
status AS (
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM sim_summary) = 0 THEN 'neutral'
    WHEN (SELECT AVG(avg_score) FROM sim_summary) >= 80 THEN 'success'
    WHEN (SELECT AVG(avg_score) FROM sim_summary) >= 60 THEN 'warning'
    ELSE 'danger'
  END AS st
)
SELECT jsonb_build_object(
  'config', jsonb_build_object('method','percentile','topPercentage',25,'bottomPercentage',25),
  'highPerforming', '[]'::jsonb,  -- client builds from facts and config
  'lowPerforming',  '[]'::jsonb,
  'highPerformingCount', 0,
  'lowPerformingCount',  0,
  'highPerformingDetails', '[]'::jsonb,
  'lowPerformingDetails',  '[]'::jsonb,
  -- FACTS for client recompute:
  'simulationFacts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'simulationId', s.id::text,
        'title',        s.title,
        'avgScore',     ROUND(ss.avg_score)::int,
        'completionRate', ROUND(ss.completion_rate)::int,
        'totalAttempts', COALESCE(ss.attempts,0),
        'scenarioCount', COALESCE(sc.scenario_count,0)
      ) ORDER BY s.title)
      FROM sims s
      LEFT JOIN sim_summary ss ON ss.simulation_id = s.id::uuid
      LEFT JOIN sim_scenarios sc ON sc.simulation_id = s.id::uuid
    ), '[]'::jsonb),
  'simulationParameterFacts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'simulationId', simulation_id::text,
        'parameterName', parameter_name,
        'parameterValue', parameter_value,
        'isNumerical', is_numerical,
        'count', cnt
      ))
      FROM sim_params
    ), '[]'::jsonb),
  'performanceStatus', (SELECT st FROM status),
  'hasData', EXISTS (SELECT 1 FROM sim_summary)
);
$$;
