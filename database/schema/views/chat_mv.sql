-- Materialized View: chat_mv
-- Chat-bundle-level denormalized context for the customize/start page.
--
-- Grain: One row per chat_entry.id
-- Chat bundle = scenario-level parameters.
-- All resource IDs from chat_*_connection tables.
-- Scenario flags resolved from scenario_flags_junction via flags_resource.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'chat_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS chat_mv CASCADE;

CREATE MATERIALIZED VIEW chat_mv AS
WITH
-- Resolve single scenario_id from chat_scenarios_connection
scenario_single AS (
    SELECT DISTINCT ON (tbsc.chat_id)
        tbsc.chat_id,
        tbsc.scenarios_id AS scenario_id
    FROM chat_scenarios_connection tbsc
    WHERE tbsc.active = true
    ORDER BY tbsc.chat_id, tbsc.scenarios_id
),
-- chat_entry level connections
department_agg AS (
    SELECT
        tbdc.chat_id,
        ARRAY_AGG(DISTINCT tbdc.departments_id ORDER BY tbdc.departments_id) AS department_ids
    FROM chat_departments_connection tbdc
    WHERE tbdc.active = true
    GROUP BY tbdc.chat_id
),
document_agg AS (
    SELECT
        tbdc.chat_id,
        ARRAY_AGG(DISTINCT tbdc.documents_id ORDER BY tbdc.documents_id) AS document_ids
    FROM chat_documents_connection tbdc
    WHERE tbdc.active = true
    GROUP BY tbdc.chat_id
),
parameter_field_agg AS (
    SELECT
        tbpfc.chat_id,
        ARRAY_AGG(DISTINCT tbpfc.parameter_fields_id ORDER BY tbpfc.parameter_fields_id) AS parameter_field_ids
    FROM chat_parameter_fields_connection tbpfc
    WHERE tbpfc.active = true
    GROUP BY tbpfc.chat_id
),
question_agg AS (
    SELECT
        tbqc.chat_id,
        ARRAY_AGG(DISTINCT tbqc.questions_id ORDER BY tbqc.questions_id) AS question_ids
    FROM chat_questions_connection tbqc
    WHERE tbqc.active = true
    GROUP BY tbqc.chat_id
),
option_agg AS (
    SELECT
        tboc.chat_id,
        ARRAY_AGG(DISTINCT tboc.options_id ORDER BY tboc.options_id) AS option_ids
    FROM chat_options_connection tboc
    WHERE tboc.active = true
    GROUP BY tboc.chat_id
),
video_agg AS (
    SELECT
        tbvc.chat_id,
        ARRAY_AGG(DISTINCT tbvc.videos_id ORDER BY tbvc.videos_id) AS video_ids
    FROM chat_videos_connection tbvc
    WHERE tbvc.active = true
    GROUP BY tbvc.chat_id
),
image_agg AS (
    SELECT
        tbic.chat_id,
        ARRAY_AGG(DISTINCT tbic.images_id ORDER BY tbic.images_id) AS image_ids
    FROM chat_images_connection tbic
    WHERE tbic.active = true
    GROUP BY tbic.chat_id
),
problem_statement_agg AS (
    SELECT
        tbpsc.chat_id,
        ARRAY_AGG(DISTINCT tbpsc.problem_statements_id ORDER BY tbpsc.problem_statements_id) AS problem_statement_ids
    FROM chat_problem_statements_connection tbpsc
    WHERE tbpsc.active = true
    GROUP BY tbpsc.chat_id
),
objective_agg AS (
    SELECT
        tboc.chat_id,
        ARRAY_AGG(DISTINCT tboc.objectives_id ORDER BY tboc.objectives_id) AS objective_ids
    FROM chat_objectives_connection tboc
    WHERE tboc.active = true
    GROUP BY tboc.chat_id
),
flag_agg AS (
    SELECT
        tbfc.chat_id,
        ARRAY_AGG(DISTINCT tbfc.flags_id ORDER BY tbfc.flags_id) AS flag_ids
    FROM chat_flags_connection tbfc
    WHERE tbfc.active = true
    GROUP BY tbfc.chat_id
),
name_agg AS (
    SELECT
        tbnc.chat_id,
        ARRAY_AGG(DISTINCT tbnc.names_id ORDER BY tbnc.names_id) AS name_ids
    FROM chat_names_connection tbnc
    WHERE tbnc.active = true
    GROUP BY tbnc.chat_id
),
description_agg AS (
    SELECT
        tbdc.chat_id,
        ARRAY_AGG(DISTINCT tbdc.descriptions_id ORDER BY tbdc.descriptions_id) AS description_ids
    FROM chat_descriptions_connection tbdc
    WHERE tbdc.active = true
    GROUP BY tbdc.chat_id
),
persona_agg AS (
    SELECT
        tbpc.chat_id,
        ARRAY_AGG(DISTINCT tbpc.personas_id ORDER BY tbpc.personas_id) AS persona_ids
    FROM chat_personas_connection tbpc
    WHERE tbpc.active = true
    GROUP BY tbpc.chat_id
),
rubric_agg AS (
    SELECT
        tbrc.chat_id,
        ARRAY_AGG(DISTINCT tbrc.rubrics_id ORDER BY tbrc.rubrics_id) AS rubric_ids
    FROM chat_rubrics_connection tbrc
    WHERE tbrc.active = true
    GROUP BY tbrc.chat_id
),
standard_agg AS (
    SELECT
        tbsc.chat_id,
        ARRAY_AGG(DISTINCT tbsc.standards_id ORDER BY tbsc.standards_id) AS standard_ids
    FROM chat_standards_connection tbsc
    WHERE tbsc.active = true
    GROUP BY tbsc.chat_id
),
standard_group_agg AS (
    SELECT
        tbsgc.chat_id,
        ARRAY_AGG(DISTINCT tbsgc.standard_groups_id ORDER BY tbsgc.standard_groups_id) AS standard_group_ids
    FROM chat_standard_groups_connection tbsgc
    WHERE tbsgc.active = true
    GROUP BY tbsgc.chat_id
),
-- Scenario flags: resolved from scenario_flags_junction via scenario_scenarios_junction.
-- Each bundle has one scenario (via chat_scenarios_connection);
-- we resolve scenario_artifact via scenario_scenarios_junction
-- then pivot the 5 flags into boolean columns.
flag_pivot AS (
    SELECT
        ss.chat_id,
        COALESCE(BOOL_OR(CASE WHEN fr.type = 'video_enabled' THEN sfj.value END), false) AS video_enabled,
        COALESCE(BOOL_OR(CASE WHEN fr.type = 'problem_statement_enabled' THEN sfj.value END), false) AS problem_statement_enabled,
        COALESCE(BOOL_OR(CASE WHEN fr.type = 'objectives_enabled' THEN sfj.value END), false) AS objectives_enabled,
        COALESCE(BOOL_OR(CASE WHEN fr.type = 'images_enabled' THEN sfj.value END), false) AS images_enabled,
        COALESCE(BOOL_OR(CASE WHEN fr.type = 'questions_enabled' THEN sfj.value END), false) AS questions_enabled
    FROM scenario_single ss
    JOIN scenario_scenarios_junction ssj
      ON ssj.scenarios_id = ss.scenario_id AND ssj.active = true
    JOIN scenario_flags_junction sfj
      ON sfj.scenario_id = ssj.scenario_id AND sfj.active = true
    JOIN flags_resource fr
      ON fr.id = sfj.flag_id
    WHERE fr.type IN (
          'video_enabled',
          'problem_statement_enabled',
          'objectives_enabled',
          'images_enabled',
          'questions_enabled'
      )
    GROUP BY ss.chat_id
)
SELECT
    tbe.id AS chat_entry_id,
    COALESCE(hte.home_id, pte.practice_id) AS parent_id,

    -- Single scenario_id (from connection, not direct FK)
    ss.scenario_id,

    -- Bundle-level resource ID arrays
    COALESCE(dep.department_ids, ARRAY[]::uuid[]) AS department_ids,
    COALESCE(doc.document_ids, ARRAY[]::uuid[]) AS document_ids,
    COALESCE(pf.parameter_field_ids, ARRAY[]::uuid[]) AS parameter_field_ids,
    COALESCE(que.question_ids, ARRAY[]::uuid[]) AS question_ids,
    COALESCE(opt.option_ids, ARRAY[]::uuid[]) AS option_ids,
    COALESCE(vid.video_ids, ARRAY[]::uuid[]) AS video_ids,
    COALESCE(img.image_ids, ARRAY[]::uuid[]) AS image_ids,
    COALESCE(ps.problem_statement_ids, ARRAY[]::uuid[]) AS problem_statement_ids,
    COALESCE(obj.objective_ids, ARRAY[]::uuid[]) AS objective_ids,
    COALESCE(flg.flag_ids, ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(nm.name_ids, ARRAY[]::uuid[]) AS name_ids,
    COALESCE(dsc.description_ids, ARRAY[]::uuid[]) AS description_ids,
    COALESCE(per.persona_ids, ARRAY[]::uuid[]) AS persona_ids,
    COALESCE(rub.rubric_ids, ARRAY[]::uuid[]) AS rubric_ids,
    COALESCE(std.standard_ids, ARRAY[]::uuid[]) AS standard_ids,
    COALESCE(stg.standard_group_ids, ARRAY[]::uuid[]) AS standard_group_ids,

    -- Scenario flags (resolved from scenario_flags_junction — fixed booleans)
    COALESCE(fp.video_enabled, false) AS video_enabled,
    COALESCE(fp.problem_statement_enabled, false) AS problem_statement_enabled,
    COALESCE(fp.objectives_enabled, false) AS objectives_enabled,
    COALESCE(fp.images_enabled, false) AS images_enabled,
    COALESCE(fp.questions_enabled, false) AS questions_enabled,

    -- Chat entry direct fields
    tbe."position",
    tbe.time_limit,
    tbe.negative_time,
    tbe.name,
    tbe.description,
    tbe.use_custom,
    tbe.use_previous,
    tbe.audio_enabled,
    tbe.text_enabled,
    tbe.hints_enabled,
    tbe.copy_paste_allowed,
    tbe.show_images,
    tbe.show_objectives,
    tbe.show_problem_statement,
    tbe.analyses_enabled,
    tbe.improvements_enabled,
    tbe.replacements_enabled,
    tbe.strengths_enabled,

    -- Generate flags
    tbe.generate_problem_statements,
    tbe.generate_objectives,
    tbe.generate_videos,
    tbe.generate_images,
    tbe.generate_questions,
    tbe.generate_names,
    tbe.generate_descriptions,
    tbe.generate_personas,
    tbe.generate_documents,
    tbe.generate_options,
    tbe.generate_parameter_fields,

    tbe.created_at,
    tbe.updated_at,
    tbe.active

FROM chat_entry tbe
LEFT JOIN home_chat_entry hte ON hte.chat_id = tbe.id
LEFT JOIN practice_chat_entry pte ON pte.chat_id = tbe.id
LEFT JOIN scenario_single ss ON ss.chat_id = tbe.id
LEFT JOIN department_agg dep ON dep.chat_id = tbe.id
LEFT JOIN document_agg doc ON doc.chat_id = tbe.id
LEFT JOIN parameter_field_agg pf ON pf.chat_id = tbe.id
LEFT JOIN question_agg que ON que.chat_id = tbe.id
LEFT JOIN option_agg opt ON opt.chat_id = tbe.id
LEFT JOIN video_agg vid ON vid.chat_id = tbe.id
LEFT JOIN image_agg img ON img.chat_id = tbe.id
LEFT JOIN problem_statement_agg ps ON ps.chat_id = tbe.id
LEFT JOIN objective_agg obj ON obj.chat_id = tbe.id
LEFT JOIN flag_agg flg ON flg.chat_id = tbe.id
LEFT JOIN name_agg nm ON nm.chat_id = tbe.id
LEFT JOIN description_agg dsc ON dsc.chat_id = tbe.id
LEFT JOIN persona_agg per ON per.chat_id = tbe.id
LEFT JOIN rubric_agg rub ON rub.chat_id = tbe.id
LEFT JOIN standard_agg std ON std.chat_id = tbe.id
LEFT JOIN standard_group_agg stg ON stg.chat_id = tbe.id
LEFT JOIN flag_pivot fp ON fp.chat_id = tbe.id
WHERE tbe.active = true
WITH NO DATA;

CREATE UNIQUE INDEX chat_mv_pk
    ON chat_mv (chat_entry_id);

CREATE INDEX chat_mv_parent_id_idx
    ON chat_mv (parent_id);

CREATE INDEX chat_mv_scenario_id_idx
    ON chat_mv (scenario_id);

CREATE INDEX chat_mv_department_ids_gin_idx
    ON chat_mv USING GIN (department_ids);

REFRESH MATERIALIZED VIEW chat_mv;

CREATE MATERIALIZED VIEW chat_mv AS
WITH
-- Resolve single scenario_id from chat_scenarios_connection
scenario_single AS (
    SELECT DISTINCT ON (tbsc.chat_id)
        tbsc.chat_id,
        tbsc.scenarios_id AS scenario_id
    FROM chat_scenarios_connection tbsc
    WHERE tbsc.active = true
    ORDER BY tbsc.chat_id, tbsc.scenarios_id
),
-- chat_entry level connections
department_agg AS (
    SELECT
        tbdc.chat_id,
        ARRAY_AGG(DISTINCT tbdc.departments_id ORDER BY tbdc.departments_id) AS department_ids
    FROM chat_departments_connection tbdc
    WHERE tbdc.active = true
    GROUP BY tbdc.chat_id
),
document_agg AS (
    SELECT
        tbdc.chat_id,
        ARRAY_AGG(DISTINCT tbdc.documents_id ORDER BY tbdc.documents_id) AS document_ids
    FROM chat_documents_connection tbdc
    WHERE tbdc.active = true
    GROUP BY tbdc.chat_id
),
parameter_field_agg AS (
    SELECT
        tbpfc.chat_id,
        ARRAY_AGG(DISTINCT tbpfc.parameter_fields_id ORDER BY tbpfc.parameter_fields_id) AS parameter_field_ids
    FROM chat_parameter_fields_connection tbpfc
    WHERE tbpfc.active = true
    GROUP BY tbpfc.chat_id
),
question_agg AS (
    SELECT
        tbqc.chat_id,
        ARRAY_AGG(DISTINCT tbqc.questions_id ORDER BY tbqc.questions_id) AS question_ids
    FROM chat_questions_connection tbqc
    WHERE tbqc.active = true
    GROUP BY tbqc.chat_id
),
option_agg AS (
    SELECT
        tboc.chat_id,
        ARRAY_AGG(DISTINCT tboc.options_id ORDER BY tboc.options_id) AS option_ids
    FROM chat_options_connection tboc
    WHERE tboc.active = true
    GROUP BY tboc.chat_id
),
video_agg AS (
    SELECT
        tbvc.chat_id,
        ARRAY_AGG(DISTINCT tbvc.videos_id ORDER BY tbvc.videos_id) AS video_ids
    FROM chat_videos_connection tbvc
    WHERE tbvc.active = true
    GROUP BY tbvc.chat_id
),
image_agg AS (
    SELECT
        tbic.chat_id,
        ARRAY_AGG(DISTINCT tbic.images_id ORDER BY tbic.images_id) AS image_ids
    FROM chat_images_connection tbic
    WHERE tbic.active = true
    GROUP BY tbic.chat_id
),
problem_statement_agg AS (
    SELECT
        tbpsc.chat_id,
        ARRAY_AGG(DISTINCT tbpsc.problem_statements_id ORDER BY tbpsc.problem_statements_id) AS problem_statement_ids
    FROM chat_problem_statements_connection tbpsc
    WHERE tbpsc.active = true
    GROUP BY tbpsc.chat_id
),
objective_agg AS (
    SELECT
        tboc.chat_id,
        ARRAY_AGG(DISTINCT tboc.objectives_id ORDER BY tboc.objectives_id) AS objective_ids
    FROM chat_objectives_connection tboc
    WHERE tboc.active = true
    GROUP BY tboc.chat_id
),
flag_agg AS (
    SELECT
        tbfc.chat_id,
        ARRAY_AGG(DISTINCT tbfc.flags_id ORDER BY tbfc.flags_id) AS flag_ids
    FROM chat_flags_connection tbfc
    WHERE tbfc.active = true
    GROUP BY tbfc.chat_id
),
name_agg AS (
    SELECT
        tbnc.chat_id,
        ARRAY_AGG(DISTINCT tbnc.names_id ORDER BY tbnc.names_id) AS name_ids
    FROM chat_names_connection tbnc
    WHERE tbnc.active = true
    GROUP BY tbnc.chat_id
),
description_agg AS (
    SELECT
        tbdc.chat_id,
        ARRAY_AGG(DISTINCT tbdc.descriptions_id ORDER BY tbdc.descriptions_id) AS description_ids
    FROM chat_descriptions_connection tbdc
    WHERE tbdc.active = true
    GROUP BY tbdc.chat_id
),
persona_agg AS (
    SELECT
        tbpc.chat_id,
        ARRAY_AGG(DISTINCT tbpc.personas_id ORDER BY tbpc.personas_id) AS persona_ids
    FROM chat_personas_connection tbpc
    WHERE tbpc.active = true
    GROUP BY tbpc.chat_id
),
rubric_agg AS (
    SELECT
        tbrc.chat_id,
        ARRAY_AGG(DISTINCT tbrc.rubrics_id ORDER BY tbrc.rubrics_id) AS rubric_ids
    FROM chat_rubrics_connection tbrc
    WHERE tbrc.active = true
    GROUP BY tbrc.chat_id
),
standard_agg AS (
    SELECT
        tbsc.chat_id,
        ARRAY_AGG(DISTINCT tbsc.standards_id ORDER BY tbsc.standards_id) AS standard_ids
    FROM chat_standards_connection tbsc
    WHERE tbsc.active = true
    GROUP BY tbsc.chat_id
),
standard_group_agg AS (
    SELECT
        tbsgc.chat_id,
        ARRAY_AGG(DISTINCT tbsgc.standard_groups_id ORDER BY tbsgc.standard_groups_id) AS standard_group_ids
    FROM chat_standard_groups_connection tbsgc
    WHERE tbsgc.active = true
    GROUP BY tbsgc.chat_id
),
-- Scenario flags: resolved from scenario_flags_junction via scenario_scenarios_junction.
-- Each bundle has one scenario (via chat_scenarios_connection);
-- we resolve scenario_artifact via scenario_scenarios_junction
-- then pivot the 5 flags into boolean columns.
flag_pivot AS (
    SELECT
        ss.chat_id,
        COALESCE(BOOL_OR(CASE WHEN fr.type = 'video_enabled' THEN sfj.value END), false) AS video_enabled,
        COALESCE(BOOL_OR(CASE WHEN fr.type = 'problem_statement_enabled' THEN sfj.value END), false) AS problem_statement_enabled,
        COALESCE(BOOL_OR(CASE WHEN fr.type = 'objectives_enabled' THEN sfj.value END), false) AS objectives_enabled,
        COALESCE(BOOL_OR(CASE WHEN fr.type = 'images_enabled' THEN sfj.value END), false) AS images_enabled,
        COALESCE(BOOL_OR(CASE WHEN fr.type = 'questions_enabled' THEN sfj.value END), false) AS questions_enabled
    FROM scenario_single ss
    JOIN scenario_scenarios_junction ssj
      ON ssj.scenarios_id = ss.scenario_id AND ssj.active = true
    JOIN scenario_flags_junction sfj
      ON sfj.scenario_id = ssj.scenario_id AND sfj.active = true
    JOIN flags_resource fr
      ON fr.id = sfj.flag_id
    WHERE fr.type IN (
          'video_enabled',
          'problem_statement_enabled',
          'objectives_enabled',
          'images_enabled',
          'questions_enabled'
      )
    GROUP BY ss.chat_id
)
SELECT
    tbe.id AS chat_entry_id,
    COALESCE(hte.home_id, pte.practice_id) AS parent_id,

    -- Single scenario_id (from connection, not direct FK)
    ss.scenario_id,

    -- Bundle-level resource ID arrays
    COALESCE(dep.department_ids, ARRAY[]::uuid[]) AS department_ids,
    COALESCE(doc.document_ids, ARRAY[]::uuid[]) AS document_ids,
    COALESCE(pf.parameter_field_ids, ARRAY[]::uuid[]) AS parameter_field_ids,
    COALESCE(que.question_ids, ARRAY[]::uuid[]) AS question_ids,
    COALESCE(opt.option_ids, ARRAY[]::uuid[]) AS option_ids,
    COALESCE(vid.video_ids, ARRAY[]::uuid[]) AS video_ids,
    COALESCE(img.image_ids, ARRAY[]::uuid[]) AS image_ids,
    COALESCE(ps.problem_statement_ids, ARRAY[]::uuid[]) AS problem_statement_ids,
    COALESCE(obj.objective_ids, ARRAY[]::uuid[]) AS objective_ids,
    COALESCE(flg.flag_ids, ARRAY[]::uuid[]) AS flag_ids,
    COALESCE(nm.name_ids, ARRAY[]::uuid[]) AS name_ids,
    COALESCE(dsc.description_ids, ARRAY[]::uuid[]) AS description_ids,
    COALESCE(per.persona_ids, ARRAY[]::uuid[]) AS persona_ids,
    COALESCE(rub.rubric_ids, ARRAY[]::uuid[]) AS rubric_ids,
    COALESCE(std.standard_ids, ARRAY[]::uuid[]) AS standard_ids,
    COALESCE(stg.standard_group_ids, ARRAY[]::uuid[]) AS standard_group_ids,

    -- Scenario flags (resolved from scenario_flags_junction — fixed booleans)
    COALESCE(fp.video_enabled, false) AS video_enabled,
    COALESCE(fp.problem_statement_enabled, false) AS problem_statement_enabled,
    COALESCE(fp.objectives_enabled, false) AS objectives_enabled,
    COALESCE(fp.images_enabled, false) AS images_enabled,
    COALESCE(fp.questions_enabled, false) AS questions_enabled,

    -- Chat entry direct fields
    tbe."position",
    tbe.time_limit,
    tbe.negative_time,
    tbe.name,
    tbe.description,
    tbe.use_custom,
    tbe.use_previous,
    tbe.audio_enabled,
    tbe.text_enabled,
    tbe.hints_enabled,
    tbe.copy_paste_allowed,
    tbe.show_images,
    tbe.show_objectives,
    tbe.show_problem_statement,
    tbe.analyses_enabled,
    tbe.improvements_enabled,
    tbe.replacements_enabled,
    tbe.strengths_enabled,

    -- Generate flags
    tbe.generate_problem_statements,
    tbe.generate_objectives,
    tbe.generate_videos,
    tbe.generate_images,
    tbe.generate_questions,
    tbe.generate_names,
    tbe.generate_descriptions,
    tbe.generate_personas,
    tbe.generate_documents,
    tbe.generate_options,
    tbe.generate_parameter_fields,

    tbe.created_at,
    tbe.updated_at,
    tbe.active

FROM chat_entry tbe
LEFT JOIN home_chat_entry hte ON hte.chat_id = tbe.id
LEFT JOIN practice_chat_entry pte ON pte.chat_id = tbe.id
LEFT JOIN scenario_single ss ON ss.chat_id = tbe.id
LEFT JOIN department_agg dep ON dep.chat_id = tbe.id
LEFT JOIN document_agg doc ON doc.chat_id = tbe.id
LEFT JOIN parameter_field_agg pf ON pf.chat_id = tbe.id
LEFT JOIN question_agg que ON que.chat_id = tbe.id
LEFT JOIN option_agg opt ON opt.chat_id = tbe.id
LEFT JOIN video_agg vid ON vid.chat_id = tbe.id
LEFT JOIN image_agg img ON img.chat_id = tbe.id
LEFT JOIN problem_statement_agg ps ON ps.chat_id = tbe.id
LEFT JOIN objective_agg obj ON obj.chat_id = tbe.id
LEFT JOIN flag_agg flg ON flg.chat_id = tbe.id
LEFT JOIN name_agg nm ON nm.chat_id = tbe.id
LEFT JOIN description_agg dsc ON dsc.chat_id = tbe.id
LEFT JOIN persona_agg per ON per.chat_id = tbe.id
LEFT JOIN rubric_agg rub ON rub.chat_id = tbe.id
LEFT JOIN standard_agg std ON std.chat_id = tbe.id
LEFT JOIN standard_group_agg stg ON stg.chat_id = tbe.id
LEFT JOIN flag_pivot fp ON fp.chat_id = tbe.id
WHERE tbe.active = true
WITH NO DATA;
