-- First Attempt Pass Rate Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- Note: "First attempt" = earliest chat_created_at per (profile_id, simulation_id) within the filtered range

CREATE OR REPLACE FUNCTION analytics_first_attempt_pass_rate_fn(
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
firsts AS (
  SELECT DISTINCT ON (profile_id, simulation_id)
         *
  FROM filt
  ORDER BY profile_id, simulation_id, chat_created_at
),
by_day AS (
  SELECT
    to_char(date_trunc('day', chat_created_at), 'MM/DD') AS date,
    (100.0 * avg((passed)::int))::float AS value,
    count(*)::int AS count
  FROM firsts
  WHERE passed IS NOT NULL
  GROUP BY 1
),
cur AS (
  SELECT round(100.0 * avg((passed)::int))::int AS current_value,
         count(*) > 0                             AS has_data
  FROM firsts
  WHERE passed IS NOT NULL
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId',    profile_id::text,
           'date',         to_char(date_trunc('day', chat_created_at),'YYYY-MM-DD'),
           'value',        (passed)::int,
           'simulationId', simulation_id::text,
           'scenarioId',   scenario_id::text
         ) ORDER BY profile_id, chat_created_at) AS payload
  FROM firsts
  WHERE passed IS NOT NULL
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
