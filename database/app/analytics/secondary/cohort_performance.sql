-- Cohort Performance (raw)
-- Params: start, end, cohortIds, roles, simulationFilters, profileId
-- Returns:
--  {
--    cohortData: [{ id, name, passRate, avgPercentageScore, totalStudents, passedStudents, totalAttempts, passedAttempts, rubricPoints, rubricPassPoints }],
--    dailyData:  [{ date, avgScore }],
--    cohortFacts:[{ cohortId, simulationId, passRate, avgScore, attempts }],
--    dailyFacts: [{ date, simulationId, avgScore }],
--    validSimulationIds: string[]
--  }

CREATE OR REPLACE FUNCTION analytics_cohort_performance_fn(
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
    'practice' = ANY (COALESCE(p_sim_filters, ARRAY['general'])) AS want_practice,
    'archived' = ANY (COALESCE(p_sim_filters, ARRAY['general'])) AS want_archived
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
base_union AS MATERIALIZED (
  SELECT * FROM base_general
  UNION ALL
  SELECT * FROM base_practice
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
     OR (b.cohort_ids && pr.cohort_ids AND b.profile_cohort_ids && pr.cohort_ids)
),

filt AS (
  SELECT * FROM cohort_scoped
),
filt_x AS (
  SELECT f.*, c_id
  FROM filt f,
  LATERAL unnest(f.cohort_ids) AS c_id
),
cohort_list AS (
  SELECT DISTINCT c.id, c.title, c.profile_ids, c.simulation_ids
  FROM cohorts c
  JOIN (SELECT DISTINCT c_id FROM filt_x) fx ON fx.c_id = c.id
),
-- which sims to consider per cohort (intersect with filtered sims seen in filt_x)
cohort_required AS (
  SELECT cl.id AS cohort_id,
         ARRAY(
           SELECT DISTINCT s FROM unnest(cl.simulation_ids) s
           WHERE EXISTS (SELECT 1 FROM filt_x fx WHERE fx.c_id = cl.id AND fx.simulation_id = s)
         ) AS sim_ids
  FROM cohort_list cl
),
-- per profile × cohort: which simulations they passed at least once
student_passes AS (
  SELECT
    fx.c_id        AS cohort_id,
    fx.profile_id,
    fx.simulation_id,
    MAX((fx.passed)::int)::int AS passed_any
  FROM filt_x fx
  GROUP BY fx.c_id, fx.profile_id, fx.simulation_id
),
-- student has passed ALL required sims for that cohort
students_passed_all AS (
  SELECT
    sp.cohort_id,
    sp.profile_id,
    CASE
      WHEN cr.sim_ids IS NULL OR cardinality(cr.sim_ids)=0 THEN 0
      ELSE (
        SELECT CASE
                 WHEN COUNT(*) = cardinality(cr.sim_ids) THEN 1 ELSE 0
               END
        FROM unnest(cr.sim_ids) s
        JOIN LATERAL (
          SELECT 1 FROM student_passes sp2
          WHERE sp2.cohort_id = sp.cohort_id
            AND sp2.profile_id = sp.profile_id
            AND sp2.simulation_id = s
            AND sp2.passed_any = 1
          LIMIT 1
        ) ok ON true
      )
    END AS passed_all
  FROM (SELECT DISTINCT cohort_id, profile_id FROM student_passes) sp
  JOIN cohort_required cr ON cr.cohort_id = sp.cohort_id
),
-- attempt-level per cohort
cohort_attempts AS (
  SELECT
    fx.c_id AS cohort_id,
    fx.attempt_id,
    MAX((fx.passed)::int)::int      AS passed_any,
    AVG(fx.grade_percent)::float    AS avg_grade_attempt
  FROM filt_x fx
  GROUP BY fx.c_id, fx.attempt_id
),
-- per cohort × simulation (facts)
cohort_sim AS (
  SELECT
    fx.c_id AS cohort_id,
    fx.simulation_id,
    MAX((fx.passed)::int)::int   AS passed_any,
    AVG(fx.grade_percent)::float AS avg_grade_attempt,
    COUNT(DISTINCT fx.attempt_id) AS attempts
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
-- per cohort overall (no styling, no insights)
cohort_agg AS (
  SELECT
    cl.id                                        AS cohort_id,
    cl.title                                     AS cohort_name,
    COALESCE(cardinality(cl.profile_ids), 0)     AS total_students_declared,
    (SELECT COUNT(DISTINCT profile_id) FROM filt_x WHERE c_id = cl.id) AS total_students_seen,
    COUNT(DISTINCT ca.attempt_id)                AS total_attempts,
    SUM(passed_any)::int                         AS passed_attempts,
    (100.0 * AVG(passed_any))::float             AS pass_rate_attempts,
    AVG(ca.avg_grade_attempt)::float             AS avg_percentage_score,
    (SELECT COUNT(*) FROM students_passed_all spa
      WHERE spa.cohort_id = cl.id AND spa.passed_all = 1) AS passed_students,
    /*  ⬆️ removed the second total_students_seen here */
    (SELECT a2.rubric_points
       FROM analytics a2
      WHERE a2.chat_id IN (SELECT chat_id FROM filt_x WHERE c_id = cl.id)
      GROUP BY a2.rubric_id, a2.rubric_points
      ORDER BY COUNT(*) DESC
      LIMIT 1)                                   AS rubric_points,
    (SELECT a2.rubric_pass_points
       FROM analytics a2
      WHERE a2.chat_id IN (SELECT chat_id FROM filt_x WHERE c_id = cl.id)
      GROUP BY a2.rubric_id, a2.rubric_pass_points
      ORDER BY COUNT(*) DESC
      LIMIT 1)                                   AS rubric_pass_points
  FROM cohort_list cl
  LEFT JOIN cohort_attempts ca ON ca.cohort_id = cl.id
  GROUP BY cl.id, cl.title, cl.profile_ids
),
cohort_rows AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'id',                 cohort_id::text,
             'name',               cohort_name,
             'passRate',           ROUND(COALESCE(
               (100.0 * NULLIF(passed_students,0) / NULLIF(total_students_seen,0))::float, 
               pass_rate_attempts
             ))::int,
             'avgPercentageScore', ROUND(COALESCE(avg_percentage_score,0))::int,
             'totalStudents',      GREATEST(total_students_declared, total_students_seen),
             'passedStudents',     (SELECT COUNT(*) FROM (
                                      SELECT 1
                                      FROM filt_x fx2
                                      WHERE fx2.c_id = cohort_id
                                      GROUP BY fx2.profile_id
                                      HAVING MAX((fx2.passed)::int) = 1
                                    ) s),
             'totalAttempts',      COALESCE(total_attempts,0),
             'passedAttempts',     COALESCE(passed_attempts,0),
             'rubricPoints',       COALESCE(rubric_points, 0),
             'rubricPassPoints',   COALESCE(rubric_pass_points, 0)
           )
           ORDER BY cohort_name
         ) AS payload
  FROM cohort_agg
),
-- daily series (overall)
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
  SELECT jsonb_agg(jsonb_build_object('date', date, 'avgScore', ROUND(avg_score)::int)) AS payload
  FROM daily
),
-- daily × simulation for client-side filters
daily_sim AS (
  SELECT
    to_char(date_trunc('day', fx.chat_created_at), 'MM/DD') AS date,
    fx.simulation_id,
    AVG(fx.grade_percent)::float AS avg_score
  FROM filt_x fx
  WHERE fx.grade_percent IS NOT NULL
  GROUP BY 1, 2
  ORDER BY 1, 2
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
cohort_facts AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'cohortId',     cohort_id::text,
             'simulationId', simulation_id::text,
             'passRate',     ROUND(COALESCE(pass_rate_attempts,0))::int,
             'avgScore',     ROUND(COALESCE(avg_percentage_score,0))::int,
             'attempts',     COALESCE(total_attempts,0)
           )
           ORDER BY cohort_id, simulation_id
         ) AS payload
  FROM cohort_sim_agg
),
valid_sim_ids AS (
  SELECT jsonb_agg(DISTINCT f.simulation_id::text ORDER BY f.simulation_id::text) AS payload
  FROM filt f
  WHERE f.simulation_id IS NOT NULL
)
SELECT jsonb_build_object(
  'cohortData',         COALESCE((SELECT payload FROM cohort_rows), '[]'::jsonb),
  'dailyData',          COALESCE((SELECT payload FROM daily_rows), '[]'::jsonb),
  'cohortFacts',        COALESCE((SELECT payload FROM cohort_facts), '[]'::jsonb),
  'dailyFacts',         COALESCE((SELECT payload FROM daily_facts), '[]'::jsonb),
  'validSimulationIds', COALESCE((SELECT payload FROM valid_sim_ids), '[]'::jsonb)
);
$$;
