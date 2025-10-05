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
    'practice' = ANY (COALESCE(p_sim_filters, ARRAY['general'])) AS want_practice,
    'archived' = ANY (COALESCE(p_sim_filters, ARRAY['general'])) AS want_archived
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
base_union AS MATERIALIZED (
  SELECT * FROM base_general
  UNION ALL
  SELECT * FROM base_practice
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
param_ids AS (
  SELECT id
  FROM parameters
  WHERE active = TRUE AND numerical = FALSE
),
cat_map AS (
  SELECT pi.id AS parameter_item_id,
         pi.parameter_id,
         s.id  AS scenario_id
  FROM parameter_items pi
  JOIN param_ids p ON p.id = pi.parameter_id
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