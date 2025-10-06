-- Stagnation Rate Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- Note: Uses grade-timeline stagnation (non-increasing normalized scores across time)

CREATE OR REPLACE FUNCTION analytics_stagnation_rate_fn(
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

/* -------- Base selection from analytics (chat date window) -------- */
base_general AS MATERIALIZED (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_general
    AND a.is_general = TRUE
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
    AND a.attempt_created_at >= pr.start_at
    AND a.attempt_created_at <  pr.end_at
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
    AND a.attempt_created_at >= pr.start_at
    AND a.attempt_created_at <  pr.end_at
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

filtered_chats AS MATERIALIZED (
  SELECT DISTINCT chat_id
  FROM cohort_scoped
  WHERE chat_id IS NOT NULL
),

filt AS (
  SELECT * FROM cohort_scoped
),
grade_stream AS (
  SELECT
    sg.id,
    sg.simulation_chat_id,
    sg.created_at,
    (sg.score::numeric / NULLIF(r.points,0)) * 100.0 AS norm
  FROM simulation_chat_grades sg
  JOIN filtered_chats fc ON fc.chat_id = sg.simulation_chat_id
  JOIN rubrics r ON r.id = sg.rubric_id
),
ordered AS (
  SELECT *,
         LAG(norm) OVER (ORDER BY created_at) AS prev_norm
  FROM grade_stream
),
flags AS (
  SELECT *,
         CASE WHEN prev_norm IS NULL THEN NULL
              WHEN norm <= prev_norm + 0.1 THEN 1 ELSE 0 END AS stagnated
  FROM ordered
  WHERE prev_norm IS NOT NULL
),
by_day AS (
  SELECT
    to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
    (100.0 * AVG(stagnated))::float AS value,
    COUNT(*)::int AS count
  FROM flags
  GROUP BY 1
),
cur AS (
  SELECT ROUND(100.0 * AVG(stagnated))::int AS current_value,
         COUNT(*) > 0 AS has_data
  FROM flags
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId',    f.profile_id::text,
           'date',         to_char(date_trunc('day', gs.created_at),'YYYY-MM-DD'),
           'value',        (stagnated)::int,
           'simulationId', f.simulation_id::text,
           'scenarioId',   f.scenario_id::text
         ) ORDER BY f.profile_id, gs.created_at) AS payload
  FROM flags fl
  JOIN grade_stream gs ON gs.id = fl.id
  JOIN filt f ON f.chat_id = gs.simulation_chat_id
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
