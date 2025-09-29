-- Scenario Performance (categorical, raw)
-- Params: start, end, cohortIds, roles, simulationFilters, profileId
-- Returns:
-- {
--   validParameterIds: string[],                    -- non-numerical that appear in data
--   attributeAttemptFacts: [{                       -- daily attempt facts per parameter item
--     parameterId, parameterItemId, date, timestamp, avgScore, attempts, passedAttempts
--   }],
--   attributeScenarioFacts: [{                      -- topology for % usage & counts
--     parameterId, parameterItemId, scenarioId
--   }]
-- }

CREATE OR REPLACE FUNCTION analytics_scenario_performance_fn(
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
params AS (
  SELECT id
  FROM parameters
  WHERE active = TRUE AND numerical = FALSE
),
cat_map AS (
  SELECT pi.id AS parameter_item_id,
         pi.parameter_id,
         s.id  AS scenario_id
  FROM parameter_items pi
  JOIN params p ON p.id = pi.parameter_id
  JOIN scenarios s ON pi.id = ANY (s.parameter_item_ids)
  WHERE s.active = TRUE
),
-- limit topology to scenarios that actually appear in the filtered data
scenario_seen AS (
  SELECT DISTINCT b.scenario_id
  FROM base b
  WHERE b.scenario_id IS NOT NULL
),
cat_map_seen AS (
  SELECT cm.parameter_id, cm.parameter_item_id, cm.scenario_id
  FROM cat_map cm
  JOIN scenario_seen ss ON ss.scenario_id = cm.scenario_id
),
attempt_daily AS (
  SELECT
    cm.parameter_id,
    cm.parameter_item_id,
    to_char(date_trunc('day', b.chat_created_at),'YYYY-MM-DD') AS date,
    EXTRACT(EPOCH FROM date_trunc('day', b.chat_created_at))::bigint AS ts,
    AVG(b.grade_percent)::float   AS avg_score,
    COUNT(*)::int                 AS attempts,
    SUM((b.passed)::int)::int     AS passed_attempts
  FROM base b
  JOIN cat_map_seen cm ON cm.scenario_id = b.scenario_id
  WHERE b.grade_percent IS NOT NULL
  GROUP BY cm.parameter_id, cm.parameter_item_id, date_trunc('day', b.chat_created_at)
),
valid_params AS (
  SELECT DISTINCT parameter_id FROM cat_map_seen
),
valid_param_ids AS (
  SELECT jsonb_agg(parameter_id::text ORDER BY parameter_id::text) AS payload
  FROM valid_params
),
attr_attempt_facts AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'parameterId',     parameter_id::text,
             'parameterItemId', parameter_item_id::text,
             'date',            date,
             'timestamp',       ts,
             'avgScore',        ROUND(avg_score)::int,
             'attempts',        attempts,
             'passedAttempts',  passed_attempts
           )
         ) AS payload
  FROM attempt_daily
),
attr_scenario_facts AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'parameterId',     parameter_id::text,
             'parameterItemId', parameter_item_id::text,
             'scenarioId',      scenario_id::text
           )
         ) AS payload
  FROM (SELECT DISTINCT * FROM cat_map_seen) d
)
SELECT jsonb_build_object(
  'validParameterIds',      COALESCE((SELECT payload FROM valid_param_ids), '[]'::jsonb),
  'attributeAttemptFacts',  COALESCE((SELECT payload FROM attr_attempt_facts), '[]'::jsonb),
  'attributeScenarioFacts', COALESCE((SELECT payload FROM attr_scenario_facts), '[]'::jsonb)
);
$$;