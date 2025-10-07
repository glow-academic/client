-- Messages per Session Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints

CREATE OR REPLACE FUNCTION analytics_messages_per_session_fn(
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
/* -------- Params & flags -------- */
WITH params AS (
  SELECT
    COALESCE(p_cohort_ids, '{}')               AS cohort_ids,
    COALESCE(p_roles, '{}')                    AS roles,
    COALESCE(p_sim_filters, ARRAY['general'])  AS sim_filters,
    p_profile_id                               AS profile_id,
    p_start                                    AS start_at,
    p_end                                      AS end_at,
    'general'  = ANY (COALESCE(p_sim_filters, ARRAY['general']))  AS want_general,
    'practice' = ANY (COALESCE(p_sim_filters, ARRAY['practice'])) AS want_practice,
    'archived' = ANY (COALESCE(p_sim_filters, ARRAY['archived'])) AS want_archived
),
want AS (
  SELECT
    want_general, want_practice, want_archived,
    (want_general OR want_practice) AS want_nonarchived_or_any
  FROM params
),

/* -------- Base from MV (one row per chat) -------- */
base AS MATERIALIZED (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  WHERE a.chat_created_at >= pr.start_at
    AND a.chat_created_at <  pr.end_at
    AND (cardinality(p_department_ids) = 0 OR a.department_id = ANY(p_department_ids))
    -- role filter (matches ORIGINAL server-side: by profile role, unless direct profileId is set)
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    -- single-profile scoping when requested
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),

/* -------- Sim-type tri-state (general/practice) -------- */
sim_scoped AS MATERIALIZED (
  SELECT b.*
  FROM base b
  CROSS JOIN want w
  WHERE
    CASE
      WHEN w.want_general AND w.want_practice THEN (b.is_general OR b.is_practice)
      WHEN w.want_general THEN b.is_general
      WHEN w.want_practice THEN b.is_practice
      ELSE FALSE
    END
),

/* -------- Archived tri-state (match NEW semantics) -------- */
archived_scoped AS MATERIALIZED (
  SELECT s.*
  FROM sim_scoped s
  CROSS JOIN want w
  WHERE
    CASE
      WHEN w.want_archived AND w.want_nonarchived_or_any THEN TRUE
      WHEN w.want_archived AND NOT w.want_nonarchived_or_any THEN s.is_archived = TRUE
      WHEN NOT w.want_archived AND w.want_nonarchived_or_any THEN s.is_archived = FALSE
      ELSE FALSE
    END
),

/* -------- Cohort scoping (chat cohorts OR profile cohorts overlap) -------- */
cohort_scoped AS MATERIALIZED (
  SELECT a.*
  FROM archived_scoped a
  CROSS JOIN params pr
  WHERE cardinality(pr.cohort_ids) = 0
     OR ( (a.cohort_ids && pr.cohort_ids) OR (a.profile_cohort_ids && pr.cohort_ids) )
),

/* -------- Chat-level payload (MV already COALESCEs num_messages_total to 0) -------- */
filt AS MATERIALIZED (
  SELECT
    a.profile_id,
    a.chat_id,
    a.chat_created_at,
    a.simulation_id,
    a.scenario_id,
    COALESCE(a.num_messages_total, 0)::int AS num_messages_total
  FROM cohort_scoped a
),
by_day AS (
  SELECT
    to_char(date_trunc('day', chat_created_at), 'YYYY-MM-DD') AS date,
    avg(num_messages_total)::float AS value,
    count(*)::int                 AS count
  FROM filt
  GROUP BY 1
),
cur AS (
  SELECT round(avg(num_messages_total) - 0.0001)::int AS current_value,
         count(*) > 0                         AS has_data
  FROM filt
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId',    profile_id::text,
           'date',         to_char(date_trunc('day', chat_created_at),'YYYY-MM-DD'),
           'value',        num_messages_total,
           'simulationId', simulation_id::text,
           'scenarioId',   scenario_id::text
         ) ORDER BY profile_id, chat_created_at) AS payload
  FROM filt
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
