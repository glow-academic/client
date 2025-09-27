-- First Attempt Pass Rate Analytics Prepared Statement
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- Note: "First attempt" = earliest chat_created_at per (profile_id, simulation_id) within the filtered range

DEALLOCATE prep_first_attempt_pass_rate;

PREPARE prep_first_attempt_pass_rate (
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
           'profileId', profile_id::text,
           'date',      to_char(date_trunc('day', chat_created_at),'YYYY-MM-DD'),
           'value',     (passed)::int
         ) ORDER BY profile_id, chat_created_at) AS payload
  FROM firsts
  WHERE passed IS NOT NULL
)
SELECT jsonb_build_object(
  'hasData',   COALESCE((SELECT has_data FROM cur), false),
  'method',    'rate',
  'trendData', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                      'date',  date,
                      'value', round(value)::int,
                      'count', count
                   ) ORDER BY date) FROM by_day), '[]'::jsonb),
  'dataPoints', COALESCE((SELECT payload FROM data_points), '[]'::jsonb)
) AS result;
