-- Total Attempts Analytics Prepared Statement
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- Note: Counts distinct attempt_id overall and per day (distinct per day as well)

DEALLOCATE prep_total_attempts;

PREPARE prep_total_attempts (
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
    count(DISTINCT attempt_id)::int AS value,
    count(DISTINCT attempt_id)::int AS count
  FROM filt
  GROUP BY 1
),
cur AS (
  SELECT count(DISTINCT attempt_id)::int AS current_value,
         count(*) > 0                    AS has_data
  FROM filt
)
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
  'hasData',   COALESCE((SELECT has_data FROM cur), false),
  'method',    'countDistinct',
  'keyField',  'attemptId',
  'trendData', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                      'date',  date,
                      'value', value,
                      'count', count
                   ) ORDER BY date) FROM by_day), '[]'::jsonb),
  'dataPoints', COALESCE((SELECT payload FROM data_points), '[]'::jsonb)
) AS result;
