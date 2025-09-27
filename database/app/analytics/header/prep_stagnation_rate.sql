-- Stagnation Rate Analytics Prepared Statement
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- Note: Define "stagnated" as either:
-- - not completed AND no grade, OR
-- - max per-message delta ≥ 120s (long stall), OR
-- - total messages ≤ 2

DO $$
BEGIN
    DEALLOCATE prep_stagnation_rate;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Ignore any error (prepared statement doesn't exist or other issues)
END $$;

PREPARE prep_stagnation_rate (
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
flags AS (
  SELECT
    *,
    (
      (NOT completed AND grade_percent IS NULL)
      OR (COALESCE((SELECT max(v) FROM unnest(message_time_taken_seconds) v), 0) >= 120)
      OR (num_messages_total <= 2)
    ) AS stagnated
  FROM filt
),
by_day AS (
  SELECT
    to_char(date_trunc('day', chat_created_at), 'MM/DD') AS date,
    (100.0 * avg((stagnated)::int))::float AS value,
    count(*)::int                           AS count
  FROM flags
  GROUP BY 1
),
cur AS (
  SELECT round(100.0 * avg((stagnated)::int))::int AS current_value,
         count(*) > 0                               AS has_data
  FROM flags
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId', profile_id::text,
           'date',      to_char(date_trunc('day', chat_created_at),'YYYY-MM-DD'),
           'value',     (stagnated)::int
         ) ORDER BY profile_id, chat_created_at) AS payload
  FROM flags
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
