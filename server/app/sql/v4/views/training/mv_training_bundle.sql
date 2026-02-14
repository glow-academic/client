-- Materialized View: mv_training_bundle
-- Training-bundle-level denormalized context for the customize/start page.
--
-- Grain: One row per training_bundle_entry.id
-- Training bundle = scenario-level parameters.
-- All resource IDs from training_bundle_*_connection tables.
-- Scenario flags resolved from scenario_flags_junction via flags_resource.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_training_bundle'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_training_bundle CASCADE;

CREATE MATERIALIZED VIEW mv_training_bundle AS
WITH
-- Resolve single scenario_id from training_bundle_scenarios_connection
scenario_single AS (
    SELECT DISTINCT ON (tbsc.training_bundle_id)
        tbsc.training_bundle_id,
        tbsc.scenarios_id AS scenario_id
    FROM training_bundle_scenarios_connection tbsc
    WHERE tbsc.active = true
    ORDER BY tbsc.training_bundle_id, tbsc.scenarios_id
),
-- training_bundle_entry level connections
department_agg AS (
    SELECT
        tbdc.training_bundle_id,
        ARRAY_AGG(DISTINCT tbdc.departments_id ORDER BY tbdc.departments_id) AS department_ids
    FROM training_bundle_departments_connection tbdc
    WHERE tbdc.active = true
    GROUP BY tbdc.training_bundle_id
),
persona_agg AS (
    SELECT
        tbpc.training_bundle_id,
        ARRAY_AGG(DISTINCT tbpc.personas_id ORDER BY tbpc.personas_id) AS persona_ids
    FROM training_bundle_personas_connection tbpc
    WHERE tbpc.active = true
    GROUP BY tbpc.training_bundle_id
),
document_agg AS (
    SELECT
        tbdc.training_bundle_id,
        ARRAY_AGG(DISTINCT tbdc.documents_id ORDER BY tbdc.documents_id) AS document_ids
    FROM training_bundle_documents_connection tbdc
    WHERE tbdc.active = true
    GROUP BY tbdc.training_bundle_id
),
parameter_field_agg AS (
    SELECT
        tbpfc.training_bundle_id,
        ARRAY_AGG(DISTINCT tbpfc.parameter_fields_id ORDER BY tbpfc.parameter_fields_id) AS parameter_field_ids
    FROM training_bundle_parameter_fields_connection tbpfc
    WHERE tbpfc.active = true
    GROUP BY tbpfc.training_bundle_id
),
parameter_agg AS (
    SELECT
        tbpc.training_bundle_id,
        ARRAY_AGG(DISTINCT tbpc.parameters_id ORDER BY tbpc.parameters_id) AS parameter_ids
    FROM training_bundle_parameters_connection tbpc
    WHERE tbpc.active = true
    GROUP BY tbpc.training_bundle_id
),
question_agg AS (
    SELECT
        tbqc.training_bundle_id,
        ARRAY_AGG(DISTINCT tbqc.questions_id ORDER BY tbqc.questions_id) AS question_ids
    FROM training_bundle_questions_connection tbqc
    WHERE tbqc.active = true
    GROUP BY tbqc.training_bundle_id
),
option_agg AS (
    SELECT
        tboc.training_bundle_id,
        ARRAY_AGG(DISTINCT tboc.options_id ORDER BY tboc.options_id) AS option_ids
    FROM training_bundle_options_connection tboc
    WHERE tboc.active = true
    GROUP BY tboc.training_bundle_id
),
video_agg AS (
    SELECT
        tbvc.training_bundle_id,
        ARRAY_AGG(DISTINCT tbvc.videos_id ORDER BY tbvc.videos_id) AS video_ids
    FROM training_bundle_videos_connection tbvc
    WHERE tbvc.active = true
    GROUP BY tbvc.training_bundle_id
),
image_agg AS (
    SELECT
        tbic.training_bundle_id,
        ARRAY_AGG(DISTINCT tbic.images_id ORDER BY tbic.images_id) AS image_ids
    FROM training_bundle_images_connection tbic
    WHERE tbic.active = true
    GROUP BY tbic.training_bundle_id
),
problem_statement_agg AS (
    SELECT
        tbpsc.training_bundle_id,
        ARRAY_AGG(DISTINCT tbpsc.problem_statements_id ORDER BY tbpsc.problem_statements_id) AS problem_statement_ids
    FROM training_bundle_problem_statements_connection tbpsc
    WHERE tbpsc.active = true
    GROUP BY tbpsc.training_bundle_id
),
objective_agg AS (
    SELECT
        tboc.training_bundle_id,
        ARRAY_AGG(DISTINCT tboc.objectives_id ORDER BY tboc.objectives_id) AS objective_ids
    FROM training_bundle_objectives_connection tboc
    WHERE tboc.active = true
    GROUP BY tboc.training_bundle_id
),
flag_agg AS (
    SELECT
        tbfc.training_bundle_id,
        ARRAY_AGG(DISTINCT tbfc.flags_id ORDER BY tbfc.flags_id) AS flag_ids
    FROM training_bundle_flags_connection tbfc
    WHERE tbfc.active = true
    GROUP BY tbfc.training_bundle_id
),
name_agg AS (
    SELECT
        tbnc.training_bundle_id,
        ARRAY_AGG(DISTINCT tbnc.names_id ORDER BY tbnc.names_id) AS name_ids
    FROM training_bundle_names_connection tbnc
    WHERE tbnc.active = true
    GROUP BY tbnc.training_bundle_id
),
description_agg AS (
    SELECT
        tbdc.training_bundle_id,
        ARRAY_AGG(DISTINCT tbdc.descriptions_id ORDER BY tbdc.descriptions_id) AS description_ids
    FROM training_bundle_descriptions_connection tbdc
    WHERE tbdc.active = true
    GROUP BY tbdc.training_bundle_id
),
-- Scenario flags: resolved from scenario_flags_junction via scenario_scenarios_junction.
-- Each bundle has one scenario (via training_bundle_scenarios_connection);
-- we resolve scenario_artifact via scenario_scenarios_junction
-- then pivot the 5 flags into boolean columns.
flag_pivot AS (
    SELECT
        ss.training_bundle_id,
        COALESCE(BOOL_OR(CASE WHEN fr.name = 'video_enabled' THEN sfj.value END), false) AS video_enabled,
        COALESCE(BOOL_OR(CASE WHEN fr.name = 'problem_statement_enabled' THEN sfj.value END), false) AS problem_statement_enabled,
        COALESCE(BOOL_OR(CASE WHEN fr.name = 'objectives_enabled' THEN sfj.value END), false) AS objectives_enabled,
        COALESCE(BOOL_OR(CASE WHEN fr.name = 'images_enabled' THEN sfj.value END), false) AS images_enabled,
        COALESCE(BOOL_OR(CASE WHEN fr.name = 'questions_enabled' THEN sfj.value END), false) AS questions_enabled
    FROM scenario_single ss
    JOIN scenario_scenarios_junction ssj
      ON ssj.scenarios_id = ss.scenario_id AND ssj.active = true
    JOIN scenario_flags_junction sfj
      ON sfj.scenario_id = ssj.scenario_id AND sfj.active = true
    JOIN flags_resource fr
      ON fr.id = sfj.flag_id
    WHERE fr.name IN (
          'video_enabled',
          'problem_statement_enabled',
          'objectives_enabled',
          'images_enabled',
          'questions_enabled'
      )
    GROUP BY ss.training_bundle_id
)
SELECT
    tbe.id AS training_bundle_entry_id,
    tbe.training_id,

    -- Single scenario_id (from connection, not direct FK)
    ss.scenario_id,

    -- Bundle-level resource ID arrays
    COALESCE(dep.department_ids, ARRAY[]::uuid[]) AS department_ids,
    COALESCE(per.persona_ids, ARRAY[]::uuid[]) AS persona_ids,
    COALESCE(doc.document_ids, ARRAY[]::uuid[]) AS document_ids,
    COALESCE(pf.parameter_field_ids, ARRAY[]::uuid[]) AS parameter_field_ids,
    COALESCE(par.parameter_ids, ARRAY[]::uuid[]) AS parameter_ids,
    COALESCE(que.question_ids, ARRAY[]::uuid[]) AS question_ids,
    COALESCE(opt.option_ids, ARRAY[]::uuid[]) AS option_ids,
    COALESCE(vid.video_ids, ARRAY[]::uuid[]) AS video_ids,
    COALESCE(img.image_ids, ARRAY[]::uuid[]) AS image_ids,
    COALESCE(ps.problem_statement_ids, ARRAY[]::uuid[]) AS problem_statement_ids,
    COALESCE(obj.objective_ids, ARRAY[]::uuid[]) AS objective_ids,
    COALESCE(flg.flag_ids, ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(nm.name_ids, ARRAY[]::uuid[]) AS name_ids,
    COALESCE(dsc.description_ids, ARRAY[]::uuid[]) AS description_ids,

    -- Scenario flags (resolved from scenario_flags_junction — fixed booleans)
    COALESCE(fp.video_enabled, false) AS video_enabled,
    COALESCE(fp.problem_statement_enabled, false) AS problem_statement_enabled,
    COALESCE(fp.objectives_enabled, false) AS objectives_enabled,
    COALESCE(fp.images_enabled, false) AS images_enabled,
    COALESCE(fp.questions_enabled, false) AS questions_enabled,

    tbe.created_at,
    tbe.updated_at,
    tbe.active

FROM training_bundle_entry tbe
LEFT JOIN scenario_single ss ON ss.training_bundle_id = tbe.id
LEFT JOIN department_agg dep ON dep.training_bundle_id = tbe.id
LEFT JOIN persona_agg per ON per.training_bundle_id = tbe.id
LEFT JOIN document_agg doc ON doc.training_bundle_id = tbe.id
LEFT JOIN parameter_field_agg pf ON pf.training_bundle_id = tbe.id
LEFT JOIN parameter_agg par ON par.training_bundle_id = tbe.id
LEFT JOIN question_agg que ON que.training_bundle_id = tbe.id
LEFT JOIN option_agg opt ON opt.training_bundle_id = tbe.id
LEFT JOIN video_agg vid ON vid.training_bundle_id = tbe.id
LEFT JOIN image_agg img ON img.training_bundle_id = tbe.id
LEFT JOIN problem_statement_agg ps ON ps.training_bundle_id = tbe.id
LEFT JOIN objective_agg obj ON obj.training_bundle_id = tbe.id
LEFT JOIN flag_agg flg ON flg.training_bundle_id = tbe.id
LEFT JOIN name_agg nm ON nm.training_bundle_id = tbe.id
LEFT JOIN description_agg dsc ON dsc.training_bundle_id = tbe.id
LEFT JOIN flag_pivot fp ON fp.training_bundle_id = tbe.id
WHERE tbe.active = true
WITH NO DATA;

CREATE UNIQUE INDEX mv_training_bundle_pk
    ON mv_training_bundle (training_bundle_entry_id);

CREATE INDEX mv_training_bundle_training_id_idx
    ON mv_training_bundle (training_id);

CREATE INDEX mv_training_bundle_scenario_id_idx
    ON mv_training_bundle (scenario_id);

CREATE INDEX mv_training_bundle_department_ids_gin_idx
    ON mv_training_bundle USING GIN (department_ids);

CREATE INDEX mv_training_bundle_persona_ids_gin_idx
    ON mv_training_bundle USING GIN (persona_ids);

REFRESH MATERIALIZED VIEW mv_training_bundle;
