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
WITH params AS (
  SELECT
    COALESCE(p_cohort_ids, '{}')               AS cohort_ids,
    COALESCE(p_roles, '{}')                    AS roles,
    COALESCE(p_sim_filters, ARRAY['general'])  AS sim_filters,
    p_profile_id                               AS profile_id,
    p_start                                    AS start_at,
    p_end                                      AS end_at,
    'general'  = ANY (COALESCE(p_sim_filters, ARRAY['general'])) AS want_general,
    'practice' = ANY (COALESCE(p_sim_filters, ARRAY['practice'])) AS want_practice,
    'archived' = ANY (COALESCE(p_sim_filters, ARRAY['archived'])) AS want_archived
),
want AS (
  SELECT
    want_general, want_practice, want_archived,
    (want_general OR want_practice) AS want_nonarchived_or_any
  FROM params
),
filt AS (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE a.chat_created_at >= pr.start_at
    AND a.chat_created_at < pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
    AND (cardinality(pr.cohort_ids) = 0
         OR (a.cohort_ids && pr.cohort_ids OR a.profile_cohort_ids && pr.cohort_ids))
    AND (
      (w.want_general  AND a.is_general)  OR
      (w.want_practice AND a.is_practice) OR
      (w.want_archived AND a.is_archived)
    )
),
flat AS (
  SELECT date_trunc('day', f.chat_created_at) AS d, x / 60.0 AS delta
  FROM filt f, LATERAL unnest(f.message_time_taken_seconds) AS x
),
by_day AS (
  SELECT to_char(d, 'YYYY-MM-DD') AS date,
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
           'profileId',    f.profile_id::text,
           'date',         to_char(date_trunc('day', f.chat_created_at),'YYYY-MM-DD'),
           'value',        x::int,
           'simulationId', f.simulation_id::text,
           'scenarioId',   f.scenario_id::text
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
