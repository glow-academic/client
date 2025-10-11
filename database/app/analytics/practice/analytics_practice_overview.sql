-- Practice Overview (per-user, no cohorts; timeLimit always null)
CREATE OR REPLACE FUNCTION analytics_practice_overview_fn(
  p_start      timestamptz,
  p_end        timestamptz,
  p_cohort_ids uuid[],
  p_roles      profile_role[],
  p_sim_filters text[],
  p_profile_id uuid,
  p_department_ids uuid[]
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
    NULL::int                       AS time_limit,                -- ∞
    s.rubric_id,
    COALESCE((SELECT COUNT(*)::int FROM simulation_scenarios ss WHERE ss.simulation_id = s.id), 0) AS num_scenarios,
    r.points                        AS rubric_points,
    r.pass_points                   AS rubric_pass_points,
    s.updated_at                    AS updated_at                 -- keep for ordering
  FROM simulations s
  JOIN rubrics r ON r.id = s.rubric_id
  WHERE s.active = TRUE
    AND s.practice_simulation = TRUE
    AND (cardinality(p_department_ids) = 0 OR s.department_id = ANY(p_department_ids))
),

-- 2) Persona color/icon
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
    LEFT JOIN simulation_scenarios ss_link ON ss_link.simulation_id = s.id
    LEFT JOIN scenarios sc ON sc.id = ss_link.scenario_id
    WHERE s.practice_simulation = TRUE
      AND (cardinality(p_department_ids) = 0 OR s.department_id = ANY(p_department_ids))
    GROUP BY s.id, sc.persona_id
  ) sm
  LEFT JOIN personas p ON p.id = sm.persona_id
  GROUP BY sm.simulation_id
),

-- 3) All-time analytics slice (for highestScore/status - lifetime data)
filt_all AS (
  SELECT a.*
  FROM analytics a
  WHERE a.profile_id = p_profile_id
    AND a.is_practice = TRUE
    AND (cardinality(p_department_ids) = 0 OR a.department_id = ANY(p_department_ids))
),

-- 4) Per-attempt progression (completed-only average - lifetime data)
attempt_progress AS (
  SELECT
    attempt_id,
    profile_id,
    simulation_id,
    COUNT(DISTINCT scenario_id) FILTER (WHERE completed) AS completed_root_scenarios,
    AVG(grade_percent) FILTER (WHERE completed)          AS avg_score_completed,  -- lifetime best
    BOOL_OR(passed)                                      AS any_passed_attempt,
    MAX(chat_created_at)                                 AS last_time
  FROM filt_all
  GROUP BY attempt_id, profile_id, simulation_id
),

-- 5) Latest attempt per (profile, simulation) for completionPct
latest_attempt_per_profile_sim AS (
  SELECT DISTINCT ON (profile_id, simulation_id)
         profile_id, simulation_id, attempt_id,
         completed_root_scenarios, any_passed_attempt, last_time
  FROM attempt_progress
  ORDER BY profile_id, simulation_id, last_time DESC
),

-- 6) Activity by (profile, simulation) - lifetime data
activity_by_profile_sim AS (
  SELECT
    profile_id,
    simulation_id,
    COUNT(DISTINCT chat_id) AS chats,
    BOOL_OR(passed)         AS any_passed
  FROM filt_all
  GROUP BY profile_id, simulation_id
),

-- 7) Pass threshold (unchanged)
sim_pass_pct AS (
  SELECT s.id AS simulation_id,
         CASE WHEN r.points > 0
              THEN (r.pass_points::numeric / r.points::numeric) * 100.0
              ELSE 70 END AS pass_pct
  FROM simulations s
  JOIN rubrics r ON r.id = s.rubric_id
  WHERE s.practice_simulation = TRUE 
    AND s.active = TRUE
    AND (cardinality(p_department_ids) = 0 OR s.department_id = ANY(p_department_ids))
),

-- 8) Final items
rows AS (
  SELECT
    jsonb_build_object(
      'viewMode',              'practice',
      'id',                    sm.simulation_id::text,
      'simulationTitle',       sm.simulation_title,
      'simulationDescription', sm.simulation_description,
      'simulationName',        sm.simulation_title,
      'timeLimit',             NULL,
      'numSessions',           sm.num_scenarios,
      /* LIFETIME highest score: best completed-only attempt (no COALESCE to 0) */
      'highestScore',          (
                                 SELECT ROUND(MAX(ap.avg_score_completed))::int
                                 FROM attempt_progress ap
                                 WHERE ap.profile_id = p_profile_id
                                   AND ap.simulation_id = sm.simulation_id
                               ),
      'rubric_id',             sm.rubric_id::text,
      'color',                 spm.color,
      'icon',                  spm.icon,
      'hasPassed',             COALESCE((
                                 SELECT MAX(ap.avg_score_completed) >= spp.pass_pct
                                 FROM attempt_progress ap
                                 JOIN sim_pass_pct spp ON spp.simulation_id = ap.simulation_id
                                 WHERE ap.profile_id = p_profile_id AND ap.simulation_id = sm.simulation_id
                                 GROUP BY spp.pass_pct
                               ), false),
      'passRate',              CASE
                                 WHEN sm.rubric_points > 0
                                   THEN ROUND(100.0 * sm.rubric_pass_points::numeric / sm.rubric_points)::int
                                 ELSE NULL
                               END,
      'status',                CASE
                                 WHEN COALESCE((
                                        SELECT MAX(ap.avg_score_completed) >= spp.pass_pct
                                        FROM attempt_progress ap
                                        JOIN sim_pass_pct spp ON spp.simulation_id = ap.simulation_id
                                        WHERE ap.profile_id = p_profile_id AND ap.simulation_id = sm.simulation_id
                                        GROUP BY spp.pass_pct
                                      ), false) THEN 'passed'
                                 WHEN COALESCE(aps.chats, 0) > 0 THEN 'in-progress'
                                 ELSE 'not-started'
                               END,
      /* keep completionPct tied to the latest attempt vs. scenario count */
      'completionPct',         COALESCE((
                                 SELECT ROUND(
                                          100.0 * lap.completed_root_scenarios::numeric
                                          / GREATEST(sm.num_scenarios,1)
                                        )::int
                                 FROM latest_attempt_per_profile_sim lap
                                 WHERE lap.profile_id   = p_profile_id
                                   AND lap.simulation_id = sm.simulation_id
                               ), 0),
      'passedCount',           NULL,
      'inProgressCount',       NULL,
      'notStartedCount',       NULL,
      'passPct',               NULL,
      'cohortName',            NULL,
      'updatedAt',             sm.updated_at,
      /* NEW: expose for ordering & UI helpers */
      'lastActivityTs',        (
                                 SELECT MAX(ap.last_time) FROM attempt_progress ap
                                 WHERE ap.profile_id = p_profile_id AND ap.simulation_id = sm.simulation_id
                               ),
      'hasActivity',           (COALESCE(aps.chats,0) > 0)
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
         'items',
           COALESCE((
             SELECT jsonb_agg(item
               ORDER BY
                 /* General first */
                 ((item->>'simulationTitle') ILIKE 'general%') DESC,
                 /* then most-recently practiced (lifetime activity) */
                 (item->>'lastActivityTs')::timestamptz DESC NULLS LAST,
                 /* fallback: title alpha */
                 (item->>'simulationTitle')
             )
             FROM rows
           ), '[]'::jsonb)
       );
$$;