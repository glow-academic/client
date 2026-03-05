-- Scenario ID Fetching (Query 2 of Two-Pass Architecture)
-- Returns all resource IDs for parallel resource fetching
-- Agent/tool resolution moved to settings layer in Python

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_scenario_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop legacy composite type (no longer needed)
DROP TYPE IF EXISTS scenario_candidate_agent CASCADE;

-- Create function
CREATE OR REPLACE FUNCTION api_get_scenario_ids_v4(
    profile_id uuid,
    scenario_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or scenario junction)
    names_id uuid,
    descriptions_id uuid,
    problem_statements_id uuid,
    active_flag_id uuid,
    objectives_enabled_flag_id uuid,
    images_enabled_flag_id uuid,
    video_enabled_flag_id uuid,
    questions_enabled_flag_id uuid,
    problem_statement_enabled_flag_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    persona_ids uuid[],
    document_ids uuid[],
    parameter_ids uuid[],
    parameter_field_ids uuid[],
    objective_ids uuid[],
    image_ids uuid[],
    video_ids uuid[],
    question_ids uuid[],
    option_ids uuid[],

    -- Suggestion IDs (computed in Python via search endpoints)
    name_suggestions uuid[],
    description_suggestions uuid[],
    problem_statement_suggestions uuid[],
    persona_suggestions uuid[],
    document_suggestions uuid[],
    parameter_suggestions uuid[],
    objective_suggestions uuid[],
    image_suggestions uuid[],
    video_suggestions uuid[],
    question_suggestions uuid[],
    option_suggestions uuid[],

    -- Video enabled flag value (for video parameter filtering)
    video_enabled_value boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        scenario_id AS scenario_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Draft multi-select resource IDs
draft_departments_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(dd.department_id ORDER BY dd.created_at), NULL), ARRAY[]::uuid[]) as department_ids
    FROM params x
    LEFT JOIN scenario_drafts_departments_connection dd ON dd.draft_id = x.draft_id
    LIMIT 1
),
draft_personas_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(dp.persona_id ORDER BY dp.created_at), NULL), ARRAY[]::uuid[]) as persona_ids
    FROM params x
    LEFT JOIN scenario_drafts_personas_connection dp ON dp.draft_id = x.draft_id
    LIMIT 1
),
draft_documents_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(dd.document_id ORDER BY dd.created_at), NULL), ARRAY[]::uuid[]) as document_ids
    FROM params x
    LEFT JOIN scenario_drafts_documents_connection dd ON dd.draft_id = x.draft_id
    LIMIT 1
),
-- scenario_drafts_parameters_connection dropped — parameter_ids now derived from parameter_fields
draft_parameters_data AS (
    SELECT ARRAY[]::uuid[] as parameter_ids
    FROM params x
    LIMIT 1
),
draft_parameter_fields_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(df.parameter_fields_id ORDER BY df.created_at), NULL), ARRAY[]::uuid[]) as parameter_field_ids
    FROM params x
    LEFT JOIN scenario_drafts_parameter_fields_connection df ON df.draft_id = x.draft_id
    LIMIT 1
),
draft_objectives_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(od.objectives_id ORDER BY od.created_at), NULL), ARRAY[]::uuid[]) as objective_ids
    FROM params x
    LEFT JOIN scenario_drafts_objectives_connection od ON od.draft_id = x.draft_id
    LIMIT 1
),
draft_images_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(di.image_id ORDER BY di.created_at), NULL), ARRAY[]::uuid[]) as image_ids
    FROM params x
    LEFT JOIN scenario_drafts_images_connection di ON di.draft_id = x.draft_id
    LIMIT 1
),
draft_videos_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(dv.video_id ORDER BY dv.created_at), NULL), ARRAY[]::uuid[]) as video_ids
    FROM params x
    LEFT JOIN scenario_drafts_videos_connection dv ON dv.draft_id = x.draft_id
    LIMIT 1
),
draft_questions_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(dq.question_id ORDER BY dq.created_at), NULL), ARRAY[]::uuid[]) as question_ids
    FROM params x
    LEFT JOIN scenario_drafts_questions_connection dq ON dq.draft_id = x.draft_id
    LIMIT 1
),
-- Scenario junction multi-select resource IDs
scenario_departments_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT scenario_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(sd.department_id ORDER BY sd.created_at)
                 FROM scenario_departments_junction sd
                 WHERE sd.scenario_id = (SELECT scenario_id FROM params) AND sd.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
scenario_personas_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT scenario_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(sp.persona_id ORDER BY sp.persona_id)
                 FROM scenario_personas_junction sp
                 WHERE sp.scenario_id = (SELECT scenario_id FROM params) AND sp.active = true),
                ARRAY[]::uuid[]
            )
        END as persona_ids
    FROM params
    LIMIT 1
),
scenario_documents_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT scenario_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(sd.document_id ORDER BY sd.document_id)
                 FROM scenario_documents_junction sd
                 WHERE sd.scenario_id = (SELECT scenario_id FROM params) AND sd.active = true),
                ARRAY[]::uuid[]
            )
        END as document_ids
    FROM params
    LIMIT 1
),
-- scenario_parameters_junction dropped — parameter_ids now derived from parameter_fields
scenario_parameters_junction_data AS (
    SELECT ARRAY[]::uuid[] as parameter_ids
    FROM params
    LIMIT 1
),
scenario_parameter_fields_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT scenario_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(spf.parameter_fields_id ORDER BY spf.parameter_fields_id)
                 FROM scenario_parameter_fields_junction spf
                 WHERE spf.scenario_id = (SELECT scenario_id FROM params) AND spf.active = true),
                ARRAY[]::uuid[]
            )
        END as parameter_field_ids
    FROM params
    LIMIT 1
),
scenario_objectives_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT scenario_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(so.objectives_id ORDER BY so.objectives_id)
                 FROM scenario_objectives_junction so
                 WHERE so.scenario_id = (SELECT scenario_id FROM params)),
                ARRAY[]::uuid[]
            )
        END as objective_ids
    FROM params
    LIMIT 1
),
scenario_images_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT scenario_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(si.image_id ORDER BY si.created_at)
                 FROM scenario_images_junction si
                 WHERE si.scenario_id = (SELECT scenario_id FROM params) AND si.active = true),
                ARRAY[]::uuid[]
            )
        END as image_ids
    FROM params
    LIMIT 1
),
scenario_videos_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT scenario_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(sv.video_id ORDER BY sv.created_at)
                 FROM scenario_videos_junction sv
                 WHERE sv.scenario_id = (SELECT scenario_id FROM params) AND sv.active = true),
                ARRAY[]::uuid[]
            )
        END as video_ids
    FROM params
    LIMIT 1
),
scenario_questions_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT scenario_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(sq.question_id ORDER BY sq.created_at)
                 FROM scenario_questions_junction sq
                 WHERE sq.scenario_id = (SELECT scenario_id FROM params) AND sq.active = true),
                ARRAY[]::uuid[]
            )
        END as question_ids
    FROM params
    LIMIT 1
),
-- Combined multi-select IDs (draft preferred over scenario)
scenario_departments_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT department_ids FROM draft_departments_data), 1), 0) > 0
                THEN (SELECT department_ids FROM draft_departments_data)
            WHEN COALESCE(array_length((SELECT department_ids FROM scenario_departments_junction_data), 1), 0) > 0
                THEN (SELECT department_ids FROM scenario_departments_junction_data)
            ELSE ARRAY[]::uuid[]
        END as department_ids
    FROM params
    LIMIT 1
),
scenario_personas_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT persona_ids FROM draft_personas_data), 1), 0) > 0
                THEN (SELECT persona_ids FROM draft_personas_data)
            WHEN COALESCE(array_length((SELECT persona_ids FROM scenario_personas_junction_data), 1), 0) > 0
                THEN (SELECT persona_ids FROM scenario_personas_junction_data)
            ELSE ARRAY[]::uuid[]
        END as persona_ids
    FROM params
    LIMIT 1
),
scenario_documents_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT document_ids FROM draft_documents_data), 1), 0) > 0
                THEN (SELECT document_ids FROM draft_documents_data)
            WHEN COALESCE(array_length((SELECT document_ids FROM scenario_documents_junction_data), 1), 0) > 0
                THEN (SELECT document_ids FROM scenario_documents_junction_data)
            ELSE ARRAY[]::uuid[]
        END as document_ids
    FROM params
    LIMIT 1
),
scenario_parameters_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT parameter_ids FROM draft_parameters_data), 1), 0) > 0
                THEN (SELECT parameter_ids FROM draft_parameters_data)
            WHEN COALESCE(array_length((SELECT parameter_ids FROM scenario_parameters_junction_data), 1), 0) > 0
                THEN (SELECT parameter_ids FROM scenario_parameters_junction_data)
            ELSE ARRAY[]::uuid[]
        END as parameter_ids
    FROM params
    LIMIT 1
),
scenario_parameter_fields_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT parameter_field_ids FROM draft_parameter_fields_data), 1), 0) > 0
                THEN (SELECT parameter_field_ids FROM draft_parameter_fields_data)
            WHEN COALESCE(array_length((SELECT parameter_field_ids FROM scenario_parameter_fields_junction_data), 1), 0) > 0
                THEN (SELECT parameter_field_ids FROM scenario_parameter_fields_junction_data)
            ELSE ARRAY[]::uuid[]
        END as parameter_field_ids
    FROM params
    LIMIT 1
),
scenario_objectives_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT objective_ids FROM draft_objectives_data), 1), 0) > 0
                THEN (SELECT objective_ids FROM draft_objectives_data)
            WHEN COALESCE(array_length((SELECT objective_ids FROM scenario_objectives_junction_data), 1), 0) > 0
                THEN (SELECT objective_ids FROM scenario_objectives_junction_data)
            ELSE ARRAY[]::uuid[]
        END as objective_ids
    FROM params
    LIMIT 1
),
scenario_images_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT image_ids FROM draft_images_data), 1), 0) > 0
                THEN (SELECT image_ids FROM draft_images_data)
            WHEN COALESCE(array_length((SELECT image_ids FROM scenario_images_junction_data), 1), 0) > 0
                THEN (SELECT image_ids FROM scenario_images_junction_data)
            ELSE ARRAY[]::uuid[]
        END as image_ids
    FROM params
    LIMIT 1
),
scenario_videos_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT video_ids FROM draft_videos_data), 1), 0) > 0
                THEN (SELECT video_ids FROM draft_videos_data)
            WHEN COALESCE(array_length((SELECT video_ids FROM scenario_videos_junction_data), 1), 0) > 0
                THEN (SELECT video_ids FROM scenario_videos_junction_data)
            ELSE ARRAY[]::uuid[]
        END as video_ids
    FROM params
    LIMIT 1
),
scenario_questions_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT question_ids FROM draft_questions_data), 1), 0) > 0
                THEN (SELECT question_ids FROM draft_questions_data)
            WHEN COALESCE(array_length((SELECT question_ids FROM scenario_questions_junction_data), 1), 0) > 0
                THEN (SELECT question_ids FROM scenario_questions_junction_data)
            ELSE ARRAY[]::uuid[]
        END as question_ids
    FROM params
    LIMIT 1
),
scenario_options_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT scenario_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(so.option_id ORDER BY so.created_at)
                 FROM scenario_options_junction so
                 WHERE so.scenario_id = (SELECT scenario_id FROM params) AND so.active = true),
                ARRAY[]::uuid[]
            )
        END as option_ids
    FROM params
    LIMIT 1
),
scenario_options_combined_data AS (
    SELECT
        CASE
            WHEN COALESCE(array_length((SELECT option_ids FROM scenario_options_junction_data), 1), 0) > 0
                THEN (SELECT option_ids FROM scenario_options_junction_data)
            ELSE ARRAY[]::uuid[]
        END as option_ids
    FROM params
    LIMIT 1
),
-- Single-select resource IDs (from draft or scenario junction)
name_resource_data AS (
    SELECT COALESCE(
        (SELECT n.id FROM scenario_drafts_names_connection dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT sn.names_id FROM scenario_names_junction sn WHERE sn.scenario_id = (SELECT scenario_id FROM params) LIMIT 1)
    ) as names_id
    FROM params
),
description_resource_data AS (
    SELECT COALESCE(
        (SELECT dd.descriptions_id FROM scenario_drafts_descriptions_connection dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT sd.descriptions_id FROM scenario_descriptions_junction sd WHERE sd.scenario_id = (SELECT scenario_id FROM params) LIMIT 1)
    ) as descriptions_id
    FROM params
),
problem_statement_resource_data AS (
    SELECT COALESCE(
        (SELECT dps.problem_statements_id FROM scenario_drafts_problem_statements_connection dps WHERE dps.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT sps.problem_statements_id FROM scenario_problem_statements_junction sps WHERE sps.scenario_id = (SELECT scenario_id FROM params) AND sps.active = true LIMIT 1)
    ) as problem_statements_id
    FROM params
),
-- Flag retrieval follows the same pattern as Persona: draft flags are retrieved by exact ID
-- without filtering by flag type, since the draft stores the exact flag_option_id selected.
-- The fallback to scenario_flags_junction uses the appropriate flag types for each flag type.
active_flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flag_id FROM scenario_drafts_flags_connection df JOIN flags_resource f ON df.flag_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.type = 'scenario_active' LIMIT 1),
        (SELECT sf.flag_id FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = (SELECT scenario_id FROM params) AND f.type = 'scenario_active' AND f.value = TRUE AND sf.active = true LIMIT 1)
    ) as active_flag_id
    FROM params
),
objectives_enabled_flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flag_id FROM scenario_drafts_flags_connection df JOIN flags_resource f ON df.flag_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.type = 'objectives_enabled' LIMIT 1),
        (SELECT sf.flag_id FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = (SELECT scenario_id FROM params) AND f.type = 'objectives_enabled' AND f.value = TRUE AND sf.active = true LIMIT 1)
    ) as objectives_enabled_flag_id
    FROM params
),
images_enabled_flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flag_id FROM scenario_drafts_flags_connection df JOIN flags_resource f ON df.flag_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.type = 'images_enabled' LIMIT 1),
        (SELECT sf.flag_id FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = (SELECT scenario_id FROM params) AND f.type = 'images_enabled' AND f.value = TRUE AND sf.active = true LIMIT 1)
    ) as images_enabled_flag_id
    FROM params
),
video_enabled_flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flag_id FROM scenario_drafts_flags_connection df JOIN flags_resource f ON df.flag_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.type = 'video_enabled' LIMIT 1),
        (SELECT sf.flag_id FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = (SELECT scenario_id FROM params) AND f.type = 'video_enabled' AND f.value = TRUE AND sf.active = true LIMIT 1)
    ) as video_enabled_flag_id
    FROM params
),
questions_enabled_flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flag_id FROM scenario_drafts_flags_connection df JOIN flags_resource f ON df.flag_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.type = 'questions_enabled' LIMIT 1),
        (SELECT sf.flag_id FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = (SELECT scenario_id FROM params) AND f.type = 'questions_enabled' AND f.value = TRUE AND sf.active = true LIMIT 1)
    ) as questions_enabled_flag_id
    FROM params
),
problem_statement_enabled_flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flag_id FROM scenario_drafts_flags_connection df JOIN flags_resource f ON df.flag_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.type = 'problem_statement_enabled' LIMIT 1),
        (SELECT sf.flag_id FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = (SELECT scenario_id FROM params) AND f.type = 'problem_statement_enabled' AND f.value = TRUE AND sf.active = true LIMIT 1)
    ) as problem_statement_enabled_flag_id
    FROM params
),
-- Video enabled value for filtering (not just flag ID, but actual boolean value)
video_enabled_value_data AS (
    SELECT COALESCE(
        (SELECT f.value
         FROM scenario_flags_junction sf
         JOIN flags_resource f ON sf.flag_id = f.id
         WHERE sf.scenario_id = (SELECT scenario_id FROM params)
           AND f.type = 'video_enabled'
           AND sf.active = true
         LIMIT 1),
        false
    ) as video_enabled_value
    FROM params
)
SELECT
    -- Single-select resource IDs
    (SELECT names_id FROM name_resource_data) as names_id,
    (SELECT descriptions_id FROM description_resource_data) as descriptions_id,
    (SELECT problem_statements_id FROM problem_statement_resource_data) as problem_statements_id,
    (SELECT active_flag_id FROM active_flag_resource_data) as active_flag_id,
    (SELECT objectives_enabled_flag_id FROM objectives_enabled_flag_resource_data) as objectives_enabled_flag_id,
    (SELECT images_enabled_flag_id FROM images_enabled_flag_resource_data) as images_enabled_flag_id,
    (SELECT video_enabled_flag_id FROM video_enabled_flag_resource_data) as video_enabled_flag_id,
    (SELECT questions_enabled_flag_id FROM questions_enabled_flag_resource_data) as questions_enabled_flag_id,
    (SELECT problem_statement_enabled_flag_id FROM problem_statement_enabled_flag_resource_data) as problem_statement_enabled_flag_id,

    -- Multi-select resource IDs
    (SELECT department_ids FROM scenario_departments_combined_data) as department_ids,
    (SELECT persona_ids FROM scenario_personas_combined_data) as persona_ids,
    (SELECT document_ids FROM scenario_documents_combined_data) as document_ids,
    (SELECT parameter_ids FROM scenario_parameters_combined_data) as parameter_ids,
    (SELECT parameter_field_ids FROM scenario_parameter_fields_combined_data) as parameter_field_ids,
    (SELECT objective_ids FROM scenario_objectives_combined_data) as objective_ids,
    (SELECT image_ids FROM scenario_images_combined_data) as image_ids,
    (SELECT video_ids FROM scenario_videos_combined_data) as video_ids,
    (SELECT question_ids FROM scenario_questions_combined_data) as question_ids,
    (SELECT option_ids FROM scenario_options_combined_data) as option_ids,

    -- Suggestion IDs (computed in Python via search endpoints)
    ARRAY[]::uuid[] as name_suggestions,
    ARRAY[]::uuid[] as description_suggestions,
    ARRAY[]::uuid[] as problem_statement_suggestions,
    ARRAY[]::uuid[] as persona_suggestions,
    ARRAY[]::uuid[] as document_suggestions,
    ARRAY[]::uuid[] as parameter_suggestions,
    ARRAY[]::uuid[] as objective_suggestions,
    ARRAY[]::uuid[] as image_suggestions,
    ARRAY[]::uuid[] as video_suggestions,
    ARRAY[]::uuid[] as question_suggestions,
    ARRAY[]::uuid[] as option_suggestions,

    -- Video enabled flag value
    (SELECT video_enabled_value FROM video_enabled_value_data) as video_enabled_value
FROM params x;
$$;
