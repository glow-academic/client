-- Persona ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Create composite type for candidate agents (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'persona_candidate_agent') THEN
        CREATE TYPE persona_candidate_agent AS (
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
        WHERE proname = 'api_get_persona_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_persona_ids_v4(
    profile_id uuid,
    persona_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or persona junction)
    name_id uuid,
    description_id uuid,
    color_id uuid,
    icon_id uuid,
    instructions_id uuid,
    active_flag_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    parameter_field_ids uuid[],
    example_ids uuid[],
    parameter_ids uuid[],

    -- Suggestion IDs (computed in resource search endpoints)
    name_suggestions uuid[],
    description_suggestions uuid[],
    color_suggestions uuid[],
    icon_suggestions uuid[],
    instructions_suggestions uuid[],
    department_suggestions uuid[],
    parameter_field_suggestions uuid[],
    example_suggestions uuid[],
    parameter_suggestions uuid[],

    -- Candidate agents (for Python-side agent scoring)
    candidate_agents persona_candidate_agent[],

    -- Tools existence (for Python to compute show_* flags)
    names_has_tools boolean,
    colors_has_tools boolean,
    icons_has_tools boolean,
    instructions_has_tools boolean,
    departments_has_tools boolean,
    parameter_fields_has_tools boolean,
    examples_has_tools boolean,
    parameters_has_tools boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        persona_id AS persona_id,
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
draft_parameter_fields_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(df.fields_id ORDER BY df.created_at), NULL), ARRAY[]::uuid[]) as parameter_field_ids
    FROM params x
    LEFT JOIN fields_drafts_connection df ON df.draft_id = x.draft_id
    LIMIT 1
),
draft_examples_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(de.examples_id ORDER BY de.created_at), NULL), ARRAY[]::uuid[]) as example_ids
    FROM params x
    LEFT JOIN examples_drafts_connection de ON de.draft_id = x.draft_id
    LIMIT 1
),
draft_parameters_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(dp.parameters_id ORDER BY dp.created_at), NULL), ARRAY[]::uuid[]) as parameter_ids
    FROM params x
    LEFT JOIN parameters_drafts_connection dp ON dp.draft_id = x.draft_id
    LIMIT 1
),
-- Persona junction multi-select resource IDs
persona_departments_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pd.department_id ORDER BY pd.created_at)
                 FROM persona_departments_junction pd
                 WHERE pd.persona_id = (SELECT persona_id FROM params) AND pd.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
persona_parameter_fields_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ppfj.parameter_field_id ORDER BY ppfj.created_at)
                 FROM persona_parameter_fields_junction ppfj
                 WHERE ppfj.persona_id = (SELECT persona_id FROM params) AND ppfj.active = true),
                ARRAY[]::uuid[]
            )
        END as parameter_field_ids
    FROM params
    LIMIT 1
),
persona_examples_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(e.id ORDER BY pe.idx)
                 FROM persona_examples_junction pe
                 JOIN examples_resource e ON e.id = pe.example_id
                 WHERE pe.persona_id = (SELECT persona_id FROM params) AND pe.active = true),
                ARRAY[]::uuid[]
            )
        END as example_ids
    FROM params
    LIMIT 1
),
persona_parameters_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pp.parameter_id ORDER BY pp.created_at)
                 FROM persona_parameters_junction pp
                 JOIN parameters_resource pr ON pr.id = pp.parameter_id
                 WHERE pp.persona_id = (SELECT persona_id FROM params)
                   AND pp.active = true
                   AND pr.persona_parameter = true),
                ARRAY[]::uuid[]
            )
        END as parameter_ids
    FROM params
    LIMIT 1
),
-- Combined multi-select IDs (draft preferred over persona)
persona_departments_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT department_ids FROM draft_departments_data), 1), 0) > 0
                THEN (SELECT department_ids FROM draft_departments_data)
            WHEN COALESCE(array_length((SELECT department_ids FROM persona_departments_junction_data), 1), 0) > 0
                THEN (SELECT department_ids FROM persona_departments_junction_data)
            ELSE ARRAY[]::uuid[]
        END as department_ids
    FROM params
    LIMIT 1
),
persona_parameter_fields_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT parameter_field_ids FROM draft_parameter_fields_data), 1), 0) > 0
                THEN (SELECT parameter_field_ids FROM draft_parameter_fields_data)
            WHEN COALESCE(array_length((SELECT parameter_field_ids FROM persona_parameter_fields_junction_data), 1), 0) > 0
                THEN (SELECT parameter_field_ids FROM persona_parameter_fields_junction_data)
            ELSE ARRAY[]::uuid[]
        END as parameter_field_ids
    FROM params
    LIMIT 1
),
persona_examples_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT example_ids FROM draft_examples_data), 1), 0) > 0
                THEN (SELECT example_ids FROM draft_examples_data)
            WHEN COALESCE(array_length((SELECT example_ids FROM persona_examples_junction_data), 1), 0) > 0
                THEN (SELECT example_ids FROM persona_examples_junction_data)
            ELSE ARRAY[]::uuid[]
        END as example_ids
    FROM params
    LIMIT 1
),
persona_parameters_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT parameter_ids FROM draft_parameters_data), 1), 0) > 0
                THEN (SELECT parameter_ids FROM draft_parameters_data)
            WHEN COALESCE(array_length((SELECT parameter_ids FROM persona_parameters_junction_data), 1), 0) > 0
                THEN (SELECT parameter_ids FROM persona_parameters_junction_data)
            ELSE ARRAY[]::uuid[]
        END as parameter_ids
    FROM params
    LIMIT 1
),
-- Single-select resource IDs (from draft or persona junction)
name_resource_data AS (
    SELECT COALESCE(
        (SELECT n.id FROM names_drafts_connection dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT pn.name_id FROM persona_names_junction pn WHERE pn.persona_id = (SELECT persona_id FROM params) LIMIT 1)
    ) as name_id
    FROM params
),
description_resource_data AS (
    SELECT COALESCE(
        (SELECT dd.descriptions_id FROM descriptions_drafts_connection dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT pd.description_id FROM persona_descriptions_junction pd WHERE pd.persona_id = (SELECT persona_id FROM params) LIMIT 1)
    ) as description_id
    FROM params
),
color_resource_data AS (
    SELECT COALESCE(
        (SELECT dc.colors_id FROM colors_drafts_connection dc WHERE dc.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT pc.color_id FROM persona_colors_junction pc WHERE pc.persona_id = (SELECT persona_id FROM params) LIMIT 1)
    ) as color_id
    FROM params
),
icon_resource_data AS (
    SELECT COALESCE(
        (SELECT di.icons_id FROM icons_drafts_connection di WHERE di.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT pi.icon_id FROM persona_icons_junction pi WHERE pi.persona_id = (SELECT persona_id FROM params) LIMIT 1)
    ) as icon_id
    FROM params
),
instructions_resource_data AS (
    SELECT COALESCE(
        (SELECT dinst.instructions_id FROM instructions_drafts_connection dinst WHERE dinst.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT pinst.instruction_id FROM persona_instructions_junction pinst WHERE pinst.persona_id = (SELECT persona_id FROM params) LIMIT 1)
    ) as instructions_id
    FROM params
),
flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flags_id FROM flags_drafts_connection df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT pf.flag_id FROM persona_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = (SELECT persona_id FROM params) AND f.name = 'persona_active' AND pf.value = TRUE LIMIT 1)
    ) as active_flag_id
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
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'colors'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as colors_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'icons'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as icons_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'instructions'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as instructions_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'departments'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as departments_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'parameter_fields'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as parameter_fields_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'examples'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as examples_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'parameters'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as parameters_has_tools
    FROM params x
)
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT color_id FROM color_resource_data) as color_id,
    (SELECT icon_id FROM icon_resource_data) as icon_id,
    (SELECT instructions_id FROM instructions_resource_data) as instructions_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,

    -- Multi-select resource IDs
    (SELECT department_ids FROM persona_departments_combined_data) as department_ids,
    (SELECT parameter_field_ids FROM persona_parameter_fields_combined_data) as parameter_field_ids,
    (SELECT example_ids FROM persona_examples_combined_data) as example_ids,
    (SELECT parameter_ids FROM persona_parameters_combined_data) as parameter_ids,

    -- Suggestion IDs (computed in resource search endpoints)
    ARRAY[]::uuid[] as name_suggestions,
    ARRAY[]::uuid[] as description_suggestions,
    ARRAY[]::uuid[] as color_suggestions,
    ARRAY[]::uuid[] as icon_suggestions,
    ARRAY[]::uuid[] as instructions_suggestions,
    ARRAY[]::uuid[] as department_suggestions,
    ARRAY[]::uuid[] as parameter_field_suggestions,
    ARRAY[]::uuid[] as example_suggestions,
    ARRAY[]::uuid[] as parameter_suggestions,

    -- Candidate agents (for Python-side agent scoring)
    (SELECT COALESCE(
        ARRAY_AGG(ROW(ca.agent_id, ca.agent_name, ca.tool_resources, ca.department_ids, ca.updated_at, ca.is_mcp)::persona_candidate_agent),
        ARRAY[]::persona_candidate_agent[]
    ) FROM candidate_agents_data ca) as candidate_agents,

    -- Tools existence
    tec.names_has_tools,
    tec.colors_has_tools,
    tec.icons_has_tools,
    tec.instructions_has_tools,
    tec.departments_has_tools,
    tec.parameter_fields_has_tools,
    tec.examples_has_tools,
    tec.parameters_has_tools
FROM params x
CROSS JOIN tools_existence_check tec;
$$;
