-- Improvement per Day Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- What it is: Slope (percentage points per day) of average grade per day
-- Method: slope (client computes slope of value vs. date treated as day index)

CREATE OR REPLACE FUNCTION analytics_improvement_per_day_fn(
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
-- Per-profile, per-day average grade
per_day AS (
  SELECT
    profile_id,
    date_trunc('day', chat_created_at) AS d,
    avg(grade_percent)::float AS avg_grade,
    count(*)::int AS n
  FROM filt
  WHERE grade_percent IS NOT NULL
  GROUP BY profile_id, date_trunc('day', chat_created_at)
),
-- Keep your global chart consistent: overall daily average across all profiles
by_day AS (
  SELECT
    to_char(d, 'MM/DD') AS date,
    avg(avg_grade)::float AS value,
    sum(n)::int          AS count
  FROM per_day
  GROUP BY 1
),
cur AS (
  SELECT (SELECT count(*) > 0 FROM per_day) AS has_data
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId', profile_id::text,
           'date',      to_char(d,'YYYY-MM-DD'),
           'value',     avg_grade,
           'count',     n
         ) ORDER BY profile_id, d) AS payload
  FROM per_day
)
SELECT jsonb_build_object(
  'hasData',    COALESCE((SELECT has_data FROM cur), false),
  'method',     'slope',
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
