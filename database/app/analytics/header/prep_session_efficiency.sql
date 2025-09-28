-- Session Efficiency Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- Note: Define per-session efficiency as:
-- eff = LEAST(100, GREATEST(0, grade_percent / NULLIF(time_taken_seconds,0) * 300))
-- i.e., 100% if you score 100 in ≤ 300s, scales down with more time

CREATE OR REPLACE FUNCTION analytics_session_efficiency_fn(
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
eff AS (
  SELECT *,
    CASE
      WHEN grade_percent IS NULL OR time_taken_seconds IS NULL OR time_taken_seconds = 0
        THEN NULL
      ELSE LEAST(100.0, GREATEST(0.0, (grade_percent / time_taken_seconds) * 300.0))
    END AS eff_value
  FROM filt
),
by_day AS (
  SELECT
    to_char(date_trunc('day', chat_created_at), 'MM/DD') AS date,
    avg(eff_value)::float AS value,
    count(*)::int         AS count
  FROM eff
  WHERE eff_value IS NOT NULL
  GROUP BY 1
),
cur AS (
  SELECT round(avg(eff_value))::int AS current_value,
         count(eff_value) > 0        AS has_data
  FROM eff
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId',    profile_id::text,
           'date',         to_char(date_trunc('day', chat_created_at),'YYYY-MM-DD'),
           'value',        eff_value,
           'simulationId', simulation_id::text,
           'scenarioId',   scenario_id::text
         ) ORDER BY profile_id, chat_created_at) AS payload
  FROM eff
  WHERE eff_value IS NOT NULL
)
SELECT jsonb_build_object(
  'hasData',    COALESCE((SELECT has_data FROM cur), false),
  'method',     'avg',
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
