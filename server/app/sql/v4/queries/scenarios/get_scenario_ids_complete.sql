-- Scenario ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Create composite type for candidate agents (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scenario_candidate_agent') THEN
        CREATE TYPE scenario_candidate_agent AS (
            agent_id uuid,
            agent_name text,
            tool_resources text[],
            department_ids uuid[],
            updated_at timestamptz,
            is_mcp boolean
        );
    END IF;
END $$;

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
    name_id uuid,
    description_id uuid,
    problem_statement_id uuid,
    active_flag_id uuid,
    objectives_enabled_flag_id uuid,
    images_enabled_flag_id uuid,
    video_enabled_flag_id uuid,
    questions_enabled_flag_id uuid,
    problem_statement_enabled_flag_id uuid,
    use_templates_flag_id uuid,

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
    template_ids uuid[],

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
    template_suggestions uuid[],

    -- Candidate agents (for Python-side agent scoring)
    candidate_agents scenario_candidate_agent[],

    -- Tools existence flags (for Python to compute show_* flags)
    names_has_tools boolean,
    descriptions_has_tools boolean,
    problem_statements_has_tools boolean,
    departments_has_tools boolean,
    personas_has_tools boolean,
    documents_has_tools boolean,
    parameters_has_tools boolean,
    parameter_fields_has_tools boolean,
    objectives_has_tools boolean,
    images_has_tools boolean,
    videos_has_tools boolean,
    questions_has_tools boolean,
    templates_has_tools boolean
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
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(dd.departments_id ORDER BY dd.created_at), NULL), ARRAY[]::uuid[]) as department_ids
    FROM params x
    LEFT JOIN departments_drafts_connection dd ON dd.draft_id = x.draft_id
    LIMIT 1
),
draft_personas_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(dp.personas_id ORDER BY dp.created_at), NULL), ARRAY[]::uuid[]) as persona_ids
    FROM params x
    LEFT JOIN personas_drafts_connection dp ON dp.draft_id = x.draft_id
    LIMIT 1
),
draft_documents_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(dd.documents_id ORDER BY dd.created_at), NULL), ARRAY[]::uuid[]) as document_ids
    FROM params x
    LEFT JOIN documents_drafts_connection dd ON dd.draft_id = x.draft_id
    LIMIT 1
),
draft_parameters_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(dp.parameters_id ORDER BY dp.created_at), NULL), ARRAY[]::uuid[]) as parameter_ids
    FROM params x
    LEFT JOIN parameters_drafts_connection dp ON dp.draft_id = x.draft_id
    LIMIT 1
),
draft_parameter_fields_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(df.fields_id ORDER BY df.created_at), NULL), ARRAY[]::uuid[]) as parameter_field_ids
    FROM params x
    LEFT JOIN fields_drafts_connection df ON df.draft_id = x.draft_id
    LIMIT 1
),
draft_objectives_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(od.objectives_id ORDER BY od.created_at), NULL), ARRAY[]::uuid[]) as objective_ids
    FROM params x
    LEFT JOIN objectives_drafts_connection od ON od.draft_id = x.draft_id
    LIMIT 1
),
draft_images_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(di.images_id ORDER BY di.created_at), NULL), ARRAY[]::uuid[]) as image_ids
    FROM params x
    LEFT JOIN images_drafts_connection di ON di.draft_id = x.draft_id
    LIMIT 1
),
draft_videos_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(dv.videos_id ORDER BY dv.created_at), NULL), ARRAY[]::uuid[]) as video_ids
    FROM params x
    LEFT JOIN videos_drafts_connection dv ON dv.draft_id = x.draft_id
    LIMIT 1
),
draft_questions_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(dq.questions_id ORDER BY dq.created_at), NULL), ARRAY[]::uuid[]) as question_ids
    FROM params x
    LEFT JOIN questions_drafts_connection dq ON dq.draft_id = x.draft_id
    LIMIT 1
),
draft_templates_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(dt.templates_id ORDER BY dt.created_at), NULL), ARRAY[]::uuid[]) as template_ids
    FROM params x
    LEFT JOIN templates_drafts_connection dt ON dt.draft_id = x.draft_id
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
scenario_parameters_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT scenario_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(sp.parameter_id ORDER BY sp.parameter_id)
                 FROM scenario_parameters_junction sp
                 WHERE sp.scenario_id = (SELECT scenario_id FROM params) AND sp.active = true),
                ARRAY[]::uuid[]
            )
        END as parameter_ids
    FROM params
    LIMIT 1
),
scenario_parameter_fields_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT scenario_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(spf.parameter_field_id ORDER BY spf.parameter_field_id)
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
                (SELECT ARRAY_AGG(so.objective_id ORDER BY so.idx, so.objective_id)
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
scenario_templates_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT scenario_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(st.template_id ORDER BY st.template_id)
                 FROM scenario_templates_junction st
                 WHERE st.scenario_id = (SELECT scenario_id FROM params) AND st.active = true),
                ARRAY[]::uuid[]
            )
        END as template_ids
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
scenario_templates_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT template_ids FROM draft_templates_data), 1), 0) > 0
                THEN (SELECT template_ids FROM draft_templates_data)
            WHEN COALESCE(array_length((SELECT template_ids FROM scenario_templates_junction_data), 1), 0) > 0
                THEN (SELECT template_ids FROM scenario_templates_junction_data)
            ELSE ARRAY[]::uuid[]
        END as template_ids
    FROM params
    LIMIT 1
),
-- Single-select resource IDs (from draft or scenario junction)
name_resource_data AS (
    SELECT COALESCE(
        (SELECT n.id FROM names_drafts_connection dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT sn.name_id FROM scenario_names_junction sn WHERE sn.scenario_id = (SELECT scenario_id FROM params) LIMIT 1)
    ) as name_id
    FROM params
),
description_resource_data AS (
    SELECT COALESCE(
        (SELECT dd.descriptions_id FROM descriptions_drafts_connection dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT sd.description_id FROM scenario_descriptions_junction sd WHERE sd.scenario_id = (SELECT scenario_id FROM params) LIMIT 1)
    ) as description_id
    FROM params
),
problem_statement_resource_data AS (
    SELECT COALESCE(
        (SELECT dps.problem_statements_id FROM problem_statements_drafts_connection dps WHERE dps.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT sps.problem_statement_id FROM scenario_problem_statements_junction sps WHERE sps.scenario_id = (SELECT scenario_id FROM params) AND sps.active = true LIMIT 1)
    ) as problem_statement_id
    FROM params
),
active_flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flags_id FROM flags_drafts_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.name = 'active' AND df.active = true LIMIT 1),
        (SELECT sf.flag_id FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = (SELECT scenario_id FROM params) AND f.name = 'scenario_active' AND sf.value = TRUE AND sf.active = true LIMIT 1)
    ) as active_flag_id
    FROM params
),
objectives_enabled_flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flags_id FROM flags_drafts_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.name = 'objectives_enabled' AND df.active = true LIMIT 1),
        (SELECT sf.flag_id FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = (SELECT scenario_id FROM params) AND f.name = 'objectives_enabled' AND sf.value = TRUE AND sf.active = true LIMIT 1)
    ) as objectives_enabled_flag_id
    FROM params
),
images_enabled_flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flags_id FROM flags_drafts_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.name = 'images_enabled' AND df.active = true LIMIT 1),
        (SELECT sf.flag_id FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = (SELECT scenario_id FROM params) AND f.name = 'images_enabled' AND sf.value = TRUE AND sf.active = true LIMIT 1)
    ) as images_enabled_flag_id
    FROM params
),
video_enabled_flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flags_id FROM flags_drafts_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.name = 'video_enabled' AND df.active = true LIMIT 1),
        (SELECT sf.flag_id FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = (SELECT scenario_id FROM params) AND f.name = 'video_enabled' AND sf.value = TRUE AND sf.active = true LIMIT 1)
    ) as video_enabled_flag_id
    FROM params
),
questions_enabled_flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flags_id FROM flags_drafts_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.name = 'questions_enabled' AND df.active = true LIMIT 1),
        (SELECT sf.flag_id FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = (SELECT scenario_id FROM params) AND f.name = 'questions_enabled' AND sf.value = TRUE AND sf.active = true LIMIT 1)
    ) as questions_enabled_flag_id
    FROM params
),
problem_statement_enabled_flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flags_id FROM flags_drafts_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.name = 'problem_statement_enabled' AND df.active = true LIMIT 1),
        (SELECT sf.flag_id FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = (SELECT scenario_id FROM params) AND f.name = 'problem_statement_enabled' AND sf.value = TRUE AND sf.active = true LIMIT 1)
    ) as problem_statement_enabled_flag_id
    FROM params
),
use_templates_flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flags_id FROM flags_drafts_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) AND f.name = 'use_templates' AND df.active = true LIMIT 1),
        (SELECT sf.flag_id FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = (SELECT scenario_id FROM params) AND f.name = 'use_templates' AND sf.value = TRUE AND sf.active = true LIMIT 1)
    ) as use_templates_flag_id
    FROM params
),
-- Candidate agents data (for Python-side agent scoring)
candidate_agents_data AS (
    SELECT
        a.id as agent_id,
        n.name as agent_name,
        COALESCE(ARRAY_AGG(DISTINCT rt.resource::text) FILTER (WHERE rt.resource IS NOT NULL), ARRAY[]::text[]) as tool_resources,
        COALESCE(ARRAY_AGG(DISTINCT ad.department_id) FILTER (WHERE ad.department_id IS NOT NULL), ARRAY[]::uuid[]) as department_ids,
        a.updated_at,
        COALESCE(af_mcp.value, false) as is_mcp
    FROM agent_artifact a
    JOIN agent_names_junction anj ON anj.agent_id = a.id
    JOIN names_resource n ON n.id = anj.name_id
    LEFT JOIN agent_tools_junction at ON at.agent_id = a.id AND at.active = true
    LEFT JOIN tools_resource tr ON tr.id = at.tool_id
    LEFT JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    LEFT JOIN tool_artifact ta ON ta.id = ttj.tool_id
    LEFT JOIN resource_tools_relation rt ON rt.tool_id = ta.id
    LEFT JOIN tool_flags_junction tf ON tf.tool_id = ta.id
    LEFT JOIN flags_resource f_tool ON f_tool.id = tf.flag_id AND f_tool.name = 'tool_active'
    LEFT JOIN agent_departments_junction ad ON ad.agent_id = a.id AND ad.active = true
    LEFT JOIN agent_flags_junction af_active ON af_active.agent_id = a.id
    LEFT JOIN flags_resource f_active ON f_active.id = af_active.flag_id AND f_active.name = 'agent_active'
    LEFT JOIN agent_flags_junction af_mcp ON af_mcp.agent_id = a.id
    LEFT JOIN flags_resource f_mcp ON f_mcp.id = af_mcp.flag_id AND f_mcp.name = 'mcp'
    WHERE COALESCE(af_active.value, false) = true
      AND (tf.tool_id IS NULL OR COALESCE(f_tool.id, NULL) IS NULL OR COALESCE(tf.value, false) = true)
      AND (
          NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
          OR EXISTS (SELECT 1 FROM agent_departments_junction ad3 WHERE ad3.agent_id = a.id AND ad3.active = true AND ad3.department_id = ANY(user_department_ids))
      )
    GROUP BY a.id, n.name, a.updated_at, af_mcp.value
),
-- Tools existence check
tools_existence_check AS (
    SELECT
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'names'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as names_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'descriptions'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as descriptions_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'problem_statements'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as problem_statements_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'departments'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as departments_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'personas'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as personas_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'documents'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as documents_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'parameters'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as parameters_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'parameter_fields'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as parameter_fields_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'objectives'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as objectives_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'images'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as images_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'videos'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as videos_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'questions'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as questions_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'templates'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as templates_has_tools
    FROM params x
)
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT problem_statement_id FROM problem_statement_resource_data) as problem_statement_id,
    (SELECT active_flag_id FROM active_flag_resource_data) as active_flag_id,
    (SELECT objectives_enabled_flag_id FROM objectives_enabled_flag_resource_data) as objectives_enabled_flag_id,
    (SELECT images_enabled_flag_id FROM images_enabled_flag_resource_data) as images_enabled_flag_id,
    (SELECT video_enabled_flag_id FROM video_enabled_flag_resource_data) as video_enabled_flag_id,
    (SELECT questions_enabled_flag_id FROM questions_enabled_flag_resource_data) as questions_enabled_flag_id,
    (SELECT problem_statement_enabled_flag_id FROM problem_statement_enabled_flag_resource_data) as problem_statement_enabled_flag_id,
    (SELECT use_templates_flag_id FROM use_templates_flag_resource_data) as use_templates_flag_id,

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
    (SELECT template_ids FROM scenario_templates_combined_data) as template_ids,

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
    ARRAY[]::uuid[] as template_suggestions,

    -- Candidate agents (for Python-side agent scoring)
    (SELECT COALESCE(
        ARRAY_AGG(ROW(ca.agent_id, ca.agent_name, ca.tool_resources, ca.department_ids, ca.updated_at, ca.is_mcp)::scenario_candidate_agent),
        ARRAY[]::scenario_candidate_agent[]
    ) FROM candidate_agents_data ca) as candidate_agents,

    -- Tools existence
    tec.names_has_tools,
    tec.descriptions_has_tools,
    tec.problem_statements_has_tools,
    tec.departments_has_tools,
    tec.personas_has_tools,
    tec.documents_has_tools,
    tec.parameters_has_tools,
    tec.parameter_fields_has_tools,
    tec.objectives_has_tools,
    tec.images_has_tools,
    tec.videos_has_tools,
    tec.questions_has_tools,
    tec.templates_has_tools
FROM params x
CROSS JOIN tools_existence_check tec;
$$;
