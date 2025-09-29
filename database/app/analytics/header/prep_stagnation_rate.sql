-- Stagnation Rate Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- Note: Uses grade-timeline stagnation (non-increasing normalized scores across time)

CREATE OR REPLACE FUNCTION analytics_stagnation_rate_fn(
  p_start           timestamptz,
  p_end             timestamptz,
  p_cohort_ids      uuid[],
  p_roles           profile_role[],
  p_sim_filters     text[],
  p_profile_id      uuid
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH filt AS (
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
grade_stream AS (
  SELECT
    sg.id,
    sg.simulation_chat_id,
    sg.created_at,
    (sg.score::numeric / NULLIF(r.points,0)) * 100.0 AS norm
  FROM simulation_chat_grades sg
  JOIN rubrics r ON r.id = sg.rubric_id
  WHERE sg.simulation_chat_id IN (SELECT chat_id FROM filt)
),
ordered AS (
  SELECT *,
         LAG(norm) OVER (ORDER BY created_at) AS prev_norm
  FROM grade_stream
),
flags AS (
  SELECT *,
         CASE WHEN prev_norm IS NULL THEN NULL
              WHEN norm <= prev_norm + 0.1 THEN 1 ELSE 0 END AS stagnated
  FROM ordered
  WHERE prev_norm IS NOT NULL
),
by_day AS (
  SELECT
    to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
    (100.0 * AVG(stagnated))::float AS value,
    COUNT(*)::int AS count
  FROM flags
  GROUP BY 1
),
cur AS (
  SELECT ROUND(100.0 * AVG(stagnated))::int AS current_value,
         COUNT(*) > 0 AS has_data
  FROM flags
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId',    f.profile_id::text,
           'date',         to_char(date_trunc('day', gs.created_at),'YYYY-MM-DD'),
           'value',        (stagnated)::int,
           'simulationId', f.simulation_id::text,
           'scenarioId',   f.scenario_id::text
         ) ORDER BY f.profile_id, gs.created_at) AS payload
  FROM flags fl
  JOIN grade_stream gs ON gs.id = fl.id
  JOIN filt f ON f.chat_id = gs.simulation_chat_id
)
SELECT jsonb_build_object(
  'hasData',    COALESCE((SELECT has_data FROM cur), false),
  'method',     'rate',
  'trendData',  COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'date',  date,
                    'value', round(value)::int,
                    'count', count
                  ) ORDER BY date)
                  FROM by_day), '[]'::jsonb),
  'dataPoints', COALESCE((SELECT payload FROM data_points), '[]'::jsonb)
);
$$;
