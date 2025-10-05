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
WITH
-- 0) Filtered analytics: narrow columns, index-friendly end bound
filt AS MATERIALIZED (
  SELECT chat_id, simulation_id, cohort_ids, profile_cohort_ids, profile_role,
         is_general, is_practice, is_archived, profile_id, chat_created_at
  FROM analytics a
  WHERE a.chat_created_at >= p_start
    AND a.chat_created_at < p_end
    AND (p_cohort_ids IS NULL OR (a.cohort_ids && p_cohort_ids OR a.profile_cohort_ids && p_cohort_ids))
    AND (p_cohort_ids IS NOT NULL OR p_roles IS NULL OR a.profile_role = ANY(p_roles)
         OR (p_profile_id IS NOT NULL AND a.profile_id = p_profile_id))
    AND (p_sim_filters IS NULL OR cardinality(p_sim_filters) > 0)
    AND (
      p_sim_filters IS NULL OR (
        ('general'  = ANY (p_sim_filters) AND a.is_general)  OR
        ('practice' = ANY (p_sim_filters) AND a.is_practice) OR
        ('archived' = ANY (p_sim_filters) AND a.is_archived)
      )
    )
    AND (p_profile_id IS NULL OR a.profile_id = p_profile_id)
),

-- 1) Latest grade per (chat, rubric); no join to filt yet
latest_grade AS MATERIALIZED (
  SELECT DISTINCT ON (scg.simulation_chat_id, scg.rubric_id)
         scg.id                 AS grade_id,
         scg.simulation_chat_id AS chat_id,
         scg.rubric_id,
         scg.created_at
  FROM simulation_chat_grades scg
  ORDER BY scg.simulation_chat_id, scg.rubric_id, scg.created_at DESC
),

-- 2) Per-grade × group totals (score/points) restricted to filtered chats.
--    Compute pct here to avoid a second pass. Use float8 for corr/avg performance.
per_grade_group AS MATERIALIZED (
  SELECT
    lg.rubric_id,
    sg.id             AS group_id,
    sg.name           AS group_name,
    f.simulation_id,
    lg.grade_id       AS grade_id,
    SUM(scf.total)::float8              AS score,
    SUM(s.points)::float8               AS points,
    CASE WHEN SUM(s.points) > 0
         THEN 100.0 * SUM(scf.total)::float8 / SUM(s.points)::float8
         ELSE NULL
    END                                 AS pct
  FROM latest_grade lg
  JOIN filt f
    ON f.chat_id = lg.chat_id
  JOIN simulation_chat_feedbacks scf
    ON scf.simulation_chat_grade_id = lg.grade_id
  JOIN standards s
    ON s.id = scf.standard_id
  JOIN standard_groups sg
    ON sg.id = s.standard_group_id AND sg.rubric_id = lg.rubric_id
  GROUP BY lg.rubric_id, sg.id, sg.name, f.simulation_id, lg.grade_id
),

-- 3) Radar rows: avg pct per (rubric, standard) - using individual standard names
radar_rows AS MATERIALIZED (
  SELECT 
    pgg.rubric_id, 
    s.name AS standard_name,
    s.description AS standard_description,
    AVG(pgg.pct)::float8 AS avg_pct
  FROM per_grade_group pgg
  JOIN standards s ON s.standard_group_id = pgg.group_id
  GROUP BY pgg.rubric_id, s.name, s.description
),

radar_per_rubric AS MATERIALIZED (
  SELECT
    rubric_id,
    jsonb_agg(
      jsonb_build_object(
        'metric',   standard_name,
        'description', standard_description,
        'value',    GREATEST(0, LEAST(1, COALESCE(avg_pct,0)/100.0)),
        'fullMark', 1
      )
      ORDER BY standard_name
    ) AS radar
  FROM radar_rows
  GROUP BY rubric_id
),

-- 4) Facts by (rubric, standard, simulation) - using individual standards
group_stats AS MATERIALIZED (
  SELECT
    pgg.rubric_id,
    s.id AS standard_id,
    s.name AS standard_name,
    s.description AS standard_description,
    pgg.simulation_id,
    SUM(pgg.score)  AS score_sum,
    SUM(pgg.points) AS points_sum,
    ROUND(AVG(pgg.pct))::int AS avg_pct
  FROM per_grade_group pgg
  JOIN standards s ON s.standard_group_id = pgg.group_id
  GROUP BY pgg.rubric_id, s.id, s.name, s.description, pgg.simulation_id
),

facts_per_rubric AS MATERIALIZED (
  SELECT
    rubric_id,
    jsonb_agg(
      jsonb_build_object(
        'standardId',      standard_id::text,
        'standardName',    standard_name,
        'standardDescription', standard_description,
        'simulationId',    simulation_id::text,
        'score',           COALESCE(score_sum,0),
        'points',          COALESCE(points_sum,0),
        'avgPct',          COALESCE(avg_pct,0)
      )
      ORDER BY standard_name, simulation_id
    ) AS facts
  FROM group_stats
  GROUP BY rubric_id
),

valid_rubrics AS MATERIALIZED (
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
