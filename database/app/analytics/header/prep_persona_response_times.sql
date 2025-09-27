-- Persona Response Times Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- Note: Uses message_time_taken_seconds (int[]) and averages all deltas
-- count = number of deltas aggregated that day

CREATE OR REPLACE FUNCTION analytics_persona_response_times_fn(
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
flat AS (
  SELECT date_trunc('day', chat_created_at) AS d, x AS delta
  FROM filt, LATERAL unnest(message_time_taken_seconds) AS x
),
by_day AS (
  SELECT to_char(d, 'MM/DD') AS date,
         avg(delta)::float   AS value,
         count(*)::int       AS count
  FROM flat
  GROUP BY 1
),
cur AS (
  SELECT round(avg(delta))::int AS current_value,
         count(*) > 0           AS has_data
  FROM flat
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId', f.profile_id::text,
           'date',      to_char(date_trunc('day', f.chat_created_at),'YYYY-MM-DD'),
           'value',     x::int
         ) ORDER BY f.profile_id, f.chat_created_at) AS payload
  FROM filt f, LATERAL unnest(f.message_time_taken_seconds) AS x
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
