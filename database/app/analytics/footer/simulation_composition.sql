-- Simulation Composition (RAW)
-- Params: start, end, cohortIds, roles, simulationFilters, profileId
-- Returns:
-- {
--   validSimulationIds: string[],
--   simulationFacts: [{
--     simulationId, title, avgScore, completionRate, totalAttempts, scenarioCount
--   }],
--   simulationParameterFactsCategorical: [{
--     simulationId, parameterId, parameterItemId, scenarioCount
--   }],
--   simulationParameterFactsNumeric: [{
--     simulationId, parameterId, avgLevel, levelLabel, scenarioCount
--   }],
--   hasData: boolean
-- }
CREATE OR REPLACE FUNCTION analytics_simulation_composition_fn(
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
-- sims and scenarios that actually appear in the filtered window
sim_seen AS (
  SELECT DISTINCT b.simulation_id
  FROM base b
  WHERE b.simulation_id IS NOT NULL
),
scen_seen AS (
  SELECT DISTINCT b.scenario_id
  FROM base b
  WHERE b.scenario_id IS NOT NULL
),
-- per-simulation performance facts (from attempts)
sim_summary AS (
  SELECT
    b.simulation_id,
    AVG(b.grade_percent)::float                      AS avg_score,
    (100.0 * AVG((b.passed)::int))::float           AS pass_rate,
    (100.0 * AVG((b.completed OR b.grade_percent IS NOT NULL)::int))::float AS completion_rate,
    COUNT(*)::int                                   AS attempts
  FROM base b
  WHERE b.grade_percent IS NOT NULL
  GROUP BY b.simulation_id
),
-- scenario count per simulation restricted to scenarios seen in this window
sim_scenarios_seen AS (
  SELECT s.id AS simulation_id,
         COUNT(DISTINCT sc.id)::int AS scenario_count
  FROM simulations s
  JOIN scenarios sc ON sc.id = ANY (s.scenario_ids)
  JOIN scen_seen ss ON ss.scenario_id = sc.id
  WHERE s.active = TRUE AND sc.active = TRUE
  GROUP BY s.id
),
-- categorical parameter composition per simulation (count of scenarios having the item)
sim_param_items_seen AS (
  SELECT
    s.id AS simulation_id,
    p.id AS parameter_id,
    pi.id AS parameter_item_id,
    COUNT(DISTINCT sc.id)::int AS cnt
  FROM simulations s
  JOIN scenarios sc ON sc.id = ANY (s.scenario_ids)
  JOIN scen_seen ss      ON ss.scenario_id = sc.id
  JOIN parameter_items pi ON pi.id = ANY (sc.parameter_item_ids)
  JOIN parameters p       ON p.id = pi.parameter_id AND p.numerical = FALSE
  WHERE s.active = TRUE AND sc.active = TRUE
  GROUP BY s.id, p.id, pi.id
),
-- numeric parameter composition per simulation (avg across scenarios seen)
sim_param_nums_seen AS (
  SELECT
    s.id AS simulation_id,
    p.id AS parameter_id,
    AVG(pi.value::numeric) AS avg_level,
    COUNT(DISTINCT sc.id)::int AS cnt
  FROM simulations s
  JOIN scenarios sc ON sc.id = ANY (s.scenario_ids)
  JOIN scen_seen ss      ON ss.scenario_id = sc.id
  JOIN parameter_items pi ON pi.id = ANY (sc.parameter_item_ids)
  JOIN parameters p       ON p.id = pi.parameter_id AND p.numerical = TRUE
  WHERE s.active = TRUE AND sc.active = TRUE
  GROUP BY s.id, p.id
),
-- ids list for quick client filtering
valid_sim_ids AS (
  SELECT jsonb_agg(DISTINCT b.simulation_id::text ORDER BY b.simulation_id::text) AS payload
  FROM base b
  WHERE b.simulation_id IS NOT NULL
),
-- per-sim rolled facts for list & sorting
simulation_facts AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'simulationId',  s.id::text,
             'title',         s.title,
             'avgScore',      COALESCE(ROUND(ss.avg_score), 0)::int,
             'passRate',      COALESCE(ROUND(ss.pass_rate), 0)::int,
             'completionRate',COALESCE(ROUND(ss.completion_rate), 0)::int,
             'totalAttempts', COALESCE(ss.attempts, 0),
             'scenarioCount', COALESCE(sc_seen.scenario_count, 0)
           )
           ORDER BY s.title
         ) AS payload
  FROM simulations s
  LEFT JOIN sim_summary       ss      ON ss.simulation_id = s.id
  LEFT JOIN sim_scenarios_seen sc_seen ON sc_seen.simulation_id = s.id
  WHERE s.active = TRUE
    AND s.id IN (SELECT simulation_id FROM sim_seen)
),
-- categorical composition facts
param_facts_cat AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'simulationId',     simulation_id::text,
             'parameterId',      parameter_id::text,
             'parameterItemId',  parameter_item_id::text,
             'scenarioCount',    cnt
           )
         ) AS payload
  FROM sim_param_items_seen
),
-- numeric composition facts
param_facts_num AS (
  SELECT jsonb_agg(
           jsonb_build_object(
             'simulationId',  simulation_id::text,
             'parameterId',   parameter_id::text,
             'avgLevel',      avg_level,
             'levelLabel',    CASE
                                WHEN avg_level = floor(avg_level) THEN (avg_level::int)::text
                                ELSE to_char(avg_level, 'FM999D0')
                              END,
             'scenarioCount', cnt
           )
         ) AS payload
  FROM sim_param_nums_seen
)
SELECT jsonb_build_object(
  'validSimulationIds',                 COALESCE((SELECT payload FROM valid_sim_ids), '[]'::jsonb),
  'simulationFacts',                    COALESCE((SELECT payload FROM simulation_facts), '[]'::jsonb),
  'simulationParameterFactsCategorical',COALESCE((SELECT payload FROM param_facts_cat), '[]'::jsonb),
  'simulationParameterFactsNumeric',    COALESCE((SELECT payload FROM param_facts_num), '[]'::jsonb),
  'hasData',                            EXISTS (SELECT 1 FROM sim_summary)
);
$$;
