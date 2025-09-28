-- Scenario Performance (categorical parameters) --------------------------------
CREATE OR REPLACE FUNCTION analytics_scenario_performance_fn(
  p_start         timestamptz,
  p_end           timestamptz,
  p_cohort_ids    uuid[],
  p_roles         profile_role[],
  p_sim_filters   text[],
  p_profile_id    uuid,
  p_parameter_id  uuid DEFAULT NULL,      -- optional: initial parameter to pre-agg
  p_simulation_ids uuid[] DEFAULT NULL    -- optional coarse sim filter
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
-- parameter catalog (non-numerical only)
params AS (
  SELECT id, name, FALSE AS numerical, active, description
  FROM parameters
  WHERE active = TRUE AND numerical = FALSE
),
-- join non-numerical parameter items to scenarios via parameter_item_ids array
cat_map AS (
  SELECT pi.id   AS parameter_item_id,
         pi.parameter_id,
         pi.name AS item_name,
         COALESCE(pi.description,'')  AS icon,
         COALESCE(pi.value,'#888888') AS color,
         s.id AS scenario_id
  FROM parameter_items pi
  JOIN params p ON p.id = pi.parameter_id
  JOIN scenarios s ON pi.id = ANY(s.parameter_item_ids)
  WHERE s.active = TRUE
),
-- attempt metrics per (parameter_item, day)
attempt_daily AS (
  SELECT
    cm.parameter_id,
    cm.parameter_item_id,
    to_char(date_trunc('day', b.chat_created_at),'MM/DD') AS date,
    AVG(b.grade_percent)::float                           AS avg_score,
    COUNT(*)::int                                         AS attempts,
    SUM((b.passed)::int)::int                             AS passed_attempts
  FROM base b
  JOIN cat_map cm ON cm.scenario_id = b.scenario_id
  WHERE b.grade_percent IS NOT NULL
  GROUP BY cm.parameter_id, cm.parameter_item_id, date_trunc('day', b.chat_created_at)
),
-- scenario coverage per item (to compute % usage)
scenario_coverage AS (
  SELECT parameter_id, parameter_item_id, COUNT(DISTINCT scenario_id)::int AS scenario_count
  FROM cat_map
  GROUP BY parameter_id, parameter_item_id
),
-- denominator: total scenarios per parameter (for % usage)
param_totals AS (
  SELECT parameter_id, COUNT(DISTINCT scenario_id)::int AS total_scenarios
  FROM cat_map
  GROUP BY parameter_id
),
-- pre-agg pie rows for initial parameter (optional)
initial_param AS (
  SELECT COALESCE(p_parameter_id, (SELECT id FROM params ORDER BY name LIMIT 1)) AS pid
),
pie_rows AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'id',          ('param-item-' || sc.parameter_item_id::text),
             'name',        cm.item_name,
             'displayName', cm.item_name,
             'icon',        cm.icon,
             'color',       cm.color,
             'count',       sc.scenario_count,
             'percentage',  CASE WHEN pt.total_scenarios > 0
                                 THEN ROUND(100.0 * sc.scenario_count / pt.total_scenarios, 1)
                                 ELSE 0 END,
             'avgScore',    COALESCE(ROUND((
                                SELECT AVG(ad.avg_score)
                                FROM attempt_daily ad
                                WHERE ad.parameter_item_id = sc.parameter_item_id
                              )),0)::int,
             'completionRate', COALESCE(ROUND((
                                SELECT 100.0 * SUM(ad.passed_attempts) / NULLIF(SUM(ad.attempts),0)
                                FROM attempt_daily ad
                                WHERE ad.parameter_item_id = sc.parameter_item_id
                              )),0)::int,
             'totalAttempts', COALESCE((
                                SELECT SUM(ad.attempts)::int
                                FROM attempt_daily ad
                                WHERE ad.parameter_item_id = sc.parameter_item_id
                              ),0),
             'trendData',  COALESCE((
                                SELECT jsonb_agg(jsonb_build_object(
                                         'date', ad.date,
                                         'score', ROUND(ad.avg_score)::int,
                                         'timestamp', EXTRACT(EPOCH FROM to_date(ad.date,'MM/DD'))::bigint
                                       ) ORDER BY to_date(ad.date,'MM/DD'))
                                FROM attempt_daily ad
                                WHERE ad.parameter_item_id = sc.parameter_item_id
                              ), '[]'::jsonb),
             'insight',     ''
           )
           ORDER BY cm.item_name
         ) AS payload
  FROM initial_param ip
  JOIN scenario_coverage sc ON sc.parameter_id = ip.pid
  JOIN param_totals pt ON pt.parameter_id = ip.pid
  JOIN (
    SELECT DISTINCT parameter_item_id, item_name, icon, color
    FROM cat_map
  ) cm ON cm.parameter_item_id = sc.parameter_item_id
),
-- NEW CTE that produces exactly one row for attributeScenarioFacts
attribute_scenario_facts AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'parameterId',      parameter_id::text,
             'parameterItemId',  parameter_item_id::text,
             'scenarioId',       scenario_id::text
           )
         ) AS payload
  FROM (
    SELECT DISTINCT parameter_id, parameter_item_id, scenario_id
    FROM cat_map
  ) d
),
status AS (
  SELECT
    CASE
      WHEN (SELECT COUNT(*) FROM attempt_daily) = 0 THEN 'neutral'
      WHEN (SELECT AVG(avg_score) FROM attempt_daily) >= 80 THEN 'success'
      WHEN (SELECT AVG(avg_score) FROM attempt_daily) >= 60 THEN 'warning'
      ELSE 'danger'
    END AS perf_status
)
SELECT jsonb_build_object(
  'attributeElements',      COALESCE((SELECT payload FROM pie_rows), '[]'::jsonb),
  'availableParameters',    COALESCE((
                                  SELECT jsonb_agg(jsonb_build_object(
                                    'id', id::text,
                                    'name', name,
                                    'description', COALESCE(description, 'Performance by '||LOWER(name)||' value'),
                                    'numerical', FALSE,
                                    'active', active
                                  ) ORDER BY name)
                                  FROM params
                                ), '[]'::jsonb),
  'performanceStatus',      (SELECT perf_status FROM status),
  'hasData',                EXISTS (SELECT 1 FROM attempt_daily),
  -- FACTS for instant client filtering:
  'attributeAttemptFacts',  COALESCE((
                                  SELECT jsonb_agg(jsonb_build_object(
                                    'parameterId', parameter_id::text,
                                    'parameterItemId', parameter_item_id::text,
                                    'date', date,
                                    'avgScore', ROUND(avg_score)::int,
                                    'attempts', attempts,
                                    'passedAttempts', passed_attempts
                                  ))
                                  FROM attempt_daily
                                ), '[]'::jsonb),
  'attributeScenarioFacts', COALESCE((SELECT payload FROM attribute_scenario_facts), '[]'::jsonb)
);
$$;
