-- Session Efficiency Analytics Function
-- Parameters: startDate, endDate, cohortIds, roles, simulationFilters, profileId
-- Returns: JSON object with hasData, method, trendData, and dataPoints
-- Note: Uses TS formula: eff = clamp(0..100, avgScore * (1 - min(1, avgMinutes/120)))

CREATE OR REPLACE FUNCTION analytics_session_efficiency_fn(
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
  WHERE a.attempt_created_at > p_start
    AND a.attempt_created_at < GREATEST(p_end, now())
    AND (p_cohort_ids IS NULL OR (a.cohort_ids && p_cohort_ids AND a.profile_cohort_ids && p_cohort_ids))
    AND (p_cohort_ids IS NOT NULL OR p_roles IS NULL OR a.profile_role = ANY(p_roles) OR (p_profile_id IS NOT NULL AND a.profile_id = p_profile_id))
    AND (
      p_sim_filters IS NULL
      OR cardinality(p_sim_filters) > 0
    )
    AND (
      p_sim_filters IS NULL OR (
        ('general'  = ANY (p_sim_filters) AND a.is_general)  OR
        ('practice' = ANY (p_sim_filters) AND a.is_practice) OR
        ('archived' = ANY (p_sim_filters) AND a.is_archived)
      )
    )
    AND (p_profile_id IS NULL OR a.profile_id = p_profile_id)
),
per_attempt AS (
  SELECT
    attempt_id,
    MIN(attempt_created_at) AS attempt_created_at,
    COALESCE(MAX(sim_scenario_count), 0) AS expected_from_sim,
    COUNT(*) FILTER (WHERE completed) AS completed_chats,
    COUNT(*) AS chats_in_attempt,
    SUM(grade_percent) FILTER (WHERE grade_percent IS NOT NULL) AS sum_grade_percent
  FROM filt
  GROUP BY attempt_id
),
attempt_norm AS (
  SELECT
    attempt_id,
    attempt_created_at,
    GREATEST(expected_from_sim, chats_in_attempt) AS expected,
    completed_chats,
    CASE
      WHEN GREATEST(expected_from_sim, chats_in_attempt) > 0 AND completed_chats > 0
        THEN (sum_grade_percent / GREATEST(expected_from_sim, chats_in_attempt))
      ELSE NULL
    END AS norm
  FROM per_attempt
),
chat_durations AS (
  SELECT
    attempt_id,
    SUM(EXTRACT(epoch FROM (chat_completed_at - chat_created_at)))
      FILTER (WHERE chat_completed_at IS NOT NULL) AS total_secs,
    COUNT(*) FILTER (WHERE chat_completed_at IS NOT NULL) AS completed_cnt
  FROM filt
  GROUP BY attempt_id
),
by_day AS (
  SELECT
    to_char(an.attempt_created_at, 'YYYY-MM-DD') AS date,
    -- avgScore over attempts that started that day
    AVG(an.norm)::float AS avg_score,
    -- average minutes per session that day:
    COALESCE(SUM(cd.total_secs),0) / GREATEST(SUM(cd.completed_cnt),1) / 60.0 AS avg_minutes,
    COUNT(*)::int AS count
  FROM attempt_norm an
  LEFT JOIN chat_durations cd USING (attempt_id)
  GROUP BY 1
),
cur AS (
  SELECT 
    ROUND(GREATEST(0, LEAST(100, AVG(an.norm) * (1 - LEAST(1, COALESCE(SUM(cd.total_secs),0) / GREATEST(SUM(cd.completed_cnt),1) / 60.0 / 120.0)))))::int AS current_value,
    COUNT(*) > 0 AS has_data
  FROM attempt_norm an
  LEFT JOIN chat_durations cd USING (attempt_id)
  WHERE an.norm IS NOT NULL
),
data_points AS (
  SELECT jsonb_agg(jsonb_build_object(
           'profileId',    f.profile_id::text,
           'date',         to_char(an.attempt_created_at,'YYYY-MM-DD'),
           'value',        ROUND(GREATEST(0, LEAST(100, an.norm * (1 - LEAST(1, COALESCE(cd.total_secs,0) / GREATEST(cd.completed_cnt,1) / 60.0 / 120.0)))))::int,
           'simulationId', f.simulation_id::text,
           'scenarioId',   f.scenario_id::text
         ) ORDER BY f.profile_id, an.attempt_created_at) AS payload
  FROM attempt_norm an
  JOIN filt f ON f.attempt_id = an.attempt_id
  LEFT JOIN chat_durations cd ON cd.attempt_id = an.attempt_id
  WHERE an.norm IS NOT NULL
)
SELECT jsonb_build_object(
  'hasData',    COALESCE((SELECT has_data FROM cur), false),
  'method',     'avg',
  'trendData',  COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'date',  date,
                    'value', ROUND(GREATEST(0, LEAST(100, avg_score * (1 - LEAST(1, avg_minutes/120.0)))))::int,
                    'count', count
                  ) ORDER BY date)
                  FROM by_day), '[]'::jsonb),
  'dataPoints', COALESCE((SELECT payload FROM data_points), '[]'::jsonb)
);
$$;
