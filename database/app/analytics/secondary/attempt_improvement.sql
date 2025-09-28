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
WITH filt AS (
  SELECT *
  FROM analytics a
  WHERE a.chat_created_at >= p_start
    AND a.chat_created_at <  p_end
    AND (p_cohort_ids  IS NULL OR a.cohort_ids && p_cohort_ids)
    AND (p_roles       IS NULL OR a.profile_role = ANY (p_roles))
    AND (p_sim_filters IS NULL OR (
          ('general'  = ANY (p_sim_filters) AND a.is_general) OR
          ('practice' = ANY (p_sim_filters) AND a.is_practice) OR
          ('archived' = ANY (p_sim_filters) AND a.is_archived)
        ))
    AND (p_profile_id IS NULL OR a.profile_id = p_profile_id)
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
by_attempt_sim AS (
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
by_attempt AS (
  SELECT
    attempt_no,
    AVG(avg_grade)::float            AS avg_grade,
    (AVG(avg_time_minutes))::float   AS avg_time_minutes,
    (AVG(pass_rate))::float          AS pass_rate
  FROM by_attempt_sim
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
  FROM by_attempt
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
           ORDER BY simulation_id, attempt_no
         ) AS payload
  FROM by_attempt_sim
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
