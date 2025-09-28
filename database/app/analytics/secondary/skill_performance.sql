-- Skill Performance Analytics Function
-- Parameters: start, end, cohortIds, roles, simulationFilters, profileId, rubricId (optional)
-- Returns: SkillPerformanceData JSON
CREATE OR REPLACE FUNCTION analytics_skill_performance_fn(
  p_start           timestamptz,
  p_end             timestamptz,
  p_cohort_ids      uuid[],
  p_roles           profile_role[],
  p_sim_filters     text[],
  p_profile_id      uuid,
  p_rubric_id       uuid
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
-- choose rubric: explicit param, otherwise default_rubric or first active
rubric_choice AS (
  SELECT
    COALESCE(p_rubric_id,
             (SELECT id FROM rubrics WHERE default_rubric = true LIMIT 1),
             (SELECT id FROM rubrics WHERE active = true LIMIT 1)
    ) AS rubric_id
),
-- latest grade per chat with grade_id so we can join feedback rows
latest_grade AS (
  SELECT DISTINCT ON (scg.simulation_chat_id)
         scg.id                         AS grade_id,
         scg.simulation_chat_id         AS chat_id,
         scg.rubric_id,
         scg.created_at
  FROM simulation_chat_grades scg
  ORDER BY scg.simulation_chat_id, scg.created_at DESC
),
-- feedback rows for chosen rubric + filtered chats
fb AS (
  SELECT
    scf.simulation_chat_feedback_id,
    scf.standard_id,
    scf.total::float AS earned
  FROM latest_grade lg
  JOIN filt f ON f.chat_id = lg.chat_id
  JOIN (SELECT rubric_id FROM rubric_choice) rc ON rc.rubric_id = lg.rubric_id
  JOIN simulation_chat_feedbacks scf ON scf.simulation_chat_grade_id = lg.grade_id
),
-- standards + groups for the chosen rubric
st AS (
  SELECT s.id AS standard_id, s.points, sg.id AS group_id, sg.name AS group_name
  FROM standards s
  JOIN standard_groups sg ON sg.id = s.standard_group_id
  JOIN rubric_choice rc ON rc.rubric_id = sg.rubric_id
),
-- aggregate to standard-group
group_scores AS (
  SELECT
    st.group_id,
    st.group_name,
    SUM(fb.earned)                      AS score,
    SUM(st.points)::float               AS points
  FROM st
  LEFT JOIN fb ON fb.standard_id = st.standard_id
  GROUP BY st.group_id, st.group_name
),
-- Per-simulation group scores for facts
group_scores_sim AS (
  SELECT
    st.group_id,
    st.group_name,
    f.simulation_id,
    SUM(fb.earned)        AS score,
    SUM(st.points)::float AS points
  FROM st
  LEFT JOIN fb f  ON f.standard_id = st.standard_id
  LEFT JOIN fb fb ON fb.standard_id = st.standard_id
  GROUP BY st.group_id, st.group_name, f.simulation_id
),
radar AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'metric',   group_name,
             'value',    CASE WHEN points > 0 THEN LEAST(1.0, GREATEST(0.0, score/points)) ELSE 0 END,
             'fullMark', 1,
             'score',    COALESCE(score,0),
             'points',   COALESCE(points,0)
           )
           ORDER BY group_name
         ) AS payload,
         AVG(CASE WHEN points > 0 THEN score/points ELSE NULL END) AS avg_ratio
  FROM group_scores
),
available_rubrics AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'id',          r.id::text,
             'name',        r.name,
             'description', r.description,
             'points',      r.points,
             'active',      r.active
           )
           ORDER BY r.name
         ) AS payload
  FROM rubrics r
  WHERE r.active = true
),
group_facts AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'groupId',      group_id::text,
             'groupName',    group_name,
             'simulationId', simulation_id::text,
             'score',        COALESCE(score,0),
             'points',       COALESCE(points,0)
           )
         ) AS payload
  FROM group_scores_sim
),
status AS (
  SELECT
    CASE
      WHEN (SELECT payload FROM radar) IS NULL THEN 'neutral'
      ELSE CASE
        WHEN (SELECT avg_ratio FROM radar) >= 0.85 THEN 'success'
        WHEN (SELECT avg_ratio FROM radar) >= 0.70 THEN 'warning'
        ELSE 'danger'
      END
    END AS skill_status
)
SELECT jsonb_build_object(
  'radarData',        COALESCE((SELECT payload FROM radar), '[]'::jsonb),
  'availableRubrics', COALESCE((SELECT payload FROM available_rubrics), '[]'::jsonb),
  'skillStatus',      (SELECT skill_status FROM status),
  'hasData',          EXISTS (SELECT 1 FROM fb),
  'groupFacts',       COALESCE((SELECT payload FROM group_facts), '[]'::jsonb)
);
$$;
