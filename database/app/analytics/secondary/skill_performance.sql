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
  WHERE a.chat_created_at > p_start
    AND a.chat_created_at < GREATEST(p_end, now())
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
-- 1) per grade × group totals
per_grade_group AS (
  SELECT
    lg.rubric_id,
    st.group_id,
    st.group_name,
    fb.simulation_id,
    lg.grade_id,
    SUM(fb.earned) AS score,
    SUM(st.points) AS points
  FROM latest_grade lg
  JOIN fb ON fb.simulation_id = lg.chat_id    -- keep your join shape consistent with latest_grade
  JOIN st ON st.standard_id = fb.standard_id AND st.rubric_id = lg.rubric_id
  GROUP BY lg.rubric_id, st.group_id, st.group_name, fb.simulation_id, lg.grade_id
),
-- 2) convert to per-grade percentage
per_grade_pct AS (
  SELECT
    rubric_id, group_id, group_name, simulation_id, grade_id,
    CASE WHEN points > 0 THEN 100.0 * score / points ELSE NULL END AS pct
  FROM per_grade_group
),
-- 3) radar = avg of per-grade pct
radar_per_rubric AS (
  SELECT
    rubric_id,
    jsonb_agg(
      jsonb_build_object(
        'metric',   group_name,
        'value',    GREATEST(0, LEAST(1, AVG(pct)/100.0)),
        'fullMark', 1,
        'score',    COALESCE(SUM(score),0),   -- optional, or drop if misleading
        'points',   COALESCE(SUM(points),0)
      )
      ORDER BY group_name
    ) AS radar
  FROM per_grade_group
  JOIN per_grade_pct USING (rubric_id, group_id, group_name, simulation_id, grade_id)
  GROUP BY rubric_id
),
-- 4) facts by (group, simulation) still fine, but consider reporting avg pct too
facts_per_rubric AS (
  SELECT
    rubric_id,
    jsonb_agg(
      jsonb_build_object(
        'groupId',      group_id::text,
        'groupName',    group_name,
        'simulationId', simulation_id::text,
        'score',        COALESCE(SUM(score),0),
        'points',       COALESCE(SUM(points),0),
        'avgPct',       ROUND(AVG(pct))::int
      )
    ) AS facts
  FROM per_grade_group
  JOIN per_grade_pct USING (rubric_id, group_id, group_name, simulation_id, grade_id)
  GROUP BY rubric_id
),
valid_rubrics AS (
  SELECT DISTINCT rubric_id FROM per_grade_group
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
