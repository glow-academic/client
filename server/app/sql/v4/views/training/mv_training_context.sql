-- Materialized View: mv_training_context
-- Training-level denormalized context for lightweight hydration in training endpoints.
--
-- Grain: One row per training_entry.id

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_training_context'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_training_context CASCADE;

CREATE MATERIALIZED VIEW mv_training_context AS
WITH scenario_positions AS (
    SELECT
        tb.id AS training_bundle_id,
        tb.training_id,
        tb.scenarios_id,
        COALESCE(
            (
                SELECT spr.value
                FROM training_entry te
                JOIN simulation_simulations_junction ssj
                  ON ssj.simulations_id = te.simulations_id
                 AND ssj.active = true
                JOIN scenario_scenarios_junction ssj2
                  ON ssj2.scenarios_id = tb.scenarios_id
                 AND ssj2.active = true
                JOIN simulation_scenario_positions_junction ssp
                  ON ssp.simulation_id = ssj.simulation_id
                JOIN scenario_positions_resource spr
                  ON spr.id = ssp.scenario_position_id
                 AND spr.scenario_id = ssj2.scenario_id
                WHERE te.id = tb.training_id
                LIMIT 1
            ),
            999999
        ) AS position_value
    FROM training_bundle_entry tb
    WHERE tb.active = true
),
scenario_ids_agg AS (
    SELECT
        sp.training_id,
        ARRAY_AGG(sp.scenarios_id ORDER BY sp.position_value, sp.scenarios_id) AS scenario_ids
    FROM scenario_positions sp
    GROUP BY sp.training_id
),
default_bundle_agg AS (
    SELECT DISTINCT ON (sp.training_id)
        sp.training_id,
        sp.training_bundle_id AS default_training_bundle_entry_id
    FROM scenario_positions sp
    ORDER BY sp.training_id, sp.position_value, sp.training_bundle_id
),
department_ids_agg AS (
    SELECT
        tb.training_id,
        ARRAY_AGG(DISTINCT tbd.departments_id ORDER BY tbd.departments_id) AS department_ids
    FROM training_bundle_entry tb
    JOIN training_bundle_departments_entry tbd
      ON tbd.training_bundle_id = tb.id
     AND tbd.active = true
    WHERE tb.active = true
    GROUP BY tb.training_id
),
profile_ids_agg AS (
    SELECT
        tpc.training_id,
        ARRAY_AGG(DISTINCT tpc.profiles_id ORDER BY tpc.profiles_id) AS profile_ids
    FROM training_profiles_connection tpc
    WHERE tpc.active = true
    GROUP BY tpc.training_id
),
time_limit_agg AS (
    SELECT
        tb.training_id,
        COALESCE(SUM(DISTINCT stlr.time_limit_seconds), 0)::int AS total_time_limit_seconds,
        BOOL_OR(COALESCE(stlr.negative, false)) AS allows_negative_time
    FROM training_bundle_entry tb
    JOIN training_bundle_departments_entry tbd
      ON tbd.training_bundle_id = tb.id
     AND tbd.active = true
    JOIN training_bundle_departments_time_limits_connection tbdtl
      ON tbdtl.training_bundle_department_id = tbd.id
     AND tbdtl.active = true
    JOIN scenario_time_limits_resource stlr
      ON stlr.id = tbdtl.scenario_time_limits_id
     AND stlr.active = true
    WHERE tb.active = true
    GROUP BY tb.training_id
),
first_scenario_artifact AS (
    SELECT DISTINCT ON (sp.training_id)
        sp.training_id,
        ssj.scenario_id AS scenario_artifact_id
    FROM scenario_positions sp
    JOIN scenario_scenarios_junction ssj
      ON ssj.scenarios_id = sp.scenarios_id
     AND ssj.active = true
    ORDER BY sp.training_id, sp.position_value, sp.scenarios_id
),
first_scenario_persona AS (
    SELECT DISTINCT ON (fsa.training_id)
        fsa.training_id,
        spj.persona_id
    FROM first_scenario_artifact fsa
    JOIN scenario_personas_junction spj
      ON spj.scenario_id = fsa.scenario_artifact_id
     AND spj.active = true
    ORDER BY fsa.training_id, spj.created_at, spj.persona_id
),
persona_display AS (
    SELECT
        fsp.training_id,
        (SELECT c.hex_code
         FROM persona_colors_junction pc
         JOIN colors_resource c ON c.id = pc.color_id
         WHERE pc.persona_id = fsp.persona_id
         LIMIT 1) AS color,
        (SELECT i.name
         FROM persona_icons_junction pi
         JOIN icons_resource i ON i.id = pi.icon_id
         WHERE pi.persona_id = fsp.persona_id
         LIMIT 1) AS icon
    FROM first_scenario_persona fsp
),
rubric_standard_groups AS (
    SELECT DISTINCT
        sp.training_id,
        sg.id AS standard_group_id,
        sg.points,
        sg.pass_points
    FROM scenario_positions sp
    JOIN scenario_rubrics_resource srr
      ON srr.scenario_id = sp.scenarios_id
     AND srr.active = true
    JOIN rubric_standard_groups_junction rsg
      ON rsg.rubric_id = srr.rubric_id
     AND rsg.active = true
    JOIN standard_groups_resource sg
      ON sg.id = rsg.standard_group_id
     AND sg.active = true
),
standard_group_agg AS (
    SELECT
        rsg.training_id,
        ARRAY_AGG(DISTINCT rsg.standard_group_id ORDER BY rsg.standard_group_id) AS standard_group_ids,
        COALESCE(SUM(rsg.points), 0)::int AS rubric_total_points,
        COALESCE(SUM(rsg.pass_points), 0)::int AS rubric_pass_points
    FROM rubric_standard_groups rsg
    GROUP BY rsg.training_id
),
standard_agg AS (
    SELECT
        rsg.training_id,
        ARRAY_AGG(DISTINCT s.id ORDER BY s.id) AS standard_ids
    FROM rubric_standard_groups rsg
    JOIN standards_resource s
      ON s.standard_group_id = rsg.standard_group_id
     AND s.active = true
    GROUP BY rsg.training_id
)
SELECT
    te.id AS training_id,
    te.simulations_id AS simulation_id,
    te.cohorts_id AS cohort_id,
    te.practice,

    te.audio_enabled,
    te.text_enabled,
    te.hints_enabled,
    te.copy_paste_allowed,
    te.show_images,
    te.show_objectives,
    te.show_problem_statement,

    db.default_training_bundle_entry_id,

    COALESCE(sia.scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
    COALESCE(dia.department_ids, ARRAY[]::uuid[]) AS department_ids,
    COALESCE(pia.profile_ids, ARRAY[]::uuid[]) AS profile_ids,

    pd.color,
    pd.icon,

    COALESCE(sga.standard_group_ids, ARRAY[]::uuid[]) AS standard_group_ids,
    COALESCE(sa.standard_ids, ARRAY[]::uuid[]) AS standard_ids,
    COALESCE(sga.rubric_total_points, 0) AS rubric_total_points,
    COALESCE(sga.rubric_pass_points, 0) AS rubric_pass_points,

    COALESCE(tla.total_time_limit_seconds, 0) AS total_time_limit_seconds,
    COALESCE(tla.allows_negative_time, false) AS allows_negative_time,

    te.created_at AS training_created_at,
    te.updated_at AS training_updated_at,
    te.active
FROM training_entry te
LEFT JOIN scenario_ids_agg sia ON sia.training_id = te.id
LEFT JOIN default_bundle_agg db ON db.training_id = te.id
LEFT JOIN department_ids_agg dia ON dia.training_id = te.id
LEFT JOIN profile_ids_agg pia ON pia.training_id = te.id
LEFT JOIN persona_display pd ON pd.training_id = te.id
LEFT JOIN standard_group_agg sga ON sga.training_id = te.id
LEFT JOIN standard_agg sa ON sa.training_id = te.id
LEFT JOIN time_limit_agg tla ON tla.training_id = te.id
WHERE te.active = true
WITH NO DATA;

CREATE UNIQUE INDEX mv_training_context_pk
    ON mv_training_context (training_id);

CREATE INDEX mv_training_context_simulation_idx
    ON mv_training_context (simulation_id);

CREATE INDEX mv_training_context_cohort_idx
    ON mv_training_context (cohort_id);

CREATE INDEX mv_training_context_practice_idx
    ON mv_training_context (practice);

CREATE INDEX mv_training_context_sim_cohort_practice_idx
    ON mv_training_context (simulation_id, cohort_id, practice);

CREATE INDEX mv_training_context_profile_ids_gin_idx
    ON mv_training_context USING GIN (profile_ids);

CREATE INDEX mv_training_context_scenario_ids_gin_idx
    ON mv_training_context USING GIN (scenario_ids);

CREATE INDEX mv_training_context_standard_group_ids_gin_idx
    ON mv_training_context USING GIN (standard_group_ids);

CREATE INDEX mv_training_context_standard_ids_gin_idx
    ON mv_training_context USING GIN (standard_ids);

REFRESH MATERIALIZED VIEW mv_training_context;
