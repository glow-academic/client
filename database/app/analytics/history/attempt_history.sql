-- Attempt History Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData and rows array of attempt-level data

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
-- distinct attempt/simulation pairs in scope
attempt_sim AS (
  SELECT DISTINCT attempt_id, simulation_id
  FROM filt
),
-- expected count + infinite flags from base tables
expected AS (
  SELECT
    asim.attempt_id,
    asim.simulation_id,
    sa.infinite_mode,
    sa.infinite_mode_time_limit,
    CASE
      WHEN sa.infinite_mode THEN NULL
      ELSE COALESCE(array_length(s.scenario_ids, 1), 0)
    END AS expected_count
  FROM attempt_sim asim
  JOIN simulation_attempts sa ON sa.id = asim.attempt_id
  JOIN simulations        s  ON s.id  = asim.simulation_id
),
-- aggregate per attempt from MV
per_attempt AS (
  SELECT
    f.attempt_id,
    ARRAY(SELECT DISTINCT f2.simulation_id FROM filt f2 WHERE f2.attempt_id = f.attempt_id) AS simulation_ids,
    ARRAY(SELECT DISTINCT f3.scenario_id   FROM filt f3 WHERE f3.attempt_id = f.attempt_id) AS scenario_ids,
    ARRAY(SELECT DISTINCT f4.persona_id    FROM filt f4 WHERE f4.attempt_id = f.attempt_id AND f4.persona_id IS NOT NULL) AS persona_ids,
    ARRAY(SELECT DISTINCT f5.persona_color FROM filt f5 WHERE f5.attempt_id = f.attempt_id AND f5.persona_color IS NOT NULL) AS persona_colors,
    AVG(f.grade_percent)::float                                                   AS avg_grade_percent,                -- ignores NULL
    SUM( ((f.grade_percent)/100.0) * f.rubric_points )::int                       AS total_score_points,               -- ignores NULL grade_percent
    COUNT(*) FILTER (WHERE f.completed)                                           AS completed_count,
    MAX(f.chat_created_at)                                                        AS last_activity_at
  FROM filt f
  GROUP BY f.attempt_id
),
joined AS (
  SELECT
    p.attempt_id,
    p.simulation_ids,
    p.scenario_ids,
    p.persona_ids,
    p.persona_colors,
    p.avg_grade_percent,
    p.total_score_points,
    p.completed_count,
    e.expected_count,
    e.infinite_mode,
    e.infinite_mode_time_limit,
    p.last_activity_at
  FROM per_attempt p
  LEFT JOIN expected e
    ON e.attempt_id = p.attempt_id
)
SELECT jsonb_build_object(
  'hasData', EXISTS(SELECT 1 FROM joined),
  'rows',
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'attemptId',            j.attempt_id::text,
          'simulationIds',        j.simulation_ids,
          'scenarioIds',          j.scenario_ids,
          'personaIds',           j.persona_ids,
          'personaColors',        j.persona_colors,
          'avgGradePercent',      ROUND(COALESCE(j.avg_grade_percent,0))::int,
          'totalScorePoints',     COALESCE(j.total_score_points, 0),
          'completedCount',       j.completed_count,
          'expectedCount',        j.expected_count,
          'infiniteMode',         COALESCE(j.infinite_mode, false),
          'infiniteModeTimeLimit',j.infinite_mode_time_limit,
          'lastActivityAt',       to_char(j.last_activity_at, 'YYYY-MM-DD"T"HH24:MI:SSOF')
        )
        ORDER BY j.last_activity_at DESC
      ),
      '[]'::jsonb
    )
);
$$;
