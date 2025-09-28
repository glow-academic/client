-- Skill Performance (raw, multi-rubric)
-- Params: start, end, cohortIds, roles, simulationFilters, profileId
-- Returns:
-- {
--   packages: [
--     {
--       rubricId,
--       radarData: [{ metric, value, fullMark, score, points }],
--       groupFacts: [{ groupId, groupName, simulationId, score, points }]
--     }, ...
--   ],
--   validRubricIds: string[]
-- }

CREATE OR REPLACE FUNCTION analytics_skill_performance_fn(
  p_start        timestamptz,
  p_end          timestamptz,
  p_cohort_ids   uuid[],
  p_roles        profile_role[],
  p_sim_filters  text[],
  p_profile_id   uuid
) RETURNS jsonb
LANGUAGE sql STABLE AS $$
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
-- latest grade per (chat, rubric)
latest_grade AS (
  SELECT DISTINCT ON (scg.simulation_chat_id, scg.rubric_id)
         scg.id                 AS grade_id,
         scg.simulation_chat_id AS chat_id,
         scg.rubric_id,
         scg.created_at
  FROM simulation_chat_grades scg
  ORDER BY scg.simulation_chat_id, scg.rubric_id, scg.created_at DESC
),
fb AS (
  SELECT
    scf.id              AS feedback_id,
    scf.standard_id,
    lg.rubric_id,
    f.simulation_id,
    scf.total::numeric  AS earned
  FROM latest_grade lg
  JOIN filt f ON f.chat_id = lg.chat_id
  JOIN simulation_chat_feedbacks scf ON scf.simulation_chat_grade_id = lg.grade_id
),
st AS (
  SELECT
    s.id              AS standard_id,
    s.points::numeric AS points,
    sg.id             AS group_id,
    sg.name           AS group_name,
    sg.rubric_id
  FROM standards s
  JOIN standard_groups sg ON sg.id = s.standard_group_id
),
group_scores AS (
  SELECT
    st.rubric_id,
    st.group_id,
    st.group_name,
    SUM(fb.earned) AS score,
    SUM(st.points) AS points
  FROM st
  JOIN fb ON fb.standard_id = st.standard_id AND fb.rubric_id = st.rubric_id
  GROUP BY st.rubric_id, st.group_id, st.group_name
),
group_scores_sim AS (
  SELECT
    st.rubric_id,
    st.group_id,
    st.group_name,
    fb.simulation_id,
    SUM(fb.earned) AS score,
    SUM(st.points) AS points
  FROM st
  JOIN fb ON fb.standard_id = st.standard_id AND fb.rubric_id = st.rubric_id
  GROUP BY st.rubric_id, st.group_id, st.group_name, fb.simulation_id
),
radar_per_rubric AS (
  SELECT
    rubric_id,
    jsonb_agg(
      jsonb_build_object(
        'metric',   group_name,
        'value',    CASE WHEN points > 0 THEN LEAST(1.0, GREATEST(0.0, score/points)) ELSE 0 END,
        'fullMark', 1,
        'score',    COALESCE(score,0),
        'points',   COALESCE(points,0)
      )
      ORDER BY group_name
    ) AS radar
  FROM group_scores
  GROUP BY rubric_id
),
facts_per_rubric AS (
  SELECT
    rubric_id,
    jsonb_agg(
      jsonb_build_object(
        'groupId',      group_id::text,
        'groupName',    group_name,
        'simulationId', simulation_id::text,
        'score',        COALESCE(score,0),
        'points',       COALESCE(points,0)
      )
    ) AS facts
  FROM group_scores_sim
  GROUP BY rubric_id
),
valid_rubrics AS (
  SELECT DISTINCT rubric_id FROM fb
),
valid_rubric_ids AS (
  SELECT jsonb_agg(rubric_id::text ORDER BY rubric_id::text) AS payload
  FROM valid_rubrics
),
packages AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'rubricId',  vr.rubric_id::text,
             'radarData', COALESCE(rpr.radar, '[]'::jsonb),
             'groupFacts',COALESCE(fpr.facts, '[]'::jsonb)
           )
           ORDER BY vr.rubric_id::text
         ) AS payload
  FROM valid_rubrics vr
  LEFT JOIN radar_per_rubric rpr ON rpr.rubric_id = vr.rubric_id
  LEFT JOIN facts_per_rubric fpr ON fpr.rubric_id = vr.rubric_id
)
SELECT jsonb_build_object(
  'packages',       COALESCE((SELECT payload FROM packages), '[]'::jsonb),
  'validRubricIds', COALESCE((SELECT payload FROM valid_rubric_ids), '[]'::jsonb)
);
$$;
