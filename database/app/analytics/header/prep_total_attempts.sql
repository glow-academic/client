-- Total Attempts Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- Note: Counts distinct attempt_id overall and per day (distinct per day as well)

CREATE OR REPLACE FUNCTION analytics_total_attempts_fn(
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
by_day AS (
  SELECT
    to_char(date_trunc('day', chat_created_at), 'MM/DD') AS date,
    count(DISTINCT attempt_id)::int AS value,
    count(DISTINCT attempt_id)::int AS count
  FROM filt
  GROUP BY 1
),
cur AS (
  SELECT count(DISTINCT attempt_id)::int AS current_value,
         count(*) > 0                    AS has_data
  FROM filt
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId', profile_id::text,
           'date',      to_char(date_trunc('day', chat_created_at),'YYYY-MM-DD'),
           'attemptId', attempt_id::text,
           'value',     1
         ) ORDER BY profile_id, attempt_id) AS payload
  FROM filt
)
SELECT jsonb_build_object(
  'hasData',    COALESCE((SELECT has_data FROM cur), false),
  'method',     'countDistinct',
  'keyField',   'attemptId',
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
