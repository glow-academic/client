-- First Attempt Pass Rate Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- Note: "First attempt" = earliest attempt_created_at per (profile_id, simulation_id) within the filtered range

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
  WHERE a.attempt_created_at > p_start
    AND a.attempt_created_at < GREATEST(p_end, now())
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
attempts AS (
  SELECT DISTINCT attempt_id, profile_id, simulation_id,
         MIN(attempt_created_at) AS attempt_created_at
  FROM filt
  GROUP BY attempt_id, profile_id, simulation_id
),
first_attempts AS (
  SELECT DISTINCT ON (profile_id, simulation_id) *
  FROM attempts
  ORDER BY profile_id, simulation_id, attempt_created_at
),
first_pass AS (
  SELECT
    fa.profile_id,
    fa.simulation_id,
    fa.attempt_id,
    fa.attempt_created_at,
    BOOL_OR(f.passed)                                  AS passed,
    -- choose a representative scenario for the attempt (earliest chat)
    (ARRAY_AGG(f.scenario_id ORDER BY f.chat_created_at))[1] AS scenario_id
  FROM first_attempts fa
  JOIN filt f USING (attempt_id)
  GROUP BY fa.profile_id, fa.simulation_id, fa.attempt_id, fa.attempt_created_at
),
by_day AS (
  SELECT
    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
    (100.0 * avg((passed)::int))::float AS value,
    count(*)::int AS count
  FROM first_pass
  WHERE passed IS NOT NULL
  GROUP BY 1
),
cur AS (
  SELECT round(100.0 * avg((passed)::int))::int AS current_value,
         count(*) > 0                             AS has_data
  FROM first_pass
  WHERE passed IS NOT NULL
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId',    profile_id::text,
           'date',         to_char(attempt_created_at,'YYYY-MM-DD'),
           'value',        (passed)::int,
           'simulationId', simulation_id::text,
           'scenarioId',   scenario_id::text
         ) ORDER BY profile_id, attempt_created_at) AS payload
  FROM first_pass
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
