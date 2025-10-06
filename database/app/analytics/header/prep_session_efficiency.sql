-- Session Efficiency Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- Note: Uses TS formula: eff = clamp(0..100, avgScore * (1 - min(1, avgMinutes/120)))

CREATE OR REPLACE FUNCTION analytics_session_efficiency_fn(
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

/* -------- Base selection from analytics (attempt date window) -------- */
base_general AS MATERIALIZED (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_general
    AND a.is_general = TRUE
    AND a.attempt_created_at >= pr.start_at
    AND a.attempt_created_at <  pr.end_at
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
    AND a.attempt_created_at >= pr.start_at
    AND a.attempt_created_at <  pr.end_at
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
-- Calculate overall user metrics (matching Python logic)
user_metrics AS (
  SELECT
    -- Overall average score (from attempt scores, not individual chat scores)
    AVG(grade_percent) FILTER (WHERE grade_percent IS NOT NULL) AS avg_score,
    -- Total time spent in minutes
    SUM(EXTRACT(epoch FROM (chat_completed_at - chat_created_at)) / 60.0) 
      FILTER (WHERE chat_completed_at IS NOT NULL) AS total_minutes,
    -- Total number of chats (matching Python: len(user_chats))
    COUNT(*) AS total_sessions,
    -- Count of completed chats
    COUNT(*) FILTER (WHERE chat_completed_at IS NOT NULL) AS completed_chats
  FROM filt
),
user_efficiency AS (
  SELECT
    avg_score,
    total_minutes,
    total_sessions,
    -- Calculate average minutes per session (matching Python logic)
    CASE 
      WHEN total_sessions > 0 THEN total_minutes / total_sessions
      ELSE total_minutes
    END AS avg_minutes_per_session,
    -- Calculate session efficiency using Python formula
    GREATEST(0.0, LEAST(100.0, 
      avg_score * (1.0 - LEAST(1.0, 
        CASE 
          WHEN total_sessions > 0 THEN total_minutes / total_sessions
          ELSE total_minutes
        END / 120.0
      ))
    )) AS session_efficiency
  FROM user_metrics
),
-- For daily breakdown, we'll use the overall efficiency for each day
by_day AS (
  SELECT
    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
    ROUND(ue.session_efficiency)::int AS value,
    COUNT(DISTINCT attempt_id)::int AS count
  FROM filt f
  CROSS JOIN user_efficiency ue
  GROUP BY 1, ue.session_efficiency
),
cur AS (
  SELECT 
    ROUND(session_efficiency)::int AS current_value,
    total_sessions > 0 AS has_data
  FROM user_efficiency
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId',    f.profile_id::text,
           'date',         to_char(f.attempt_created_at,'YYYY-MM-DD'),
           'value',        ROUND(ue.session_efficiency)::int,
           'simulationId', f.simulation_id::text,
           'scenarioId',   f.scenario_id::text
         ) ORDER BY f.profile_id, f.attempt_created_at) AS payload
  FROM filt f
  CROSS JOIN user_efficiency ue
)
SELECT jsonb_build_object(
  'hasData',    COALESCE((SELECT has_data FROM cur), false),
  'method',     'avg',
  'trendData',  COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'date',  date,
                    'value', value,
                    'count', count
                  ) ORDER BY date)
                  FROM by_day), '[]'::jsonb),
  'dataPoints', COALESCE((SELECT payload FROM data_points), '[]'::jsonb)
);
$$;
