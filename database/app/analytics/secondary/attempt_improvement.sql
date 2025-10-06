-- Attempt Improvement (raw)
-- Params: start, end, cohortIds, roles, simulationFilters, profileId
-- Returns:
--   {
--     chartData: [{ attempt, "Average Score", "Average Time", "Pass Rate" }],
--     facts: [{ simulationId, attemptNo, avgGrade, avgMinutes, passRate }],
--     validSimulationIds: string[]
--   }

CREATE OR REPLACE FUNCTION analytics_attempt_improvement_fn(
  p_start        timestamptz,
  p_end          timestamptz,
  p_cohort_ids   uuid[],
  p_roles        profile_role[],
  p_sim_filters  text[],
  p_profile_id   uuid
) RETURNS jsonb
LANGUAGE sql STABLE AS $$
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

filt AS (
  SELECT * FROM cohort_scoped
),
attempt_first AS (
  SELECT profile_id, simulation_id, attempt_id, MIN(chat_created_at) AS first_ts
  FROM filt
  GROUP BY profile_id, simulation_id, attempt_id
),
attempt_ord AS (
  SELECT
    af.*,
    ROW_NUMBER() OVER (PARTITION BY af.profile_id, af.simulation_id ORDER BY af.first_ts) AS attempt_no
  FROM attempt_first af
),
attempt_rows AS (
  SELECT
    ao.profile_id,
    ao.simulation_id,
    ao.attempt_id,
    ao.attempt_no,
    AVG(f.grade_percent)::float      AS avg_grade,
    AVG(f.time_taken_seconds)::float AS avg_time_seconds,
    MAX((f.passed)::int)::int        AS passed_any
  FROM attempt_ord ao
  JOIN filt f ON f.attempt_id = ao.attempt_id
  GROUP BY ao.profile_id, ao.simulation_id, ao.attempt_id, ao.attempt_no
),

/* -------- Individual user vs Multiple users logic -------- */
individual_user_data AS (
  SELECT
    attempt_no,
    avg_grade::float,
    (avg_time_seconds/60.0)::float AS avg_time_minutes,
    (passed_any * 100.0)::float AS pass_rate
  FROM attempt_rows ar
  CROSS JOIN params pr
  WHERE pr.profile_id IS NOT NULL
    AND avg_grade IS NOT NULL
    AND attempt_no <= 5
),
multiple_users_data AS (
  SELECT
    simulation_id,
    attempt_no,
    AVG(avg_grade)::float            AS avg_grade,
    (AVG(avg_time_seconds)/60.0)     AS avg_time_minutes,
    (100.0 * AVG(passed_any))::float AS pass_rate,
    COUNT(*)                         AS rows_count
  FROM attempt_rows
  WHERE avg_grade IS NOT NULL
  GROUP BY simulation_id, attempt_no
),
by_attempt_sim AS (
  SELECT * FROM multiple_users_data
),
by_attempt AS (
  SELECT
    attempt_no,
    AVG(avg_grade)::float            AS avg_grade,
    (AVG(avg_time_minutes))::float   AS avg_time_minutes,
    (AVG(pass_rate))::float          AS pass_rate
  FROM by_attempt_sim
  WHERE attempt_no <= 5
  GROUP BY attempt_no
),
chart AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'attempt',       'Attempt ' || attempt_no::text,
             'Average Score', ROUND(avg_grade)::int,
             'Average Time',  ROUND(avg_time_minutes)::int,
             'Pass Rate',     ROUND(pass_rate)::int
           )
           ORDER BY attempt_no
         ) AS payload
  FROM (
    -- Individual user: use individual_user_data directly
    SELECT attempt_no, avg_grade, avg_time_minutes, pass_rate
    FROM individual_user_data
    WHERE EXISTS (SELECT 1 FROM params WHERE profile_id IS NOT NULL)
    UNION ALL
    -- Multiple users: use aggregated by_attempt data
    SELECT attempt_no, avg_grade, avg_time_minutes, pass_rate
    FROM by_attempt
    WHERE NOT EXISTS (SELECT 1 FROM params WHERE profile_id IS NOT NULL)
  ) chart_data
),
facts AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'simulationId', COALESCE(simulation_id::text, 'individual'),
             'attemptNo',    attempt_no,
             'avgGrade',     ROUND(avg_grade)::int,
             'avgMinutes',   ROUND(avg_time_minutes)::int,
             'passRate',     ROUND(pass_rate)::int
           )
           ORDER BY COALESCE(simulation_id, '00000000-0000-0000-0000-000000000000'::uuid), attempt_no
         ) AS payload
  FROM (
    -- Individual user: use individual_user_data with NULL simulation_id
    SELECT NULL::uuid AS simulation_id, attempt_no, avg_grade, avg_time_minutes, pass_rate
    FROM individual_user_data
    WHERE EXISTS (SELECT 1 FROM params WHERE profile_id IS NOT NULL)
    UNION ALL
    -- Multiple users: use simulation-level data
    SELECT simulation_id, attempt_no, avg_grade, avg_time_minutes, pass_rate
    FROM by_attempt_sim
    WHERE NOT EXISTS (SELECT 1 FROM params WHERE profile_id IS NOT NULL)
  ) facts_data
),
valid_sim_ids AS (
  SELECT jsonb_agg(DISTINCT f.simulation_id::text ORDER BY f.simulation_id::text) AS payload
  FROM filt f
  WHERE f.simulation_id IS NOT NULL
)
SELECT jsonb_build_object(
  'chartData',          COALESCE((SELECT payload FROM chart), '[]'::jsonb),
  'facts',              COALESCE((SELECT payload FROM facts), '[]'::jsonb),
  'validSimulationIds', COALESCE((SELECT payload FROM valid_sim_ids), '[]'::jsonb)
);
$$;
