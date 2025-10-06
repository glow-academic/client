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
    AND a.chat_created_at >= pr.start_at
    AND a.chat_created_at <  pr.end_at
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
    AND a.chat_created_at >= pr.start_at
    AND a.chat_created_at <  pr.end_at
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