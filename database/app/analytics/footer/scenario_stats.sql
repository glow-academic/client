-- Scenario Stats (numerical, raw)
-- Params: start, end, cohortIds, roles, simulationFilters, profileId
-- Returns:
-- {
--   validNumericParameterIds: string[],         -- numerical params with attempts in the window
--   numericAttemptFacts: [{                      -- aggregated by parameter + level
--     parameterId, levelLabel, levelValue, score, attempts
--   }],
--   numericScenarioFacts: [{                     -- scenario→level topology (filtered to scenarios seen)
--     parameterId, scenarioId, levelLabel, levelValue
--   }]
-- }

CREATE OR REPLACE FUNCTION analytics_scenario_stats_fn(
  p_start        timestamptz,
  p_end          timestamptz,
  p_cohort_ids   uuid[],
  p_roles        profile_role[],
  p_sim_filters  text[],
  p_profile_id   uuid
) RETURNS jsonb
LANGUAGE sql STABLE AS $$
WITH base AS (
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
nums AS (
  SELECT id
  FROM parameters
  WHERE active = TRUE AND numerical = TRUE
),
num_map AS (
  SELECT s.id AS scenario_id, pi.parameter_id, pi.value::numeric AS level
  FROM scenarios s
  JOIN parameter_items pi ON pi.id = ANY (s.parameter_item_ids)
  JOIN nums n ON n.id = pi.parameter_id
  WHERE s.active = TRUE
),
scenario_seen AS (
  SELECT DISTINCT b.scenario_id FROM base b WHERE b.scenario_id IS NOT NULL
),
num_map_seen AS (
  SELECT nm.*
  FROM num_map nm
  JOIN scenario_seen ss ON ss.scenario_id = nm.scenario_id
),
attempts AS (
  SELECT
    nms.parameter_id,
    nms.level,
    b.grade_percent::float AS score
  FROM base b
  JOIN num_map_seen nms ON nms.scenario_id = b.scenario_id
  WHERE b.grade_percent IS NOT NULL
),
levels AS (
  SELECT
    parameter_id,
    CASE WHEN level = floor(level) THEN level::int::text ELSE to_char(level,'FM999D0') END AS level_label,
    CASE WHEN level = floor(level) THEN level::numeric ELSE round(level::numeric, 1) END    AS level_value,
    score
  FROM attempts
),
agg AS (
  SELECT parameter_id, level_label, level_value,
         AVG(score)::float AS avg_score,
         COUNT(*)::int     AS attempts
  FROM levels
  GROUP BY parameter_id, level_label, level_value
),
valid_params AS (
  SELECT DISTINCT parameter_id FROM levels
),
valid_param_ids AS (
  SELECT jsonb_agg(parameter_id::text ORDER BY parameter_id::text) AS payload
  FROM valid_params
),
attempt_facts AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'parameterId', parameter_id::text,
             'levelLabel',  level_label,
             'levelValue',  level_value,
             'score',       ROUND(avg_score)::int,
             'attempts',    attempts
           )
         ) AS payload
  FROM agg
),
scenario_facts AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'parameterId', parameter_id::text,
             'scenarioId',  scenario_id::text,
             'levelLabel',  CASE WHEN level = floor(level) THEN level::int::text ELSE to_char(level,'FM999D0') END,
             'levelValue',  CASE WHEN level = floor(level) THEN level::numeric ELSE round(level::numeric, 1) END
           )
         ) AS payload
  FROM (SELECT DISTINCT * FROM num_map_seen) d
)
SELECT jsonb_build_object(
  'validNumericParameterIds', COALESCE((SELECT payload FROM valid_param_ids), '[]'::jsonb),
  'numericAttemptFacts',      COALESCE((SELECT payload FROM attempt_facts), '[]'::jsonb),
  'numericScenarioFacts',      COALESCE((SELECT payload FROM scenario_facts), '[]'::jsonb)
);
$$;