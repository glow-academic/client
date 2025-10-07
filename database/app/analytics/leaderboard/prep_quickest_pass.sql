-- Quickest Pass Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- What it is: Fastest time-to-pass among sessions that passed
-- Method: min (client computes min of value in seconds, optionally per profileId)

CREATE OR REPLACE FUNCTION analytics_quickest_pass_fn(
  p_start           timestamptz,
  p_end             timestamptz,
  p_cohort_ids      uuid[],
  p_roles           profile_role[],
  p_sim_filters     text[],
  p_profile_id      uuid,
  p_department_ids  uuid[]
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH filt AS (
  SELECT *
  FROM analytics a
  WHERE a.chat_created_at >= p_start
    AND a.chat_created_at <  p_end
    AND (cardinality(p_department_ids) = 0 OR a.department_id = ANY(p_department_ids))
    AND (p_cohort_ids  IS NULL OR a.cohort_ids && p_cohort_ids)
    AND (p_roles       IS NULL OR a.profile_role = ANY (p_roles))
    AND (p_sim_filters IS NULL OR (
          ('general'  = ANY (p_sim_filters) AND a.is_general) OR
          ('practice' = ANY (p_sim_filters) AND a.is_practice) OR
          ('archived' = ANY (p_sim_filters) AND a.is_archived)
        ))
    AND (p_profile_id IS NULL OR a.profile_id = p_profile_id)
),
passes AS (
  SELECT *
  FROM filt
  WHERE passed IS TRUE
    AND time_taken_seconds IS NOT NULL
),
by_day AS (
  SELECT
    to_char(date_trunc('day', chat_created_at), 'MM/DD') AS date,
    round(min(time_taken_seconds) / 60.0)::int AS value,
    count(*)::int AS count
  FROM passes
  GROUP BY 1
),
cur AS (
  SELECT (count(*) > 0) AS has_data
  FROM passes
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId',   profile_id::text,
           'date',        to_char(date_trunc('day', chat_created_at),'YYYY-MM-DD'),
           'value',       round(time_taken_seconds / 60.0)::int,
           'simulationId',simulation_id::text
         ) ORDER BY profile_id, time_taken_seconds, chat_created_at) AS payload
  FROM passes
)
SELECT jsonb_build_object(
  'hasData',    COALESCE((SELECT has_data FROM cur), false),
  'method',     'min',
  'trendData',  COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'date',  date,
                    'value', value,
                    'count', count
                  ) ORDER BY date)
                  FROM by_day), '[]'::jsonb),
  'dataPoints', COALESCE((SELECT payload FROM data_points), '[]'::jsonb)
);
$$;
