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
     OR (b.cohort_ids && pr.cohort_ids OR b.profile_cohort_ids && pr.cohort_ids)
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
    cardinality(cl.profile_ids) AS total_students_seen,
    COUNT(DISTINCT ca.attempt_id)                AS total_attempts,
    SUM(passed_any)::int                         AS passed_attempts,
    (100.0 * AVG(passed_any))::float             AS pass_rate_attempts,
    AVG(ca.avg_grade_attempt)::float             AS avg_percentage_score,
    (SELECT COUNT(*) FROM (
      SELECT profile_id
      FROM filt_x fx2
      WHERE fx2.c_id = cl.id
      GROUP BY profile_id
      HAVING 
        -- Student must have attempted all simulations in the cohort
        COUNT(DISTINCT simulation_id) = cardinality(cl.simulation_ids)
        -- AND have at least one attempt ≥80% in EACH simulation
        AND NOT EXISTS (
          SELECT 1 
          FROM (
            SELECT 
              simulation_id,
              MAX(CASE WHEN grade_percent IS NULL THEN 0 ELSE grade_percent END) as best_score
            FROM filt_x fx3 
            WHERE fx3.c_id = cl.id 
              AND fx3.profile_id = fx2.profile_id
            GROUP BY simulation_id
          ) sim_bests
          WHERE sim_bests.best_score < 80.0
        )
    ) s) AS passed_students,
    /*  ⬆️ removed the second total_students_seen here */
    cardinality(cl.simulation_ids)               AS simulation_count,
    cardinality(cl.simulation_ids)               AS required_simulations
  FROM cohort_list cl
  LEFT JOIN cohort_attempts ca ON ca.cohort_id = cl.id
  GROUP BY cl.id, cl.title, cl.profile_ids, cl.simulation_ids
),
cohort_rows AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'id',                 cohort_id::text,
             'name',               cohort_name,
             'passRate',           ROUND(
               CASE 
                 -- For individual profile, pass rate is either 0% or 100%
                 WHEN (SELECT profile_id FROM params) IS NOT NULL THEN
                   CASE 
                     WHEN passed_students > 0 THEN 100.0
                     ELSE 0.0
                   END
                 -- For cohort view, use percentage calculation
                 WHEN total_students_seen > 0 THEN (100.0 * passed_students / total_students_seen)::numeric
                 ELSE 0
               END::numeric, 2
             )::float,
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
             'simulationCount',     COALESCE(simulation_count, 0),
             'requiredSimulations', COALESCE(required_simulations, 0)
           )
           ORDER BY cohort_name
         ) AS payload
  FROM cohort_agg
),
-- daily series (cohort-specific)
daily AS (
  SELECT
    fx.c_id AS cohort_id,
    to_char(date_trunc('day', fx.chat_created_at), 'MM/DD') AS date,
    AVG(fx.grade_percent)::float AS avg_score
  FROM filt_x fx
  WHERE fx.grade_percent IS NOT NULL
  GROUP BY fx.c_id, 2
  ORDER BY fx.c_id, 2
),
daily_rows AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'cohortId', cohort_id::text,
      'date', date, 
      'avgScore', ROUND(avg_score)::int
    ) ORDER BY cohort_id, date
  ) AS payload
  FROM daily
),
-- daily × simulation for client-side filters (cohort-specific)
daily_sim AS (
  SELECT
    fx.c_id AS cohort_id,
    to_char(date_trunc('day', fx.chat_created_at), 'MM/DD') AS date,
    fx.simulation_id,
    AVG(fx.grade_percent)::float AS avg_score
  FROM filt_x fx
  WHERE fx.grade_percent IS NOT NULL
  GROUP BY fx.c_id, 2, 3
  ORDER BY fx.c_id, 2, 3
),
daily_facts AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'cohortId',    cohort_id::text,
             'date',        date,
             'simulationId', simulation_id::text,
             'avgScore',    ROUND(avg_score)::int
           ) ORDER BY cohort_id, date, simulation_id
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
