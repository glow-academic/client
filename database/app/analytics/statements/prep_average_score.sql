-- Average Score Analytics Prepared Statement
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints

DEALLOCATE prep_average_score;

PREPARE prep_average_score (
  timestamptz, timestamptz, uuid[], profile_role[], text[], uuid
) AS
WITH filt AS (
  SELECT *
  FROM analytics a
  WHERE a.chat_created_at >= $1
    AND a.chat_created_at <  $2
    AND ($3 IS NULL OR a.cohort_ids && $3)
    AND ($4 IS NULL OR a.profile_role = ANY ($4))
    AND ($5 IS NULL OR (('general'=ANY($5) AND a.is_general)
                     OR ('practice'=ANY($5) AND a.is_practice)
                     OR ('archived'=ANY($5) AND a.is_archived)))
    AND ($6 IS NULL OR a.profile_id = $6)
),
by_day AS (
  SELECT
    to_char(date_trunc('day', chat_created_at), 'MM/DD') AS date,
    avg(grade_percent)::float AS value,
    count(*)::int AS count
  FROM filt
  WHERE grade_percent IS NOT NULL
  GROUP BY 1
),
cur AS (
  SELECT round(avg(grade_percent))::int AS current_value,
         count(*) > 0                   AS has_data
  FROM filt
  WHERE grade_percent IS NOT NULL
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId', profile_id::text,
           'date',      to_char(date_trunc('day', chat_created_at),'YYYY-MM-DD'),
           'value',     grade_percent
         ) ORDER BY profile_id, chat_created_at) AS payload
  FROM filt
  WHERE grade_percent IS NOT NULL
)
SELECT jsonb_build_object(
  'hasData',   COALESCE((SELECT has_data FROM cur), false),
  'method',    'avg',
  'trendData', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                  'date',  date,
                  'value', round(value)::int,
                  'count', count
                ) ORDER BY date) FROM by_day), '[]'::jsonb),
  'dataPoints', COALESCE((SELECT payload FROM data_points), '[]'::jsonb)
) AS result;
