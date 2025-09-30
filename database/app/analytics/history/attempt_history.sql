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
    /* Spec: do NOT widen with now() */
    p_start                                    AS start_at,
    p_end                                      AS end_at,
    /* flags derived once */
    'general'  = ANY(COALESCE(p_sim_filters, ARRAY['general'])) AS want_general,
    'practice' = ANY(COALESCE(p_sim_filters, ARRAY['general'])) AS want_practice,
    'archived' = ANY(COALESCE(p_sim_filters, ARRAY['general'])) AS want_archived
),
want AS (
  SELECT
    want_general,
    want_practice,
    want_archived,
    (want_general OR want_practice) AS want_nonarchived_or_any
  FROM params
),
/* --------- Base selection (attempt-date window, role/profile gating) --------- */
/* Split by simulation type to avoid OR and enable index use */
base_general AS (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_general
    AND a.is_general = TRUE
    AND a.attempt_created_at >= pr.start_at
    AND a.attempt_created_at <  pr.end_at
    /* Explicit profile_id overrides roles; otherwise apply roles if provided */
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    /* If profile_id is provided, restrict attempts to it */
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
base_practice AS (
  SELECT a.*
  FROM analytics a
  CROSS JOIN params pr
  CROSS JOIN want w
  WHERE w.want_practice
    AND a.is_practice = TRUE
    AND a.attempt_created_at >= pr.start_at
    AND a.attempt_created_at <  pr.end_at
    AND (
      pr.profile_id IS NOT NULL
      OR cardinality(pr.roles) = 0
      OR a.profile_role = ANY (pr.roles)
    )
    AND (pr.profile_id IS NULL OR a.profile_id = pr.profile_id)
),
base_union AS (
  SELECT * FROM base_general
  UNION ALL
  SELECT * FROM base_practice
),
/* Archived tri-state: 
   - if archived AND (general/practice) → allow both (no filter)
   - if only archived → is_archived = true
   - if only (general/practice) → is_archived = false
   - if neither → empty set (handled by WHERE FALSE)
*/
base_archived AS (
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
/* Cohort scoping (when cohorts passed, require both sim-in-cohort and profile-in-cohort-for-sim) */
cohort_scoped AS (
  SELECT b.*
  FROM base_archived b
  CROSS JOIN params pr
  WHERE
    cardinality(pr.cohort_ids) = 0
    OR (b.cohort_ids && pr.cohort_ids AND b.profile_cohort_ids && pr.cohort_ids)
),
/* Attempt-level aggregates from chat-grain MV */
attempt_rollup AS (
  SELECT
    a.attempt_id,
    a.simulation_id,
    MIN(a.attempt_created_at) AS attempt_date,
    MIN(a.chat_created_at)    AS first_chat_at,
    MAX(a.chat_created_at)    AS last_activity_at,
    COUNT(*) FILTER (WHERE a.completed AND a.grade_percent IS NOT NULL) AS completed_with_grade,
    MAX(a.sim_scenario_count) AS sim_scenario_count,
    SUM(COALESCE(a.grade_percent, 0)) AS sum_grade_percent_zero_fill,
    array_agg(DISTINCT a.persona_id)      FILTER (WHERE a.persona_id      IS NOT NULL) AS persona_ids_distinct,
    array_agg(DISTINCT a.leaf_scenario_id)FILTER (WHERE a.leaf_scenario_id IS NOT NULL) AS leaf_scenarios_seen
  FROM cohort_scoped a
  GROUP BY a.attempt_id, a.simulation_id
),
/* Join attempt + sim + rubric + profile + attempt flags */
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
/* Final shaping with scoring semantics */
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
    CASE WHEN aj.infinite_mode THEN NULL ELSE COALESCE(aj.sim_scenario_count, 0) END AS num_scenarios,
    COALESCE(aj.completed_with_grade, 0) AS num_scenarios_completed,
    CASE
      WHEN aj.infinite_mode THEN
        CASE GREATEST(array_length(aj.leaf_scenarios_seen, 1), 0)
          WHEN 0 THEN NULL
          ELSE ROUND( aj.sum_grade_percent_zero_fill
                      / GREATEST(array_length(aj.leaf_scenarios_seen, 1), 1) )::int
        END
      ELSE
        CASE COALESCE(aj.sim_scenario_count, 0)
          WHEN 0 THEN NULL
          ELSE CASE
                 WHEN aj.completed_with_grade = 0 THEN NULL
                 ELSE ROUND( aj.sum_grade_percent_zero_fill
                             / NULLIF(aj.sim_scenario_count, 0) )::int
               END
        END
    END AS score_percent,
    (NOT aj.is_archived)                                 AS show_view,
    (NOT aj.is_archived) AND (
      aj.infinite_mode
      OR (aj.sim_scenario_count IS NOT NULL
          AND COALESCE(aj.completed_with_grade, 0) < aj.sim_scenario_count)
    )                                                    AS show_continue
  FROM attempt_joined aj
),
/* Persona labels aggregated once per attempt via LATERAL (fewer executor calls) */
persona_labels AS (
  SELECT
    fr.attempt_id,
    COALESCE(px.persona_names,  ARRAY[]::text[]) AS persona_names,
    COALESCE(px.persona_colors, ARRAY[]::text[]) AS persona_colors
  FROM final_rows fr
  LEFT JOIN LATERAL (
    SELECT
      ARRAY_AGG(per.name  ORDER BY per.name)  AS persona_names,
      ARRAY_AGG(per.color ORDER BY per.name)  AS persona_colors
    FROM personas per
    WHERE per.id = ANY (fr.scenario_ids_assigned::uuid[])  -- fallback path if personas linked via scenarios
  ) px ON FALSE  -- disabled; keep your original persona sourcing from persona_ids_distinct below
),
/* Keep your original persona lookup based on persona_ids_distinct from attempt_rollup */
persona_labels_fixed AS (
  SELECT
    aj.attempt_id,
    COALESCE(ARRAY_AGG(per.name  ORDER BY per.name),  ARRAY[]::text[]) AS persona_names,
    COALESCE(ARRAY_AGG(per.color ORDER BY per.name), ARRAY[]::text[])  AS persona_colors
  FROM attempt_joined aj
  LEFT JOIN LATERAL (
    SELECT DISTINCT per.name, per.color
    FROM unnest(aj.persona_ids_distinct) AS pid
    JOIN personas per ON per.id = pid
  ) per ON TRUE
  GROUP BY aj.attempt_id
),
/* Scenario names via single LATERAL per attempt (no correlated subquery in select list) */
scenario_names AS (
  SELECT
    fr.attempt_id,
    COALESCE(sn.names, ARRAY[]::text[]) AS names
  FROM final_rows fr
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(s.name ORDER BY s.name) AS names
    FROM unnest(fr.scenario_ids_assigned) sid
    JOIN scenarios s ON s.id = sid
  ) sn ON TRUE
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
      'scenario_titles',       COALESCE(sn.names, ARRAY[]::text[]),
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
LEFT JOIN persona_labels_fixed pl ON pl.attempt_id = fr.attempt_id
LEFT JOIN scenario_names sn       ON sn.attempt_id = fr.attempt_id;
$$;