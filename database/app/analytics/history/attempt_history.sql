-- Attempt History (UI-ready) — Returns HistoryDataItem[] for new UI
CREATE OR REPLACE FUNCTION analytics_attempt_history_fn(
  p_start           timestamptz,
  p_end             timestamptz,
  p_cohort_ids      uuid[],
  p_roles           profile_role[],
  p_sim_filters     text[],
  p_profile_id      uuid
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH params AS (
  SELECT
    COALESCE(p_cohort_ids, '{}')               AS cohort_ids,
    COALESCE(p_roles, '{}')                    AS roles,
    COALESCE(p_sim_filters, ARRAY['general'])  AS sim_filters,
    p_profile_id                               AS profile_id,
    p_start                                    AS start_at,
    GREATEST(p_end, now())                     AS end_at
),
-- Base filter using ATTEMPT DATE per GLOW rule #3
base AS (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  WHERE a.attempt_created_at >= pr.start_at
    AND a.attempt_created_at <  pr.end_at
    AND (cardinality(pr.roles) = 0 OR a.profile_role = ANY (pr.roles))
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
    -- practice/general on simulations:
    AND (
      ('general'  = ANY (pr.sim_filters) AND a.is_general)
      OR
      ('practice' = ANY (pr.sim_filters) AND a.is_practice)
    )
    -- archived on attempts:
    AND (
      CASE
        WHEN 'archived' = ANY (pr.sim_filters)
             AND ( 'general' = ANY (pr.sim_filters) OR 'practice' = ANY (pr.sim_filters) )
          THEN TRUE                    -- allow both archived and non-archived
        WHEN 'archived' = ANY (pr.sim_filters)
          THEN a.is_archived           -- only archived
        ELSE NOT a.is_archived         -- only non-archived
      END
    )
),
-- Cohort scoping: when cohorts passed, require BOTH sim-in-cohort and profile-in-cohort-for-sim
cohort_scoped AS (
  SELECT b.*
  FROM base b
  CROSS JOIN params pr
  WHERE
    cardinality(pr.cohort_ids) = 0
    OR (b.cohort_ids && pr.cohort_ids AND b.profile_cohort_ids && pr.cohort_ids)
),
-- Attempt-level aggregates
attempt_rollup AS (
  SELECT
    a.attempt_id,
    a.simulation_id,
    MIN(a.attempt_created_at) AS attempt_date,  -- UI "date"
    MIN(a.chat_created_at)    AS first_chat_at, -- kept for tie-breaks if needed
    MAX(a.chat_created_at)    AS last_activity_at,
    -- completion counted only when completed AND graded (latest-grade exists)
    COUNT(*) FILTER (WHERE a.completed AND a.grade_percent IS NOT NULL) AS completed_with_grade,
    -- denom for score:
    MAX(a.sim_scenario_count) AS sim_scenario_count,
    BOOL_OR(a.is_practice AND EXISTS (SELECT 1)) AS has_any, -- dummy to let us aggregate
    -- sum of grade percents with zero-fill semantics:
    SUM(COALESCE(a.grade_percent, 0)) AS sum_grade_percent_zero_fill,
    -- infinite mode detection later (from attempts table join)
    array_agg(DISTINCT a.persona_id) FILTER (WHERE a.persona_id IS NOT NULL) AS persona_ids_distinct,
    array_agg(DISTINCT a.leaf_scenario_id) FILTER (WHERE a.leaf_scenario_id IS NOT NULL) AS leaf_scenarios_seen
  FROM cohort_scoped a
  GROUP BY a.attempt_id, a.simulation_id
),
-- Join attempt + sim + rubric + profile + attempt flags
attempt_joined AS (
  SELECT
    ar.*,
    sa.profile_id,
    sa.archived                         AS is_archived,
    sa.infinite_mode,
    sa.infinite_mode_time_limit,
    s.title                             AS simulation_name,
    s.scenario_ids                      AS scenario_ids_assigned,
    s.practice_simulation               AS practice_simulation,
    r.id                                AS rubric_id,
    r.points                            AS rubric_points,
    r.pass_points                       AS rubric_pass_points,
    CASE
      WHEN r.points IS NULL OR r.points = 0 THEN NULL
      ELSE ROUND((r.pass_points::numeric / r.points::numeric) * 100.0)::int
    END                                 AS pass_pct,
    (p.first_name || ' ' || p.last_name) AS profile_name
  FROM attempt_rollup ar
  JOIN simulation_attempts sa ON sa.id = ar.attempt_id
  JOIN simulations        s  ON s.id  = ar.simulation_id
  LEFT JOIN rubrics       r  ON r.id  = s.rubric_id
  JOIN profiles           p  ON p.id  = sa.profile_id
),
-- Persona names/colors for display (distinct, stable order by name)
persona_labels AS (
  SELECT
    aj.attempt_id,
    COALESCE(ARRAY_AGG(px.name  ORDER BY px.name),  ARRAY[]::text[]) AS persona_names,
    COALESCE(ARRAY_AGG(px.color ORDER BY px.name),  ARRAY[]::text[]) AS persona_colors
  FROM attempt_joined aj
  LEFT JOIN LATERAL (
    SELECT DISTINCT per.name, per.color
    FROM unnest(aj.persona_ids_distinct) AS pid
    JOIN personas per ON per.id = pid
  ) AS px ON true
  GROUP BY aj.attempt_id
),
-- Final shaping with scoring semantics
final_rows AS (
  SELECT
    aj.attempt_id,
    aj.simulation_id,
    aj.profile_id,
    aj.profile_name,
    aj.simulation_name,
    aj.scenario_ids_assigned,
    aj.is_archived,
    aj.practice_simulation,
    aj.pass_pct,
    aj.infinite_mode,
    aj.infinite_mode_time_limit,
    aj.attempt_date,
    -- numScenarios / numScenariosCompleted
    CASE
      WHEN aj.infinite_mode THEN NULL
      ELSE COALESCE(aj.sim_scenario_count, 0)
    END AS num_scenarios,
    COALESCE(aj.completed_with_grade, 0) AS num_scenarios_completed,
    -- scoring: average percent with zero-fill over expected denom
    CASE
      WHEN aj.infinite_mode THEN
        -- denom is number of chats realized in attempt; protect against 0
        CASE GREATEST(array_length(aj.leaf_scenarios_seen, 1), 0)
          WHEN 0 THEN NULL
          ELSE ROUND( aj.sum_grade_percent_zero_fill
                      / GREATEST(array_length(aj.leaf_scenarios_seen, 1), 1) )::int
        END
      ELSE
        CASE COALESCE(aj.sim_scenario_count, 0)
          WHEN 0 THEN NULL
          ELSE
            CASE
              WHEN aj.completed_with_grade = 0 THEN NULL
              ELSE ROUND( aj.sum_grade_percent_zero_fill
                          / NULLIF(aj.sim_scenario_count, 0) )::int
            END
        END
    END AS score_percent,
    -- buttons
    (NOT aj.is_archived)                                 AS show_view,
    (NOT aj.is_archived) AND (
      aj.infinite_mode
      OR (aj.sim_scenario_count IS NOT NULL
          AND COALESCE(aj.completed_with_grade, 0) < aj.sim_scenario_count)
    )                                                    AS show_continue
  FROM attempt_joined aj
)
SELECT COALESCE(
  jsonb_agg(
    jsonb_build_object(
      'attemptId',             fr.attempt_id::text,
      'date',                  fr.attempt_date,
      'profileId',             fr.profile_id::text,
      'profileName',           fr.profile_name,
      'simulationName',        fr.simulation_name,
      'numScenarios',          fr.num_scenarios,
      'numScenariosCompleted', fr.num_scenarios_completed,
      'infiniteMode',          fr.infinite_mode,
      'personaNames',          COALESCE(pl.persona_names, ARRAY[]::text[]),
      'personaColors',         COALESCE(pl.persona_colors, ARRAY[]::text[]),
      'score',                 fr.score_percent,
      'simulation_id',         fr.simulation_id::text,
      'scenario_ids',          COALESCE(fr.scenario_ids_assigned, ARRAY[]::uuid[])::text[],
      'isArchived',            fr.is_archived,
      'showView',              fr.show_view,
      'showContinue',          fr.show_continue,
      'practiceSimulation',    COALESCE(fr.practice_simulation, false),
      'passPct',               fr.pass_pct
    )
    ORDER BY fr.attempt_date DESC, fr.attempt_id
  ),
  '[]'::jsonb
)
FROM final_rows fr
LEFT JOIN persona_labels pl ON pl.attempt_id = fr.attempt_id;
$$;