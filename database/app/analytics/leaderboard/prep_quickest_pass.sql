-- Quickest Pass Analytics Prepared Statement
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- What it is: Fastest time-to-pass among sessions that passed
-- Method: min (client computes min of value in seconds, optionally per profileId)

DO $$
BEGIN
    DEALLOCATE prep_quickest_pass;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Ignore any error (prepared statement doesn't exist or other issues)
END $$;

PREPARE prep_quickest_pass (
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
passes AS (
  SELECT *
  FROM filt
  WHERE passed IS TRUE
    AND time_taken_seconds IS NOT NULL
),
by_day AS (
  SELECT
    to_char(date_trunc('day', chat_created_at), 'MM/DD') AS date,
    min(time_taken_seconds)::float AS value,
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
           'value',       time_taken_seconds,
           'simulationId',simulation_id::text
         ) ORDER BY profile_id, time_taken_seconds, chat_created_at) AS payload
  FROM passes
)
SELECT jsonb_build_object(
  'hasData',   COALESCE((SELECT has_data FROM cur), false),
  'method',    'min',
  'trendData', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                  'date',  date,
                  'value', round(value)::int,
                  'count', count
                ) ORDER BY date) FROM by_day), '[]'::jsonb),
  'dataPoints', COALESCE((SELECT payload FROM data_points), '[]'::jsonb)
) AS result;
