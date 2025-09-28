CREATE OR REPLACE FUNCTION analytics_home_overview_fn(
  p_start           timestamptz,
  p_end             timestamptz,
  p_cohort_ids      uuid[],          -- optional filter
  p_roles           profile_role[],  -- optional filter
  p_sim_filters     text[],          -- optional filter: ['general','practice','archived']
  p_profile_id      uuid             -- TA view if set; Instructional/Admin if NULL
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH
-- ---------------- Simulation meta (title/desc/time/rubric/num_scenarios)
sim_meta AS (
  SELECT
    s.id                           AS simulation_id,
    s.title                        AS simulation_title,
    s.description                  AS simulation_description,
    s.time_limit,
    s.rubric_id,
    COALESCE(cardinality(s.scenario_ids),0) AS num_scenarios,
    r.points                       AS rubric_points,
    r.pass_points                  AS rubric_pass_points,
    -- filter by sim type flags (practice/general). 'archived' is attempt-level, keep sims.
    CASE WHEN p_sim_filters IS NULL THEN TRUE
         ELSE (('practice'  = ANY (p_sim_filters) AND s.practice_simulation = TRUE)
            OR  ('general'   = ANY (p_sim_filters) AND s.practice_simulation = FALSE)
            OR  ('archived'  = ANY (p_sim_filters))) END AS sim_kind_ok
  FROM simulations s
  JOIN rubrics r ON r.id = s.rubric_id
),
-- ---------------- Pick a representative persona color/icon for a sim (from its scenarios)
sim_persona_meta AS (
  SELECT
    sm.simulation_id,
    (ARRAY_AGG(p.color  ORDER BY cnt DESC, COALESCE(p.color,'') DESC))[1] AS color,
    (ARRAY_AGG(p.icon   ORDER BY cnt DESC, COALESCE(p.icon,'')  DESC))[1] AS icon
  FROM (
    SELECT
      s.id AS simulation_id,
      sc.persona_id,
      COUNT(*) AS cnt
    FROM simulations s
    LEFT JOIN LATERAL unnest(s.scenario_ids) AS sid(scenario_id) ON TRUE
    LEFT JOIN scenarios sc ON sc.id = sid.scenario_id
    GROUP BY s.id, sc.persona_id
  ) sm
  LEFT JOIN personas p ON p.id = sm.persona_id
  GROUP BY sm.simulation_id
),
-- ---------------- Cohort membership exploded & filtered by cohorts/roles
cohort_membership AS (
  SELECT
    c.id    AS cohort_id,
    c.title AS cohort_title,
    sids.simulation_id,
    pids.profile_id
  FROM cohorts c
  JOIN LATERAL unnest(c.simulation_ids) AS sids(simulation_id) ON TRUE
  JOIN LATERAL unnest(c.profile_ids)    AS pids(profile_id)    ON TRUE
  LEFT JOIN profiles pr ON pr.id = pids.profile_id
  WHERE (p_cohort_ids IS NULL OR c.id = ANY (p_cohort_ids))
    AND (p_roles      IS NULL OR pr.role = ANY (p_roles))
),
-- ---------------- Analytics slice (time/roles/sim kind/selected cohorts)
filt AS (
  SELECT a.*
  FROM analytics a
  WHERE a.chat_created_at >= p_start
    AND a.chat_created_at <  p_end
    AND (p_roles IS NULL OR a.profile_role = ANY (p_roles))
    AND (
      p_sim_filters IS NULL OR (
         ('general'  = ANY (p_sim_filters) AND a.is_general)  OR
         ('practice' = ANY (p_sim_filters) AND a.is_practice) OR
         ('archived' = ANY (p_sim_filters) AND a.is_archived)
      )
    )
    AND (p_cohort_ids IS NULL OR a.cohort_ids && p_cohort_ids)
),
-- ---------------- Per-attempt progression + recency
attempt_progress AS (
  SELECT
    attempt_id,
    profile_id,
    simulation_id,
    COUNT(DISTINCT scenario_id) FILTER (WHERE completed) AS completed_root_scenarios,
    AVG(grade_percent) FILTER (WHERE completed)          AS avg_score_completed,
    BOOL_OR(passed)                                      AS any_passed_attempt,
    MAX(chat_created_at)                                 AS last_time
  FROM filt
  GROUP BY attempt_id, profile_id, simulation_id
),
latest_attempt_per_profile_sim AS (
  SELECT DISTINCT ON (profile_id, simulation_id)
         profile_id, simulation_id, attempt_id,
         completed_root_scenarios, any_passed_attempt, last_time
  FROM attempt_progress
  ORDER BY profile_id, simulation_id, last_time DESC
),
-- ---------------- Activity by (profile, simulation) to derive status + num sessions
activity_by_profile_sim AS (
  SELECT
    profile_id,
    simulation_id,
    COUNT(DISTINCT chat_id) AS chats,
    BOOL_OR(passed)         AS any_passed
  FROM filt
  GROUP BY profile_id, simulation_id
),

/* ========================== TA VIEW ========================== */
ta_sim_space AS (
  -- sims the TA is part of: cohorts include TA OR TA has activity
  SELECT DISTINCT m.simulation_id
  FROM cohort_membership m
  WHERE p_profile_id IS NOT NULL AND m.profile_id = p_profile_id
  UNION
  SELECT DISTINCT f.simulation_id
  FROM filt f
  WHERE p_profile_id IS NOT NULL AND f.profile_id = p_profile_id
),
ta_rows AS (
  SELECT
    jsonb_build_object(
      'viewMode',              'ta',
      'id',                    s.simulation_id::text,
      'simulationTitle',       s.simulation_title,
      'simulationDescription', s.simulation_description,
      'simulationName',        s.simulation_title,   -- alias kept for your client
      'timeLimit',             s.time_limit,
      'numSessions',           s.num_scenarios,                                 -- NEW: mirror scenarios count
      'highestScore',          (
                                 SELECT ROUND(MAX(ap.avg_score_completed))::int
                                 FROM attempt_progress ap
                                 WHERE ap.profile_id = p_profile_id
                                   AND ap.simulation_id = s.simulation_id
                               ),
      'rubric_id',             s.rubric_id::text,
      'color',                 spm.color,
      'icon',                  spm.icon,
      'hasPassed',             COALESCE(aps.any_passed, false),
      'passRate',              CASE WHEN s.rubric_points > 0
                                    THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points)::int
                                    ELSE NULL END,                             -- NEW: always provide passRate
      'status',                CASE
                                 WHEN COALESCE(aps.any_passed,false) THEN 'passed'
                                 WHEN COALESCE(aps.chats,0) > 0       THEN 'in-progress'
                                 ELSE 'not-started'
                               END,
      'completionPct',         COALESCE((
                                 SELECT ROUND(
                                          100.0 * lap.completed_root_scenarios::numeric
                                          / GREATEST(s.num_scenarios,1)
                                        )::int
                                 FROM latest_attempt_per_profile_sim lap
                                 WHERE lap.profile_id = p_profile_id
                                   AND lap.simulation_id = s.simulation_id
                               ), 0),
      'passedCount',           NULL,
      'inProgressCount',       NULL,
      'notStartedCount',       NULL,
      'passPct',               CASE WHEN s.rubric_points > 0
                                    THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points)::int
                                    ELSE NULL END,
      'cohortName',            (
                                 SELECT (ARRAY_AGG(DISTINCT c.cohort_title ORDER BY c.cohort_title))[1]
                                 FROM cohort_membership c
                                 WHERE c.simulation_id = s.simulation_id AND c.profile_id = p_profile_id
                               )
    ) AS item
  FROM sim_meta s
  LEFT JOIN sim_persona_meta spm ON spm.simulation_id = s.simulation_id
  LEFT JOIN activity_by_profile_sim aps
         ON aps.profile_id = p_profile_id
        AND aps.simulation_id = s.simulation_id
  WHERE p_profile_id IS NOT NULL
    AND s.sim_kind_ok
    AND EXISTS (SELECT 1 FROM ta_sim_space t WHERE t.simulation_id = s.simulation_id)
),
ta_payload AS (
  SELECT jsonb_build_object(
           'mode',    'ta',
           'hasData', EXISTS(SELECT 1 FROM ta_rows),
           'items',   COALESCE((SELECT jsonb_agg(item ORDER BY (item->>'simulationTitle')) FROM ta_rows), '[]'::jsonb)
         ) AS payload
  WHERE p_profile_id IS NOT NULL
),

/* ======================= INSTRUCTIONAL VIEW ======================= */
inst_counts AS (
  -- counts by simulation over cohort members (filtered by p_cohort_ids/p_roles)
  SELECT
    m.simulation_id,
    COUNT(DISTINCT m.profile_id) AS total_members,
    COUNT(DISTINCT CASE WHEN aps.any_passed THEN m.profile_id END) AS passed_count,
    COUNT(DISTINCT CASE WHEN NOT aps.any_passed AND aps.chats > 0 THEN m.profile_id END)
      AS in_progress_count
  FROM cohort_membership m
  LEFT JOIN activity_by_profile_sim aps
    ON aps.profile_id   = m.profile_id
   AND aps.simulation_id = m.simulation_id
  GROUP BY m.simulation_id
),
inst_rows AS (
  SELECT
    jsonb_build_object(
      'viewMode',              'instructional',
      'id',                    s.simulation_id::text,
      'simulationTitle',       s.simulation_title,
      'simulationDescription', s.simulation_description,
      'simulationName',        s.simulation_title,      -- alias
      'timeLimit',             s.time_limit,
      'numSessions',           s.num_scenarios,                                -- NEW: mirror scenarios count
      'highestScore',          NULL,                                             -- instructional: unset
      'rubric_id',             s.rubric_id::text,
      'color',                 spm.color,
      'icon',                  spm.icon,
      'hasPassed',             CASE
                                 WHEN COALESCE(ic.total_members,0) > 0
                                      AND COALESCE(ic.passed_count,0) = ic.total_members
                                 THEN true ELSE false END,                      -- NEW: all members passed?
      'passRate',              CASE WHEN s.rubric_points > 0
                                    THEN ROUND(100.0 * s.rubric_pass_points::numeric / s.rubric_points)::int
                                    ELSE NULL END,                             -- NEW: rubric pass %
      'status',                CASE
                                 WHEN COALESCE(ic.total_members,0) > 0
                                      AND COALESCE(ic.passed_count,0) = ic.total_members
                                   THEN 'passed'
                                 WHEN COALESCE(ic.passed_count,0) > 0
                                      OR COALESCE(ic.in_progress_count,0) > 0
                                   THEN 'in-progress'
                                 ELSE 'not-started'
                               END,                                             -- NEW: computed status
      'completionPct',         CASE
                                 WHEN COALESCE(ic.total_members,0) > 0
                                 THEN ROUND(
                                   100.0 * (COALESCE(ic.passed_count,0) + COALESCE(ic.in_progress_count,0))::numeric
                                   / ic.total_members
                                 )::int
                                 ELSE 0
                               END,                                             -- NEW: completion percentage
      'passedCount',           COALESCE(ic.passed_count, 0),
      'inProgressCount',       COALESCE(ic.in_progress_count, 0),
      'notStartedCount',       GREATEST(COALESCE(ic.total_members,0)
                                  - COALESCE(ic.passed_count,0)
                                  - COALESCE(ic.in_progress_count,0), 0),
      'passPct',               NULL,                                             -- TA-only field
      'cohortName',            NULL                                              -- could be many; leave NULL
    ) AS item
  FROM sim_meta s
  JOIN inst_counts ic            ON ic.simulation_id = s.simulation_id
  LEFT JOIN sim_persona_meta spm ON spm.simulation_id = s.simulation_id
  WHERE p_profile_id IS NULL
    AND s.sim_kind_ok
),
inst_payload AS (
  SELECT jsonb_build_object(
           'mode',    'instructional',
           'hasData', EXISTS(SELECT 1 FROM inst_rows),
           'items',   COALESCE((SELECT jsonb_agg(item ORDER BY (item->>'simulationTitle')) FROM inst_rows), '[]'::jsonb)
         ) AS payload
  WHERE p_profile_id IS NULL
)

SELECT COALESCE(
         (SELECT payload FROM ta_payload),
         (SELECT payload FROM inst_payload),
         jsonb_build_object('mode','empty','hasData',false,'items','[]'::jsonb)
       );
$$;