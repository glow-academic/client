-- Persona ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Drop and recreate composite type for candidate agents to add tool ID fields
DO $$
BEGIN
    -- Drop the type if it exists (CASCADE will drop dependent functions)
    DROP TYPE IF EXISTS persona_candidate_agent CASCADE;

    -- Recreate with new fields for create/link tool IDs
    CREATE TYPE persona_candidate_agent AS (
        agent_id uuid,
        agent_name text,
        tool_resources text[],
        create_tool_ids uuid[],
        link_tool_ids uuid[],
        department_ids uuid[],
        updated_at timestamptz,
        is_mcp boolean
    );
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
    parameters_has_tools boolean,

    -- Config chain resource IDs (for pre-fetched generation config)
    config_agent_resource_ids uuid[],
    config_model_resource_ids uuid[],
    config_provider_resource_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        persona_id AS persona_id,
        profile_id AS profile_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Persona junction multi-select resource IDs (canonical only).
persona_departments_data AS (
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
persona_parameter_fields_data AS (
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
persona_examples_data AS (
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
persona_parameters_data AS (
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
-- Single-select resource IDs (canonical only).
name_resource_data AS (
    SELECT
        (SELECT pn.name_id FROM persona_names_junction pn WHERE pn.persona_id = (SELECT persona_id FROM params) AND pn.active = true LIMIT 1) as name_id
    FROM params
),
description_resource_data AS (
    SELECT
        (SELECT pd.description_id FROM persona_descriptions_junction pd WHERE pd.persona_id = (SELECT persona_id FROM params) AND pd.active = true LIMIT 1) as description_id
    FROM params
),
color_resource_data AS (
    SELECT
        (SELECT pc.color_id FROM persona_colors_junction pc WHERE pc.persona_id = (SELECT persona_id FROM params) AND pc.active = true LIMIT 1) as color_id
    FROM params
),
icon_resource_data AS (
    SELECT
        (SELECT pi.icon_id FROM persona_icons_junction pi WHERE pi.persona_id = (SELECT persona_id FROM params) AND pi.active = true LIMIT 1) as icon_id
    FROM params
),
instructions_resource_data AS (
    SELECT
        (SELECT pinst.instruction_id FROM persona_instructions_junction pinst WHERE pinst.persona_id = (SELECT persona_id FROM params) AND pinst.active = true LIMIT 1) as instructions_id
    FROM params
),
flag_resource_data AS (
    SELECT
        (SELECT pf.flag_id
         FROM persona_flags_junction pf
         JOIN flags_resource f ON pf.flag_id = f.id
         WHERE pf.persona_id = (SELECT persona_id FROM params)
           AND pf.active = true
           AND f.name = 'persona_active'
           AND pf.value = TRUE
         LIMIT 1) as active_flag_id
    FROM params
),
-- Candidate agents data (for Python-side agent scoring)
-- First get per-agent, per-resource tool IDs with creatable flag
agent_resource_tools AS (
    SELECT
        a.id as agent_id,
        rt.resource::text as resource_name,
        ta.id as tool_id,
        COALESCE(tf_create.value, true) as is_creatable  -- Default true if flag not set
    FROM agent_artifact a
    JOIN agent_tools_junction at ON at.agent_id = a.id AND at.active = true
    JOIN tools_resource tr ON tr.id = at.tool_id
    JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    JOIN tool_artifact ta ON ta.id = ttj.tool_id
    JOIN resource_tools_relation rt ON rt.tool_id = ta.id
    LEFT JOIN tool_flags_junction tf_active ON tf_active.tool_id = ta.id
    LEFT JOIN flags_resource f_active ON f_active.id = tf_active.flag_id AND f_active.name = 'tool_active'
    LEFT JOIN tool_flags_junction tf_create ON tf_create.tool_id = ta.id
    LEFT JOIN flags_resource f_create ON f_create.id = tf_create.flag_id AND f_create.name = 'tool_creatable'
    LEFT JOIN agent_flags_junction af_agent ON af_agent.agent_id = a.id
    LEFT JOIN flags_resource f_agent ON f_agent.id = af_agent.flag_id AND f_agent.name = 'agent_active'
    WHERE COALESCE(af_agent.value, false) = true
      AND (tf_active.tool_id IS NULL OR COALESCE(f_active.id, NULL) IS NULL OR COALESCE(tf_active.value, false) = true)
),
-- Step 1: Pick one create and one link tool per (agent, resource)
agent_resource_tool_pairs AS (
    SELECT
        art.agent_id,
        art.resource_name,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = true))[1] as create_tool_id,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = false))[1] as link_tool_id
    FROM agent_resource_tools art
    GROUP BY art.agent_id, art.resource_name
),
-- Step 2: Aggregate into aligned arrays (all same length, same order)
agent_tool_arrays AS (
    SELECT
        agent_id,
        ARRAY_AGG(resource_name ORDER BY resource_name) as tool_resources,
        ARRAY_AGG(create_tool_id ORDER BY resource_name) as create_tool_ids,
        ARRAY_AGG(link_tool_id ORDER BY resource_name) as link_tool_ids
    FROM agent_resource_tool_pairs
    GROUP BY agent_id
),
candidate_agents_data AS (
    SELECT
        a.id as agent_id,
        n.name as agent_name,
        COALESCE(ata.tool_resources, ARRAY[]::text[]) as tool_resources,
        COALESCE(ata.create_tool_ids, ARRAY[]::uuid[]) as create_tool_ids,
        COALESCE(ata.link_tool_ids, ARRAY[]::uuid[]) as link_tool_ids,
        COALESCE(ARRAY_AGG(DISTINCT ad.department_id) FILTER (WHERE ad.department_id IS NOT NULL), ARRAY[]::uuid[]) as department_ids,
        a.updated_at,
        COALESCE(af_mcp.value, false) as is_mcp
    FROM agent_artifact a
    JOIN agent_names_junction anj ON anj.agent_id = a.id
    JOIN names_resource n ON n.id = anj.name_id
    LEFT JOIN agent_tool_arrays ata ON ata.agent_id = a.id
    LEFT JOIN agent_departments_junction ad ON ad.agent_id = a.id AND ad.active = true
    LEFT JOIN agent_flags_junction af_active ON af_active.agent_id = a.id
    LEFT JOIN flags_resource f_active ON f_active.id = af_active.flag_id AND f_active.name = 'agent_active'
    LEFT JOIN agent_flags_junction af_mcp ON af_mcp.agent_id = a.id
    LEFT JOIN flags_resource f_mcp ON f_mcp.id = af_mcp.flag_id AND f_mcp.name = 'mcp'
    WHERE COALESCE(af_active.value, false) = true
      AND (
          NOT EXISTS (SELECT 1 FROM agent_departments_junction ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
          OR EXISTS (SELECT 1 FROM agent_departments_junction ad3 WHERE ad3.agent_id = a.id AND ad3.active = true AND ad3.department_id = ANY(user_department_ids))
      )
    GROUP BY a.id, n.name, a.updated_at, af_mcp.value, ata.tool_resources, ata.create_tool_ids, ata.link_tool_ids
),
-- Config chain: user departments → settings → agents/providers → models
-- Resolves the denormalized resource chain for generation config pre-fetching
config_settings AS (
    SELECT DISTINCT unnest(dr.setting_ids) as setting_id
    FROM departments_resource dr
    WHERE dr.id = ANY(user_department_ids)
      AND dr.active = true
      AND dr.setting_ids IS NOT NULL
      AND dr.setting_ids != ARRAY[]::uuid[]
),
config_settings_data AS (
    SELECT sr.id, sr.agent_ids
    FROM settings_resource sr
    JOIN config_settings cs ON sr.id = cs.setting_id
    WHERE sr.active = true
),
config_agent_resource_ids_data AS (
    SELECT COALESCE(
        ARRAY_AGG(DISTINCT agent_id),
        ARRAY[]::uuid[]
    ) as ids
    FROM (
        SELECT unnest(csd.agent_ids) as agent_id
        FROM config_settings_data csd
        WHERE csd.agent_ids IS NOT NULL AND csd.agent_ids != ARRAY[]::uuid[]
    ) sub
),
-- Resolve model_ids from agents_resource.model_id (fully parallel fetch in Python)
config_model_resource_ids_data AS (
    SELECT COALESCE(
        ARRAY_AGG(DISTINCT ar.model_id),
        ARRAY[]::uuid[]
    ) as ids
    FROM config_agent_resource_ids_data cari
    JOIN LATERAL unnest(cari.ids) AS agent_res_id ON true
    JOIN agents_resource ar ON ar.id = agent_res_id
    WHERE ar.model_id IS NOT NULL
),
-- Resolve provider_ids from models_resource.provider_id (via agents → models → providers chain)
config_provider_resource_ids_data AS (
    SELECT COALESCE(
        ARRAY_AGG(DISTINCT mr.provider_id),
        ARRAY[]::uuid[]
    ) as ids
    FROM config_model_resource_ids_data cmri
    JOIN LATERAL unnest(cmri.ids) AS model_res_id ON true
    JOIN models_resource mr ON mr.id = model_res_id
    WHERE mr.provider_id IS NOT NULL
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
    (SELECT department_ids FROM persona_departments_data) as department_ids,
    (SELECT parameter_field_ids FROM persona_parameter_fields_data) as parameter_field_ids,
    (SELECT example_ids FROM persona_examples_data) as example_ids,
    (SELECT parameter_ids FROM persona_parameters_data) as parameter_ids,

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
        ARRAY_AGG(ROW(ca.agent_id, ca.agent_name, ca.tool_resources, ca.create_tool_ids, ca.link_tool_ids, ca.department_ids, ca.updated_at, ca.is_mcp)::persona_candidate_agent),
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
    tec.parameters_has_tools,

    -- Config chain resource IDs (for pre-fetched generation config)
    (SELECT ids FROM config_agent_resource_ids_data) as config_agent_resource_ids,
    (SELECT ids FROM config_model_resource_ids_data) as config_model_resource_ids,
    (SELECT ids FROM config_provider_resource_ids_data) as config_provider_resource_ids
FROM params x
CROSS JOIN tools_existence_check tec;
$$;
