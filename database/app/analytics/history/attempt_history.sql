-- Attempt History (UI-ready)
-- Same parameter signature as your header functions so callers can keep reusing filters.
-- Returns one row per attempt with everything the table needs.

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
-- one simulation per attempt (by design attempts belong to a single simulation)
attempts_in_scope AS (
  SELECT DISTINCT f.attempt_id, f.simulation_id
  FROM filt f
),
-- expected count + attempt/sim metadata
expected AS (
  SELECT
    ascp.attempt_id,
    ascp.simulation_id,
    sa.profile_id,
    sa.archived                         AS attempt_archived,
    sa.infinite_mode,
    sa.infinite_mode_time_limit,
    CASE
      WHEN sa.infinite_mode THEN NULL
      ELSE COALESCE(array_length(s.scenario_ids, 1), 0)
    END AS expected_count,
    s.title                             AS simulation_title
  FROM attempts_in_scope ascp
  JOIN simulation_attempts sa ON sa.id = ascp.attempt_id
  JOIN simulations        s  ON s.id  = ascp.simulation_id
),
-- graded/completion + personas + dates from MV
per_attempt AS (
  SELECT
    f.attempt_id,
    MIN(f.chat_created_at)                                 AS first_chat_at,  -- "date of the attempt"
    MAX(f.chat_created_at)                                 AS last_activity_at,
    COUNT(*) FILTER (WHERE f.completed AND f.grade_percent IS NOT NULL) AS completed_with_grade,
    -- Nullable average score across graded chats only (as requested)
    AVG(f.grade_percent)                                   AS avg_grade_percent_nullable,
    -- Distinct scenario roots seen in this attempt
    ARRAY(
      SELECT DISTINCT f2.scenario_id
      FROM filt f2 WHERE f2.attempt_id = f.attempt_id
    )                                                      AS scenario_ids,
    -- Distinct persona ids/names/colors in this attempt
    ARRAY(
      SELECT DISTINCT f3.persona_id
      FROM filt f3 WHERE f3.attempt_id = f.attempt_id AND f3.persona_id IS NOT NULL
    )                                                      AS persona_ids,
    ARRAY(
      SELECT DISTINCT p.name
      FROM filt f4
      JOIN personas p ON p.id = f4.persona_id
      WHERE f4.attempt_id = f.attempt_id AND f4.persona_id IS NOT NULL
    )                                                      AS persona_names,
    ARRAY(
      SELECT DISTINCT p2.color
      FROM filt f5
      JOIN personas p2 ON p2.id = f5.persona_id
      WHERE f5.attempt_id = f.attempt_id AND f5.persona_id IS NOT NULL
    )                                                      AS persona_colors
  FROM filt f
  GROUP BY f.attempt_id
),
-- stitch everything with profile / simulation labels
joined AS (
  SELECT
    e.attempt_id,
    e.simulation_id,
    e.simulation_title,
    e.profile_id,
    (pr.first_name || ' ' || pr.last_name)                 AS profile_name,
    e.expected_count,
    e.infinite_mode,
    e.infinite_mode_time_limit,
    e.attempt_archived,

    p.first_chat_at,
    p.last_activity_at,
    p.completed_with_grade,
    p.avg_grade_percent_nullable,
    p.scenario_ids,
    p.persona_ids,
    p.persona_names,
    p.persona_colors
  FROM expected e
  JOIN per_attempt p ON p.attempt_id = e.attempt_id
  JOIN profiles  pr  ON pr.id = e.profile_id
)
SELECT jsonb_build_object(
  'hasData', EXISTS(SELECT 1 FROM joined),
  'rows',
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          -- ids for filtering
          'attemptId',              j.attempt_id::text,
          'simulationId',           j.simulation_id::text,
          'scenarioIds',            j.scenario_ids,

          -- who/what/when
          'profileId',              j.profile_id::text,
          'profileName',            j.profile_name,
          'simulationTitle',        j.simulation_title,
          'attemptDate',            to_char(j.first_chat_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
          'lastActivityAt',         to_char(j.last_activity_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'),

          -- personas shown as badges
          'personaIds',             COALESCE(j.persona_ids, ARRAY[]::uuid[]),
          'personaNames',           COALESCE(j.persona_names, ARRAY[]::text[]),
          'personaColors',          COALESCE(j.persona_colors, ARRAY[]::text[]),

          -- scenario completion (table shows "x / y completed")
          'completedCount',         COALESCE(j.completed_with_grade, 0),
          'expectedCount',          j.expected_count,             -- NULL => infinite mode

          -- score: nullable average across graded chats only (rounded 0..100)
          'scorePercent',           CASE
                                      WHEN j.avg_grade_percent_nullable IS NULL THEN NULL
                                      ELSE ROUND(j.avg_grade_percent_nullable)::int
                                    END,

          -- action buttons: Continue if (not archived) AND ((infinite) OR (expected known and completed < expected))
          'showContinue',           (NOT j.attempt_archived) AND (
                                      j.infinite_mode
                                      OR (j.expected_count IS NOT NULL AND COALESCE(j.completed_with_grade,0) < j.expected_count)
                                    ),
          'showView',               (NOT j.attempt_archived),

          -- attempt meta
          'infiniteMode',           COALESCE(j.infinite_mode, false),
          'infiniteModeTimeLimit',  j.infinite_mode_time_limit,
          'archived',               j.attempt_archived
        )
        ORDER BY j.last_activity_at DESC
      ),
      '[]'::jsonb
    )
);
$$;