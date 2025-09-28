-- Practice Overview (per-user, no cohorts; timeLimit always null)
CREATE OR REPLACE FUNCTION analytics_practice_overview_fn(
  p_start      timestamptz,
  p_end        timestamptz,
  p_cohort_ids uuid[],          -- not used for practice
  p_roles      profile_role[],  -- not used for practice
  p_sim_filters text[],         -- not used for practice
  p_profile_id uuid             -- required: whose practice view is this?
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH
-- 1) Simulation meta (practice only)
sim_meta AS (
  SELECT
    s.id                            AS simulation_id,
    s.title                         AS simulation_title,
    s.description                   AS simulation_description,
    /* force infinite-time in payload */
    NULL::int                       AS time_limit,
    s.rubric_id,
    COALESCE(cardinality(s.scenario_ids),0) AS num_scenarios,
    r.points                        AS rubric_points,
    r.pass_points                   AS rubric_pass_points
  FROM simulations s
  JOIN rubrics r ON r.id = s.rubric_id
  WHERE s.active = TRUE
    AND s.practice_simulation = TRUE
),

-- 2) Representative persona color/icon from scenarios for each sim
sim_persona_meta AS (
  SELECT
    sm.simulation_id,
    (ARRAY_AGG(p.color ORDER BY cnt DESC, COALESCE(p.color,'') DESC))[1] AS color,
    (ARRAY_AGG(p.icon  ORDER BY cnt DESC, COALESCE(p.icon,'')  DESC))[1] AS icon
  FROM (
    SELECT
      s.id AS simulation_id,
      sc.persona_id,
      COUNT(*) AS cnt
    FROM simulations s
    LEFT JOIN LATERAL unnest(s.scenario_ids) AS sid(scenario_id) ON TRUE
    LEFT JOIN scenarios sc ON sc.id = sid.scenario_id
    WHERE s.practice_simulation = TRUE
    GROUP BY s.id, sc.persona_id
  ) sm
  LEFT JOIN personas p ON p.id = sm.persona_id
  GROUP BY sm.simulation_id
),

-- 3) Analytics slice for THIS user, practice only, time-bounded
filt AS (
  SELECT a.*
  FROM analytics a
  WHERE a.profile_id = p_profile_id
    AND a.is_practice = TRUE
    AND a.chat_created_at >= p_start
    AND a.chat_created_at <  p_end
),

-- 4) Per-attempt progression for this user
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

-- 5) Latest attempt per (profile, simulation)
latest_attempt_per_profile_sim AS (
  SELECT DISTINCT ON (profile_id, simulation_id)
         profile_id, simulation_id, attempt_id,
         completed_root_scenarios, any_passed_attempt, last_time
  FROM attempt_progress
  ORDER BY profile_id, simulation_id, last_time DESC
),

-- 6) Activity by (profile, simulation) for status/chats
activity_by_profile_sim AS (
  SELECT
    profile_id,
    simulation_id,
    COUNT(DISTINCT chat_id) AS chats,
    BOOL_OR(passed)         AS any_passed
  FROM filt
  GROUP BY profile_id, simulation_id
),

-- 7) Final rows: all practice sims, enriched with user's progress
rows AS (
  SELECT
    jsonb_build_object(
      'viewMode',              'practice',
      'id',                    sm.simulation_id::text,
      'simulationTitle',       sm.simulation_title,
      'simulationDescription', sm.simulation_description,
      'simulationName',        sm.simulation_title,
      'timeLimit',             NULL,                                  -- always null for practice
      'numSessions',           sm.num_scenarios,                       -- mirror scenarios count
      'highestScore',          (
                                 SELECT ROUND(MAX(ap.avg_score_completed))::int
                                 FROM attempt_progress ap
                                 WHERE ap.profile_id   = p_profile_id
                                   AND ap.simulation_id = sm.simulation_id
                               ),
      'rubric_id',             sm.rubric_id::text,
      'color',                 spm.color,
      'icon',                  spm.icon,
      'hasPassed',             COALESCE(aps.any_passed, false),
      'passRate',              CASE
                                 WHEN sm.rubric_points > 0
                                   THEN ROUND(100.0 * sm.rubric_pass_points::numeric / sm.rubric_points)::int
                                 ELSE NULL
                               END,
      'status',                CASE
                                 WHEN COALESCE(aps.any_passed,false) THEN 'passed'
                                 WHEN COALESCE(aps.chats,0) > 0      THEN 'in-progress'
                                 ELSE 'not-started'
                               END,
      'completionPct',         COALESCE((
                                 SELECT ROUND(
                                          100.0 * lap.completed_root_scenarios::numeric
                                          / GREATEST(sm.num_scenarios,1)
                                        )::int
                                 FROM latest_attempt_per_profile_sim lap
                                 WHERE lap.profile_id   = p_profile_id
                                   AND lap.simulation_id = sm.simulation_id
                               ), 0),

      -- fields that made sense only for cohorts are omitted or null
      'passedCount',           NULL,
      'inProgressCount',       NULL,
      'notStartedCount',       NULL,
      'passPct',               NULL,
      'cohortName',            NULL
    ) AS item
  FROM sim_meta sm
  LEFT JOIN sim_persona_meta spm
         ON spm.simulation_id = sm.simulation_id
  LEFT JOIN activity_by_profile_sim aps
         ON aps.profile_id    = p_profile_id
        AND aps.simulation_id = sm.simulation_id
)

SELECT jsonb_build_object(
         'mode',    'practice',
         'hasData', EXISTS(SELECT 1 FROM rows),
         'items',   COALESCE((SELECT jsonb_agg(item ORDER BY (item->>'simulationTitle')) FROM rows), '[]'::jsonb)
       );
$$;
