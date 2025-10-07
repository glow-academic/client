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
  p_profile_id   uuid,
  p_department_ids uuid[]
) RETURNS jsonb
LANGUAGE sql STABLE AS $$
/* -------- Params and flags -------- */
WITH params AS (
  SELECT
    COALESCE(p_cohort_ids, '{}')               AS cohort_ids,
    COALESCE(p_roles, '{}')                    AS roles,
    COALESCE(p_sim_filters, ARRAY['general'])  AS sim_filters,
    p_profile_id                               AS profile_id,
    p_start                                    AS start_at,
    p_end                                      AS end_at,
    'general'  = ANY (COALESCE(p_sim_filters, ARRAY['general'])) AS want_general,
    'practice' = ANY (COALESCE(p_sim_filters, ARRAY['practice'])) AS want_practice,
    'archived' = ANY (COALESCE(p_sim_filters, ARRAY['archived'])) AS want_archived
),
want AS (
  SELECT
    want_general, want_practice, want_archived,
    (want_general OR want_practice) AS want_nonarchived_or_any
  FROM params
),

/* -------- Base selection from analytics (chat date window) -------- */
base_general AS MATERIALIZED (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_general
    AND a.is_general = TRUE
    AND (cardinality(p_department_ids) = 0 OR a.department_id = ANY(p_department_ids))
    AND a.chat_created_at >= pr.start_at
    AND a.chat_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
base_practice AS MATERIALIZED (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_practice
    AND a.is_practice = TRUE
    AND (cardinality(p_department_ids) = 0 OR a.department_id = ANY(p_department_ids))
    AND a.chat_created_at >= pr.start_at
    AND a.chat_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
/* Handle case where we want only archived items (regardless of simulation type) */
base_archived_only AS MATERIALIZED (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_archived 
    AND NOT w.want_nonarchived_or_any
    AND (cardinality(p_department_ids) = 0 OR a.department_id = ANY(p_department_ids))
    AND a.attempt_created_at >= pr.start_at
    AND a.attempt_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
/* Handle case where we want archived items that are neither general nor practice */
base_archived_other AS MATERIALIZED (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_archived 
    AND w.want_nonarchived_or_any
    AND a.is_general = FALSE
    AND a.is_practice = FALSE
    AND (cardinality(p_department_ids) = 0 OR a.department_id = ANY(p_department_ids))
    AND a.attempt_created_at >= pr.start_at
    AND a.attempt_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
base_union AS MATERIALIZED (
  SELECT * FROM base_general
  UNION ALL
  SELECT * FROM base_practice
  UNION ALL
  SELECT * FROM base_archived_only
  UNION ALL
  SELECT * FROM base_archived_other
),

/* -------- Archived tri-state -------- */
base_archived AS MATERIALIZED (
  SELECT bu.*
  FROM base_union bu
  CROSS JOIN want w
  WHERE
    CASE
      WHEN w.want_archived AND w.want_nonarchived_or_any THEN TRUE
      WHEN w.want_archived AND NOT w.want_nonarchived_or_any THEN bu.is_archived = TRUE
      WHEN NOT w.want_archived AND w.want_nonarchived_or_any THEN bu.is_archived = FALSE
      ELSE FALSE
    END
),

/* -------- Cohort scoping (if passed) -------- */
cohort_scoped AS MATERIALIZED (
  SELECT b.*
  FROM base_archived b
  CROSS JOIN params pr
  WHERE cardinality(pr.cohort_ids) = 0
     OR (b.cohort_ids && pr.cohort_ids OR b.profile_cohort_ids && pr.cohort_ids)
),

base AS (
  SELECT * FROM cohort_scoped
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
-- categorical parameter composition per simulation (count of chats having the item)
sim_param_items_seen AS (
  SELECT
    s.id AS simulation_id,
    p.id AS parameter_id,
    pi.id AS parameter_item_id,
    COUNT(a.chat_id)::int AS cnt
  FROM simulations s
  JOIN scenarios sc ON sc.id = ANY (s.scenario_ids)
  JOIN scen_seen ss ON ss.scenario_id = sc.id
  JOIN parameter_items pi ON pi.id = ANY (sc.parameter_item_ids)
  JOIN parameters p ON p.id = pi.parameter_id AND p.numerical = FALSE
  JOIN analytics a ON a.scenario_id = sc.id
  WHERE s.active = TRUE AND sc.active = TRUE
  GROUP BY s.id, p.id, pi.id
),
-- numeric parameter composition per simulation (most common value across chats)
sim_param_nums_seen AS (
  SELECT
    s.id AS simulation_id,
    p.id AS parameter_id,
    pi.value::numeric AS most_common_level,
    COUNT(a.chat_id)::int AS chat_count
  FROM simulations s
  JOIN scenarios sc ON sc.id = ANY (s.scenario_ids)
  JOIN scen_seen ss ON ss.scenario_id = sc.id
  JOIN parameter_items pi ON pi.id = ANY (sc.parameter_item_ids)
  JOIN parameters p ON p.id = pi.parameter_id AND p.numerical = TRUE
  JOIN analytics a ON a.scenario_id = sc.id
  WHERE s.active = TRUE AND sc.active = TRUE
  GROUP BY s.id, p.id, pi.value
),
-- get the most frequent parameter value per simulation/parameter
sim_param_nums_most_common AS (
  SELECT
    simulation_id,
    parameter_id,
    most_common_level,
    chat_count,
    ROW_NUMBER() OVER (PARTITION BY simulation_id, parameter_id ORDER BY chat_count DESC, most_common_level DESC) as rn
  FROM sim_param_nums_seen
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
             'avgLevel',      most_common_level,
             'levelLabel',    CASE
                                WHEN most_common_level = floor(most_common_level) THEN (most_common_level::int)::text
                                ELSE to_char(most_common_level, 'FM999D0')
                              END,
             'scenarioCount', chat_count
           )
         ) AS payload
  FROM sim_param_nums_most_common
  WHERE rn = 1
)
SELECT jsonb_build_object(
  'validSimulationIds',                 COALESCE((SELECT payload FROM valid_sim_ids), '[]'::jsonb),
  'simulationFacts',                    COALESCE((SELECT payload FROM simulation_facts), '[]'::jsonb),
  'simulationParameterFactsCategorical',COALESCE((SELECT payload FROM param_facts_cat), '[]'::jsonb),
  'simulationParameterFactsNumeric',    COALESCE((SELECT payload FROM param_facts_num), '[]'::jsonb),
  'hasData',                            EXISTS (SELECT 1 FROM sim_summary)
);
$$;
