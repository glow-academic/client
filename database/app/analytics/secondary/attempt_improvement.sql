-- Attempt Improvement Analytics Function
-- Parameters: start, end, cohortIds, roles, simulationFilters, profileId, simulationIds
-- Returns: {
--   chartData: [{ attempt: "Attempt 1", "Average Score": 75, "Average Time": 12, "Pass Rate": 68 }, ...],
--   availableSimulations: [{ id, name, timeLimit }],
--   improvementStatus: 'success' | 'warning' | 'danger' | 'neutral',
--   actionableInsight?: string
-- }
CREATE OR REPLACE FUNCTION analytics_attempt_improvement_fn(
  p_start             timestamptz,
  p_end               timestamptz,
  p_cohort_ids        uuid[],
  p_roles             profile_role[],
  p_sim_filters       text[],
  p_profile_id        uuid,
  p_simulation_ids    uuid[]
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH filt AS (
  SELECT *
  FROM analytics a
  WHERE a.chat_created_at >= p_start
    AND a.chat_created_at <  p_end
    AND (p_cohort_ids     IS NULL OR a.cohort_ids && p_cohort_ids)
    AND (p_roles          IS NULL OR a.profile_role = ANY (p_roles))
    AND (p_sim_filters    IS NULL OR (
           ('general'  = ANY (p_sim_filters) AND a.is_general) OR
           ('practice' = ANY (p_sim_filters) AND a.is_practice) OR
           ('archived' = ANY (p_sim_filters) AND a.is_archived)
        ))
    AND (p_profile_id     IS NULL OR a.profile_id = p_profile_id)
    AND (p_simulation_ids IS NULL OR a.simulation_id = ANY (p_simulation_ids))
),
-- First timestamp for each attempt (per profile+simulation)
attempt_first AS (
  SELECT
    profile_id,
    simulation_id,
    attempt_id,
    MIN(chat_created_at) AS first_ts
  FROM filt
  GROUP BY profile_id, simulation_id, attempt_id
),
-- Ordinal attempt number per (profile, simulation)
attempt_ord AS (
  SELECT
    af.*,
    ROW_NUMBER() OVER (
      PARTITION BY af.profile_id, af.simulation_id
      ORDER BY af.first_ts
    ) AS attempt_no
  FROM attempt_first af
),
-- Collapse chats into one row per attempt_id with attempt-level metrics
attempt_rows AS (
  SELECT
    ao.profile_id,
    ao.simulation_id,
    ao.attempt_id,
    ao.attempt_no,
    AVG(f.grade_percent)::float          AS avg_grade,
    AVG(f.time_taken_seconds)::float     AS avg_time_seconds,
    MAX((f.passed)::int)::int            AS passed_any
  FROM attempt_ord ao
  JOIN filt f ON f.attempt_id = ao.attempt_id
  GROUP BY ao.profile_id, ao.simulation_id, ao.attempt_id, ao.attempt_no
),
-- Per-simulation aggregates for facts
by_attempt_sim AS (
  SELECT
    simulation_id,
    attempt_no,
    AVG(avg_grade)::float           AS avg_grade,
    (AVG(avg_time_seconds)/60.0)    AS avg_time_minutes,
    (100.0 * AVG(passed_any))::float AS pass_rate
  FROM attempt_rows
  WHERE avg_grade IS NOT NULL
  GROUP BY simulation_id, attempt_no
),
-- Aggregate across all profiles/sims by ordinal
by_attempt AS (
  SELECT
    attempt_no,
    AVG(avg_grade)::float                       AS avg_grade,
    (AVG(avg_time_seconds)/60.0)::float         AS avg_time_minutes,
    (100.0 * AVG(passed_any))::float            AS pass_rate
  FROM attempt_rows
  WHERE avg_grade IS NOT NULL
  GROUP BY attempt_no
),
chart AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'attempt',         'Attempt ' || attempt_no::text,
             'Average Score',   ROUND(avg_grade)::int,
             'Average Time',    ROUND(avg_time_minutes)::int,
             'Pass Rate',       ROUND(pass_rate)::int
           )
           ORDER BY attempt_no
         ) AS payload
  FROM by_attempt
),
-- Simple status from slope between Attempt 1 and last (on Average Score)
status AS (
  SELECT
    CASE
      WHEN COUNT(*) < 2 THEN 'neutral'
      ELSE (
        CASE
          WHEN (MAX(avg_grade) - MIN(avg_grade)) >= 5  THEN 'success'
          WHEN (MAX(avg_grade) - MIN(avg_grade)) >= 2  THEN 'warning'
          ELSE 'danger'
        END
      )
    END AS improvement_status,
    COALESCE(MIN(avg_grade),0) AS first_avg,
    COALESCE(MAX(avg_grade),0) AS last_avg
  FROM by_attempt
),
insight AS (
  SELECT
    CASE
      WHEN (SELECT COUNT(*) FROM by_attempt) < 2 THEN NULL
      ELSE (
        'Average score changed by ' ||
        TO_CHAR( (SELECT last_avg - first_avg FROM status), 'FM999D00' ) ||
        ' pts from first to latest attempt.'
      )
    END AS msg
),
facts AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'simulationId', simulation_id::text,
             'attemptNo',    attempt_no,
             'avgGrade',     ROUND(avg_grade)::int,
             'avgMinutes',   ROUND(avg_time_minutes)::int,
             'passRate',     ROUND(pass_rate)::int
           )
         ) AS payload
  FROM by_attempt_sim
),
available_sims AS (
  SELECT DISTINCT s.id::text, s.title AS name, s.time_limit
  FROM filt f
  JOIN simulations s ON s.id = f.simulation_id
  ORDER BY name
)
SELECT jsonb_build_object(
  'chartData',            COALESCE((SELECT payload FROM chart), '[]'::jsonb),
  'facts',                COALESCE((SELECT payload FROM facts), '[]'::jsonb),
  'availableSimulations', COALESCE((
                               SELECT jsonb_agg(jsonb_build_object(
                                 'id',        id,
                                 'name',      name,
                                 'timeLimit', time_limit
                               ) ORDER BY name)
                               FROM available_sims
                             ), '[]'::jsonb),
  'improvementStatus',    COALESCE((SELECT improvement_status FROM status), 'neutral'),
  'actionableInsight',    (SELECT msg FROM insight)
);
$$;
