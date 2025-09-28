-- Attempt History (UI-ready) — OLD computation semantics preserved + rubric pass threshold
CREATE OR REPLACE FUNCTION analytics_attempt_history_fn(
  p_start           timestamptz,
  p_end             timestamptz,
  p_cohort_ids      uuid[],
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
attempts_in_scope AS (
  SELECT DISTINCT f.attempt_id, f.simulation_id
  FROM filt f
),
expected AS (
  SELECT
    ascp.attempt_id,
    ascp.simulation_id,
    sa.profile_id,
    sa.archived                           AS attempt_archived,
    sa.infinite_mode,
    sa.infinite_mode_time_limit,
    CASE
      WHEN sa.infinite_mode THEN NULL
      ELSE COALESCE(array_length(s.scenario_ids, 1), 0)
    END                                   AS expected_count,
    s.title                               AS simulation_title,
    s.scenario_ids                        AS scenario_ids_assigned,
    s.practice_simulation                 AS practice_simulation,
    s.rubric_id                           AS rubric_id,
    r.points                              AS rubric_points,
    r.pass_points                         AS rubric_pass_points,
    CASE
      WHEN r.points IS NULL OR r.points = 0 THEN NULL
      ELSE ROUND((r.pass_points::numeric / r.points::numeric) * 100.0)::int
    END                                   AS pass_pct
  FROM attempts_in_scope ascp
  JOIN simulation_attempts sa ON sa.id = ascp.attempt_id
  JOIN simulations        s  ON s.id  = ascp.simulation_id
  LEFT JOIN rubrics       r  ON r.id  = s.rubric_id
),
per_attempt AS (
  SELECT
    f.attempt_id,
    MIN(f.chat_created_at) AS first_chat_at,
    MAX(f.chat_created_at) AS last_activity_at,
    COUNT(*)               AS total_chats_in_attempt,
    -- OLD: completed + graded only
    COUNT(*) FILTER (WHERE f.completed AND f.grade_percent IS NOT NULL) AS completed_with_grade,
    -- Sum with zeros for missing grades
    SUM(COALESCE(f.grade_percent, 0)) AS sum_grade_percent_zero_fill
  FROM filt f
  GROUP BY f.attempt_id
),
joined AS (
  SELECT
    e.attempt_id,
    e.simulation_id,
    e.simulation_title,
    e.profile_id,
    (pr.first_name || ' ' || pr.last_name) AS profile_name,
    e.expected_count,
    e.infinite_mode,
    e.infinite_mode_time_limit,
    e.attempt_archived,
    e.scenario_ids_assigned,
    e.practice_simulation,
    e.rubric_id,
    e.rubric_points,
    e.rubric_pass_points,
    e.pass_pct,

    p.first_chat_at,
    p.last_activity_at,
    p.total_chats_in_attempt,
    p.completed_with_grade,
    p.sum_grade_percent_zero_fill
  FROM expected e
  JOIN per_attempt p ON p.attempt_id = e.attempt_id
  JOIN profiles  pr  ON pr.id = e.profile_id
),
final_rows AS (
  SELECT
    j.*,
    CASE
      WHEN j.infinite_mode THEN GREATEST(j.total_chats_in_attempt, 1)
      ELSE COALESCE(j.expected_count, 0)
    END AS denom_for_score,
    CASE
      WHEN j.completed_with_grade = 0 THEN NULL
      ELSE ROUND(
             j.sum_grade_percent_zero_fill
             / NULLIF(
                 CASE
                   WHEN j.infinite_mode THEN GREATEST(j.total_chats_in_attempt, 1)
                   ELSE COALESCE(j.expected_count, 0)
                 END, 0
               )
           )::int
    END AS score_percent_old_semantics
  FROM joined j
)
SELECT jsonb_build_object(
  'hasData', EXISTS(SELECT 1 FROM final_rows),
  'rows',
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          -- ids for filtering
          'attemptId',               fr.attempt_id::text,
          'simulationId',            fr.simulation_id::text,
          'scenarioIds',             fr.scenario_ids_assigned,

          -- who/what/when
          'profileId',               fr.profile_id::text,
          'profileName',             fr.profile_name,
          'simulationTitle',         fr.simulation_title,
          'attemptDate',             to_char(fr.first_chat_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
          'lastActivityAt',          to_char(fr.last_activity_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),

          -- personas (optional to fill later)
          'personaIds',              ARRAY[]::uuid[],
          'personaNames',            ARRAY[]::text[],
          'personaColors',           ARRAY[]::text[],

          -- completion + score (OLD semantics)
          'completedCount',          COALESCE(fr.completed_with_grade, 0),
          'expectedCount',           fr.expected_count,           -- NULL => infinite
          'scorePercent',            fr.score_percent_old_semantics,

          -- rubric / pass info for UI
          'rubricId',                fr.rubric_id::text,
          'rubricPoints',            fr.rubric_points,
          'rubricPassPoints',        fr.rubric_pass_points,
          'passPct',                 fr.pass_pct,                  -- 👈 feed this to UI instead of hard-coded 70
          'practiceSimulation',      COALESCE(fr.practice_simulation, false),

          -- actions
          'showContinue',            (NOT fr.attempt_archived) AND (
                                        fr.infinite_mode
                                        OR (fr.expected_count IS NOT NULL
                                            AND COALESCE(fr.completed_with_grade,0) < fr.expected_count)
                                      ),
          'showView',                (NOT fr.attempt_archived),

          -- attempt meta
          'infiniteMode',            COALESCE(fr.infinite_mode, false),
          'infiniteModeTimeLimit',   fr.infinite_mode_time_limit,
          'archived',                fr.attempt_archived
        )
        ORDER BY fr.last_activity_at DESC
      ),
      '[]'::jsonb
    )
);
$$;