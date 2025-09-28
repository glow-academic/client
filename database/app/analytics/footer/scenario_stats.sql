-- Scenario Stats (numerical parameters) ----------------------------------------
CREATE OR REPLACE FUNCTION analytics_scenario_stats_fn(
  p_start         timestamptz,
  p_end           timestamptz,
  p_cohort_ids    uuid[],
  p_roles         profile_role[],
  p_sim_filters   text[],
  p_profile_id    uuid,
  p_parameter_id  uuid DEFAULT NULL,      -- optional default numeric parameter
  p_simulation_ids uuid[] DEFAULT NULL
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
    AND (p_simulation_ids IS NULL OR a.simulation_id = ANY (p_simulation_ids))
),
nums AS (
  SELECT id, name, TRUE AS numerical, active
  FROM parameters
  WHERE active = TRUE AND numerical = TRUE
),
-- scenarios have numeric values for those parameters (stored in parameter_items.value)
num_map AS (
  SELECT s.id AS scenario_id, pi.parameter_id, pi.value::numeric AS level
  FROM scenarios s
  JOIN parameter_items pi ON pi.id = ANY(s.parameter_item_ids)
  JOIN nums n ON n.id = pi.parameter_id
  WHERE s.active = TRUE
),
-- per-attempt join with numeric level
attempts AS (
  SELECT
    nm.parameter_id,
    nm.level,
    b.grade_percent::float AS score
  FROM base b
  JOIN num_map nm ON nm.scenario_id = b.scenario_id
  WHERE b.grade_percent IS NOT NULL
),
-- bucket levels to text labels (keep integers as-is; round others)
levels AS (
  SELECT parameter_id,
         CASE
           WHEN level = floor(level) THEN level::int::text
           ELSE to_char(level,'FM999D0')
         END AS metric_level,
         score
  FROM attempts
),
agg AS (
  SELECT parameter_id, metric_level,
         AVG(score)::float AS avg_score,
         COUNT(*)::int     AS attempts
  FROM levels
  GROUP BY parameter_id, metric_level
),
-- scenarios per level (for scenarioCount)
scenarios_per_level AS (
  SELECT nm.parameter_id,
         CASE
           WHEN nm.level = floor(nm.level) THEN nm.level::int::text
           ELSE to_char(nm.level,'FM999D0')
         END AS metric_level,
         COUNT(DISTINCT nm.scenario_id)::int AS scenario_count
  FROM num_map nm
  GROUP BY nm.parameter_id, 2
),
-- default parameter
initial_param AS (
  SELECT COALESCE(p_parameter_id, (SELECT id FROM nums ORDER BY name LIMIT 1)) AS pid
),
chart AS (
  SELECT jsonb_agg(jsonb_build_object(
           'metricLevel', m.metric_level,
           'avgScore',    ROUND(a.avg_score)::int,
           'scenarioCount', COALESCE(s.scenario_count,0),
           'totalAttempts', COALESCE(a.attempts,0),
           'rubricPoints',  0
         ) ORDER BY CASE WHEN m.metric_level ~ '^\d+$' THEN m.metric_level::int ELSE NULL END, m.metric_level)
  FROM initial_param ip
  JOIN (SELECT DISTINCT parameter_id, metric_level FROM agg) m ON m.parameter_id = ip.pid
  LEFT JOIN agg a ON a.parameter_id = ip.pid AND a.metric_level = m.metric_level
  LEFT JOIN scenarios_per_level s ON s.parameter_id = ip.pid AND s.metric_level = m.metric_level
),
-- correlation (Pearson) for default parameter
corr_n AS (
  SELECT COUNT(*)::int AS n, corr(level::float, score) AS r
  FROM (
    SELECT nm.parameter_id, nm.level, b.grade_percent::float AS score
    FROM base b
    JOIN num_map nm ON nm.scenario_id = b.scenario_id
    WHERE b.grade_percent IS NOT NULL
      AND nm.parameter_id = (SELECT pid FROM initial_param)
  ) t
),
pval AS (
  SELECT analytics_p_value_from_r_n(r, n) AS p
  FROM corr_n
),
status AS (
  SELECT CASE
    WHEN (SELECT n FROM corr_n) < 3 THEN 'neutral'
    WHEN ABS((SELECT r FROM corr_n)) >= 0.6 THEN 'success'
    WHEN ABS((SELECT r FROM corr_n)) >= 0.3 THEN 'warning'
    ELSE 'danger'
  END AS st
)
SELECT jsonb_build_object(
  'numericalParameters', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id::text,'name', name, 'numerical', TRUE, 'active', active
      ) ORDER BY name) FROM nums
    ), '[]'::jsonb),
  'performanceData',     COALESCE((SELECT * FROM chart), '[]'::jsonb),
  'correlationData',     jsonb_build_object(
                            'correlation', COALESCE((SELECT r FROM corr_n),0),
                            'pValue',      COALESCE((SELECT p FROM pval), 1.0)
                          ),
  -- FACTS for client recompute:
  'numericAttemptFacts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'parameterId', parameter_id::text,
        'level',       metric_level,
        'score',       ROUND(avg_score)::int,
        'attempts',    attempts
      ))
      FROM (
        SELECT parameter_id, metric_level, AVG(score) AS avg_score, COUNT(*) AS attempts
        FROM levels
        GROUP BY parameter_id, metric_level
      ) f
    ), '[]'::jsonb)
);
$$;
