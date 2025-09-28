-- Cohort Performance Analytics Function
-- Parameters: start, end, cohortIds, roles, simulationFilters, profileId
-- Returns: CohortPerformanceData JSON
CREATE OR REPLACE FUNCTION analytics_cohort_performance_fn(
  p_start           timestamptz,
  p_end             timestamptz,
  p_cohort_ids      uuid[],           -- if NULL, compute for all cohorts that appear in the data
  p_roles           profile_role[],
  p_sim_filters     text[],
  p_profile_id      uuid
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
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
-- Expand rows per (chat, cohort_id)
filt_x AS (
  SELECT f.*, c_id
  FROM filt f,
  LATERAL unnest(f.cohort_ids) AS c_id
),
-- Which cohorts are relevant?
cohort_list AS (
  SELECT DISTINCT c.id, c.title, c.profile_ids, c.simulation_ids
  FROM cohorts c
  JOIN (
    SELECT DISTINCT c_id FROM filt_x
  ) fx ON fx.c_id = c.id
),
-- Attempt-level rows per cohort for stable pass-rate and totals
cohort_attempts AS (
  SELECT
    fx.c_id               AS cohort_id,
    fx.attempt_id,
    MAX((fx.passed)::int)::int             AS passed_any,
    AVG(fx.grade_percent)::float           AS avg_grade_attempt
  FROM filt_x fx
  GROUP BY fx.c_id, fx.attempt_id
),
-- Per-cohort×simulation aggregates for facts
cohort_sim AS (
  SELECT
    fx.c_id AS cohort_id,
    fx.simulation_id,
    MAX((fx.passed)::int)::int           AS passed_any,
    AVG(fx.grade_percent)::float         AS avg_grade_attempt,
    COUNT(DISTINCT fx.attempt_id)        AS attempts
  FROM filt_x fx
  GROUP BY fx.c_id, fx.simulation_id, fx.attempt_id
),
cohort_sim_agg AS (
  SELECT
    cohort_id,
    simulation_id,
    (100.0 * AVG(passed_any))::float AS pass_rate_attempts,
    AVG(avg_grade_attempt)::float    AS avg_percentage_score,
    SUM(attempts)::int               AS total_attempts
  FROM cohort_sim
  GROUP BY cohort_id, simulation_id
),
-- Per-cohort aggregates
cohort_agg AS (
  SELECT
    cl.id                        AS cohort_id,
    cl.title                     AS cohort_name,
    COALESCE(cardinality(cl.profile_ids), 0)                 AS total_students_declared,
    (SELECT COUNT(DISTINCT profile_id) FROM filt_x WHERE c_id = cl.id) AS total_students_seen,
    COUNT(DISTINCT ca.attempt_id)                                AS total_attempts,
    SUM(passed_any)::int                                         AS passed_attempts,
    (100.0 * AVG(passed_any))::float                             AS pass_rate_attempts,
    AVG(ca.avg_grade_attempt)::float                              AS avg_percentage_score,
    cl.simulation_ids,
    -- derive a single rubric mode for points (using MV columns directly)
    (SELECT a2.rubric_points
       FROM analytics a2
      WHERE a2.chat_id IN (SELECT chat_id FROM filt_x WHERE c_id = cl.id)
      GROUP BY a2.rubric_id, a2.rubric_points
      ORDER BY COUNT(*) DESC
      LIMIT 1)                                                    AS rubric_points,
    (SELECT a2.rubric_pass_points
       FROM analytics a2
      WHERE a2.chat_id IN (SELECT chat_id FROM filt_x WHERE c_id = cl.id)
      GROUP BY a2.rubric_id, a2.rubric_pass_points
      ORDER BY COUNT(*) DESC
      LIMIT 1)                                                    AS rubric_pass_points
  FROM cohort_list cl
  LEFT JOIN cohort_attempts ca ON ca.cohort_id = cl.id
  GROUP BY cl.id, cl.title, cl.profile_ids, cl.simulation_ids
),
cohort_rows AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'id',                    cohort_id::text,
             'name',                  cohort_name,
             'passRate',              ROUND(COALESCE(pass_rate_attempts,0))::int,
             'avgPercentageScore',    ROUND(COALESCE(avg_percentage_score,0))::int,
             'totalStudents',         GREATEST(total_students_declared, total_students_seen),
             'passedStudents',        (SELECT COUNT(*)
                                       FROM (
                                         SELECT 1
                                         FROM filt_x fx2
                                         WHERE fx2.c_id = cohort_id
                                         GROUP BY fx2.profile_id
                                         HAVING MAX((fx2.passed)::int) = 1
                                       ) s),  -- "at least one pass"
             'totalAttempts',         COALESCE(total_attempts,0),
             'passedAttempts',        COALESCE(passed_attempts,0),
             'rubricPoints',          COALESCE(rubric_points, 0),
             'rubricPassPoints',      COALESCE(rubric_pass_points, 0),
             'availableSimulations',  COALESCE(cardinality(simulation_ids),0),
             'color',                 CASE
                                        WHEN COALESCE(pass_rate_attempts,0) >= 85 THEN '#10b981' -- green
                                        WHEN COALESCE(pass_rate_attempts,0) >= 70 THEN '#f59e0b' -- amber
                                        ELSE '#ef4444' -- red
                                      END
           )
           ORDER BY cohort_name
         ) AS payload
  FROM cohort_agg
),
-- Daily facts for client-side filtering
daily_sim AS (
  SELECT
    to_char(date_trunc('day', fx.chat_created_at), 'MM/DD') AS date,
    fx.simulation_id,
    AVG(fx.grade_percent)::float AS avg_score
  FROM filt_x fx
  WHERE fx.grade_percent IS NOT NULL
  GROUP BY 1, 2
  ORDER BY 1
),
daily AS (
  SELECT
    to_char(date_trunc('day', fx.chat_created_at), 'MM/DD') AS date,
    AVG(fx.grade_percent)::float AS avg_score
  FROM filt_x fx
  WHERE fx.grade_percent IS NOT NULL
  GROUP BY 1
  ORDER BY 1
),
daily_rows AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'date',     date,
             'avgScore', ROUND(avg_score)::int
           )
         ) AS payload
  FROM daily
),
cohort_facts AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'cohortId',   cohort_id::text,
             'simulationId', simulation_id::text,
             'passRate',   ROUND(COALESCE(pass_rate_attempts,0))::int,
             'avgScore',   ROUND(COALESCE(avg_percentage_score,0))::int,
             'attempts',   COALESCE(total_attempts,0)
           )
         ) AS payload
  FROM cohort_sim_agg
),
daily_facts AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'date',        date,
             'simulationId', simulation_id::text,
             'avgScore',    ROUND(avg_score)::int
           )
         ) AS payload
  FROM daily_sim
),
overall_status AS (
  SELECT
    CASE
      WHEN COUNT(*) = 0 THEN 'neutral'
      ELSE CASE
        WHEN AVG((passed)::int) * 100 >= 85 THEN 'success'
        WHEN AVG((passed)::int) * 100 >= 70 THEN 'warning'
        ELSE 'danger'
      END
    END AS perf_status
  FROM filt
),
insight AS (
  SELECT
    CASE
      WHEN (SELECT COUNT(*) FROM cohort_agg) = 0 THEN NULL
      ELSE
        (
          'Top cohort: ' ||
          COALESCE(
            (SELECT cohort_name
               FROM cohort_agg
               ORDER BY pass_rate_attempts DESC NULLS LAST
               LIMIT 1),
            'n/a'
          )
          || ' • Avg pass rate '
          || COALESCE(TO_CHAR(
                (SELECT pass_rate_attempts
                 FROM cohort_agg
                 ORDER BY pass_rate_attempts DESC NULLS LAST
                 LIMIT 1),
                'FM999D0'
             ), '0')
          || '%.'
        )
    END AS msg
)
SELECT jsonb_build_object(
  'cohortData',            COALESCE((SELECT payload FROM cohort_rows), '[]'::jsonb),
  'dailyData',             COALESCE((SELECT payload FROM daily_rows), '[]'::jsonb),
  'cohortFacts',           COALESCE((SELECT payload FROM cohort_facts), '[]'::jsonb),
  'dailyFacts',            COALESCE((SELECT payload FROM daily_facts), '[]'::jsonb),
  'availableSimulations',  COALESCE((
                               SELECT jsonb_agg(jsonb_build_object(
                                 'id',        s.id::text,
                                 'name',      s.title,
                                 'timeLimit', s.time_limit
                               ) ORDER BY s.title)
                               FROM (
                                 SELECT DISTINCT s.*
                                 FROM filt_x fx
                                 JOIN simulations s ON s.id = fx.simulation_id
                               ) s
                             ), '[]'::jsonb),
  'insights',              (SELECT msg FROM insight),
  'performanceStatus',     (SELECT perf_status FROM overall_status),
  'hasData',               EXISTS (SELECT 1 FROM filt)
);
$$;
