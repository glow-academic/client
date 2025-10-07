-- Time Spent Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- Note: Uses chat duration (completed_at - created_at) instead of time_taken_seconds

CREATE OR REPLACE FUNCTION analytics_time_spent_fn(
  p_start           timestamptz,
  p_end             timestamptz,
  p_cohort_ids      uuid[],
  p_roles           profile_role[],
  p_sim_filters     text[],
  p_profile_id      uuid,
  p_department_ids  uuid[]
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

/* -------- Base selection from analytics (chat date window) -------- */
base_general AS MATERIALIZED (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_general
    AND a.is_general = TRUE
    AND (cardinality(p_department_ids) = 0 OR a.department_id = ANY(p_department_ids))
    AND a.chat_created_at >= pr.start_at
    AND a.chat_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
base_practice AS MATERIALIZED (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_practice
    AND a.is_practice = TRUE
    AND (cardinality(p_department_ids) = 0 OR a.department_id = ANY(p_department_ids))
    AND a.chat_created_at >= pr.start_at
    AND a.chat_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
/* Handle case where we want only archived items (regardless of simulation type) */
base_archived_only AS MATERIALIZED (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_archived 
    AND NOT w.want_nonarchived_or_any
    AND (cardinality(p_department_ids) = 0 OR a.department_id = ANY(p_department_ids))
    AND a.chat_created_at >= pr.start_at
    AND a.chat_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
/* Handle case where we want archived items that are neither general nor practice */
base_archived_other AS MATERIALIZED (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_archived 
    AND w.want_nonarchived_or_any
    AND a.is_general = FALSE
    AND a.is_practice = FALSE
    AND (cardinality(p_department_ids) = 0 OR a.department_id = ANY(p_department_ids))
    AND a.chat_created_at >= pr.start_at
    AND a.chat_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
base_union AS MATERIALIZED (
  SELECT * FROM base_general
  UNION ALL
  SELECT * FROM base_practice
  UNION ALL
  SELECT * FROM base_archived_only
  UNION ALL
  SELECT * FROM base_archived_other
),

/* -------- Archived tri-state -------- */
base_archived AS MATERIALIZED (
  SELECT bu.*
  FROM base_union bu
  CROSS JOIN want w
  WHERE
    CASE
      WHEN w.want_archived AND w.want_nonarchived_or_any THEN TRUE
      WHEN w.want_archived AND NOT w.want_nonarchived_or_any THEN bu.is_archived = TRUE
      WHEN NOT w.want_archived AND w.want_nonarchived_or_any THEN bu.is_archived = FALSE
      ELSE FALSE
    END
),

/* -------- Cohort scoping (if passed) -------- */
cohort_scoped AS MATERIALIZED (
  SELECT b.*
  FROM base_archived b
  CROSS JOIN params pr
  WHERE cardinality(pr.cohort_ids) = 0
     OR (b.cohort_ids && pr.cohort_ids OR b.profile_cohort_ids && pr.cohort_ids)
),

filt AS (
  SELECT * FROM cohort_scoped
),
by_day AS (
  SELECT
    to_char(date_trunc('day', chat_created_at), 'YYYY-MM-DD') AS date,
    ROUND(sum(LEAST(EXTRACT(epoch FROM (chat_completed_at - chat_created_at)) / 60.0, 30.0)))::int AS value,
    count(*)::int AS count
  FROM filt
  WHERE chat_completed_at IS NOT NULL
  GROUP BY 1
),
cur AS (
  SELECT COALESCE(round(sum(LEAST(EXTRACT(epoch FROM (chat_completed_at - chat_created_at)) / 60.0, 30.0)))::int, 0) AS current_value,
         count(*) > 0 AS has_data
  FROM filt
  WHERE chat_completed_at IS NOT NULL
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId',    profile_id::text,
           'date',         to_char(day, 'YYYY-MM-DD'),
           'value',        total_minutes,
           'attemptId',    attempt_id::text,
           'simulationId', simulation_id::text,
           'scenarioId',   scenario_id::text
         ) ORDER BY profile_id, day) AS payload
  FROM (
    SELECT 
      profile_id,
      date_trunc('day', chat_created_at) as day,
      attempt_id,
      simulation_id,
      scenario_id,
      SUM(LEAST(EXTRACT(epoch FROM (chat_completed_at - chat_created_at)) / 60.0, 30.0)) as total_minutes
    FROM filt
    WHERE chat_completed_at IS NOT NULL
    GROUP BY profile_id, date_trunc('day', chat_created_at), attempt_id, simulation_id, scenario_id
  ) grouped
)
SELECT jsonb_build_object(
  'hasData',    (SELECT has_data FROM cur),
  'method',     'sum',
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
