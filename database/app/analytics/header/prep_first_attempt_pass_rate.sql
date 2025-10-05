-- First Attempt Pass Rate Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- Note: "First attempt" = earliest attempt_created_at per (profile_id, simulation_id) within the filtered range

CREATE OR REPLACE FUNCTION analytics_first_attempt_pass_rate_fn(
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
/* -------- Params and flags -------- */
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

/* -------- Find earliest attempt per (profile, scenario) overall -------- */
earliest_attempt_all_time AS MATERIALIZED (
  SELECT DISTINCT ON (a.profile_id, a.scenario_id)
         a.attempt_id, a.profile_id, a.simulation_id, a.scenario_id, a.attempt_created_at
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE (
    (w.want_general AND a.is_general = TRUE) OR
    (w.want_practice AND a.is_practice = TRUE) OR
    (w.want_archived AND a.is_archived = TRUE)
  )
  AND (
    pr.profile_id IS NOT NULL
    OR cardinality(pr.roles) = 0
    OR a.profile_role = ANY (pr.roles)
  )
  AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
  AND (cardinality(pr.cohort_ids) = 0 OR (a.cohort_ids && pr.cohort_ids OR a.profile_cohort_ids && pr.cohort_ids))
  ORDER BY a.profile_id, a.scenario_id, a.attempt_created_at
),

/* -------- Restrict to window for counting/trends -------- */
first_attempts_in_window AS MATERIALIZED (
  SELECT ea.*
  FROM earliest_attempt_all_time ea
  CROSS JOIN params pr
  WHERE ea.attempt_created_at >= pr.start_at
    AND ea.attempt_created_at < pr.end_at
),

/* -------- Get pass data for first attempts -------- */
filt AS (
  SELECT a.*
  FROM analytics a
  JOIN first_attempts_in_window fa USING (attempt_id)
),

first_attempts AS (
  SELECT fa.profile_id, fa.simulation_id, fa.scenario_id, fa.attempt_id, fa.attempt_created_at
  FROM first_attempts_in_window fa
),
first_pass AS (
  SELECT
    fa.profile_id,
    fa.simulation_id,
    fa.scenario_id,
    fa.attempt_id,
    fa.attempt_created_at,
    BOOL_OR(f.passed)                                  AS passed
  FROM first_attempts_in_window fa
  JOIN filt f USING (attempt_id)
  GROUP BY fa.profile_id, fa.simulation_id, fa.scenario_id, fa.attempt_id, fa.attempt_created_at
),
by_day AS (
  SELECT
    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
    (100.0 * avg((passed)::int))::float AS value,
    count(*)::int AS count
  FROM first_pass
  WHERE passed IS NOT NULL
  GROUP BY 1
),
cur AS (
  SELECT round(100.0 * avg((passed)::int))::int AS current_value,
         count(*) > 0                             AS has_data
  FROM first_pass
  WHERE passed IS NOT NULL
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId',    fp.profile_id::text,
           'date',         to_char(fp.attempt_created_at,'YYYY-MM-DD'),
           'value',        (fp.passed)::int,
           'simulationId', fp.simulation_id::text,
           'scenarioId',   fp.scenario_id::text
         ) ORDER BY fp.profile_id, fp.attempt_created_at) AS payload
  FROM first_pass fp
  WHERE fp.passed IS NOT NULL
)
SELECT jsonb_build_object(
  'hasData',    COALESCE((SELECT has_data FROM cur), false),
  'method',     'rate',
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
