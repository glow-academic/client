CREATE OR REPLACE FUNCTION analytics_home_overview_fn(
  p_start           timestamptz,
  p_end             timestamptz,
  p_cohort_ids      uuid[],          -- optional filter
  p_roles           profile_role[],  -- optional filter
  p_sim_filters     text[],          -- optional filter: ['general','practice','archived']
  p_profile_id      uuid             -- TA view if set; Instructor/Admin view if NULL
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
/*
  Minimal Home-page payload builder on top of the `analytics` MV.

  ASSUMPTIONS about `analytics` (per your other functions):
    - chat_created_at           timestamptz
    - cohort_ids                uuid[]
    - profile_id                uuid
    - profile_role              profile_role
    - simulation_id             uuid
    - attempt_id                uuid
    - completed                 boolean
    - grade_percent             int or numeric (0..100)
    - passed                    boolean
    - is_general/is_practice/is_archived boolean

  DESIGN:
    1) Filter once to the relevant rows (WITH filt AS …).
    2) Compute per-attempt averages (completed chats only), per (attempt_id, profile_id, simulation_id).
    3) From per-attempt rows, pick the best attempt per (profile_id, simulation_id) by avg_score DESC, then freshest.
    4) Branch:
        - TA view (p_profile_id NOT NULL):
            aggregate to per-simulation rows with highestScore and hasPassed for that user, plus cohortIds seen.
        - Instructor/Admin view (p_profile_id IS NULL):
            produce per-(simulationId, cohortId) arrays of passed/inProgress profileIds (based on best attempt flag).
*/
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
/* Per-attempt average across completed chats (fallback to NULL when none completed) */
attempt_scores AS (
  SELECT
    attempt_id,
    profile_id,
    simulation_id,
    AVG(grade_percent) FILTER (WHERE completed)        AS avg_score,     -- per attempt
    BOOL_OR(passed)  FILTER (WHERE passed IS NOT NULL) AS any_passed,    -- per attempt
    MAX(chat_created_at)                               AS last_time
  FROM filt
  GROUP BY attempt_id, profile_id, simulation_id
),
/* Choose best attempt per (profile, simulation):
   - highest avg_score first (NULL last via COALESCE 0)
   - then most recent */
best_per_user_sim AS (
  SELECT DISTINCT ON (profile_id, simulation_id)
         profile_id,
         simulation_id,
         COALESCE(avg_score, 0)::float  AS best_score,
         COALESCE(any_passed, false)    AS passed,
         last_time
  FROM attempt_scores
  ORDER BY profile_id, simulation_id, COALESCE(avg_score,0) DESC, last_time DESC
),
/* Map (profile_id, simulation_id) -> the cohort_ids seen in this window */
per_user_sim_cohorts AS (
  SELECT
    f.profile_id,
    f.simulation_id,
    unnest(f.cohort_ids) AS cohort_id
  FROM filt f
  GROUP BY f.profile_id, f.simulation_id, unnest(f.cohort_ids)
),
/* TA view slice */
ta_view AS (
  SELECT jsonb_build_object(
           'mode', 'ta',
           'simulations',
           COALESCE(
             (
               SELECT jsonb_agg(
                        jsonb_build_object(
                          'simulationId', b.simulation_id::text,
                          'cohortIds',    COALESCE(c.cohort_ids, '{}'::uuid[])::text[],
                          'highestScore', ROUND(MAX(b.best_score))::int,
                          'hasPassed',    BOOL_OR(b.passed)
                        )
                        ORDER BY b.simulation_id
                      )
               FROM best_per_user_sim b
               LEFT JOIN (
                 SELECT
                   s.simulation_id,
                   s.profile_id,
                   array_agg(DISTINCT s.cohort_id) AS cohort_ids
                 FROM per_user_sim_cohorts s
                 GROUP BY s.simulation_id, s.profile_id
               ) c
                 ON c.simulation_id = b.simulation_id
                AND c.profile_id    = b.profile_id
             ),
             '[]'::jsonb
           )
         ) AS payload
  WHERE p_profile_id IS NOT NULL
),
/* Instructor/Admin: derive (simulationId, cohortId) -> arrays of profileIds by pass status.
   We do this by joining chosen-best attempts to the cohort memberships visible in filt. */
sim_cohort_members AS (
  SELECT
    b.simulation_id,
    s.cohort_id,
    b.profile_id,
    b.passed
  FROM best_per_user_sim b
  JOIN per_user_sim_cohorts s
    ON s.simulation_id = b.simulation_id
   AND s.profile_id    = b.profile_id
),
instructor_view AS (
  SELECT jsonb_build_object(
           'mode', 'instructor',
           'bySimulationCohort',
           COALESCE(
             (
               SELECT jsonb_agg(
                        jsonb_build_object(
                          'simulationId', m.simulation_id::text,
                          'cohortId',     m.cohort_id::text,
                          'passedProfileIds',
                            (SELECT COALESCE(array_agg(x.profile_id::text ORDER BY x.profile_id), '{}') 
                               FROM sim_cohort_members x
                              WHERE x.simulation_id = m.simulation_id
                                AND x.cohort_id     = m.cohort_id
                                AND x.passed = true),
                          'inProgressProfileIds',
                            (SELECT COALESCE(array_agg(x.profile_id::text ORDER BY x.profile_id), '{}')
                               FROM sim_cohort_members x
                              WHERE x.simulation_id = m.simulation_id
                                AND x.cohort_id     = m.cohort_id
                                AND (x.passed = false OR x.passed IS NULL))
                        )
                        ORDER BY m.simulation_id, m.cohort_id
                      )
               FROM (
                 SELECT DISTINCT simulation_id, cohort_id
                 FROM sim_cohort_members
               ) m
             ),
             '[]'::jsonb
           )
         ) AS payload
  WHERE p_profile_id IS NULL
)
SELECT COALESCE(
         (SELECT payload FROM ta_view),
         (SELECT payload FROM instructor_view),
         jsonb_build_object('mode','empty')
       );
$$;
