-- Persona Response Times Analytics Prepared Statement
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- Note: Uses message_time_taken_seconds (int[]) and averages all deltas
-- count = number of deltas aggregated that day

DEALLOCATE prep_persona_response_times;

PREPARE prep_persona_response_times (
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
)
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId', f.profile_id::text,
           'date',      to_char(date_trunc('day', f.chat_created_at),'YYYY-MM-DD'),
           'value',     x::int
         ) ORDER BY f.profile_id, f.chat_created_at) AS payload
  FROM filt f, LATERAL unnest(f.message_time_taken_seconds) AS x
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
