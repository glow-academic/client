-- Agent ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Drop and recreate composite type for candidate agents
DO $$
BEGIN
    -- Drop the type if it exists (CASCADE will drop dependent functions)
    DROP TYPE IF EXISTS agent_candidate_agent CASCADE;

    -- Recreate with fields for create/link tool IDs
    CREATE TYPE agent_candidate_agent AS (
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
        WHERE proname = 'api_get_agent_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_agent_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_agent_ids_v4(
    profile_id uuid,
    agent_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or agent junction)
    name_id uuid,
    description_id uuid,
    model_id uuid,
    prompt_id uuid,
    instructions_id uuid,
    active_flag_id uuid,
    temperature_level_id uuid,
    reasoning_level_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    tool_ids uuid[],
    voice_ids uuid[],

    -- Candidate agents (for Python-side agent scoring)
    candidate_agents agent_candidate_agent[],

    -- Tools existence (for Python to compute show_* flags)
    names_has_tools boolean,
    descriptions_has_tools boolean,
    models_has_tools boolean,
    prompts_has_tools boolean,
    instructions_has_tools boolean,
    flags_has_tools boolean,
    departments_has_tools boolean,
    tools_has_tools boolean,
    temperature_levels_has_tools boolean,
    reasoning_levels_has_tools boolean,
    voices_has_tools boolean,

    -- Domain IDs (for domain-based generation)
    name_domain_id uuid,
    descriptions_domain_id uuid,
    models_domain_id uuid,
    prompts_domain_id uuid,
    instructions_domain_id uuid,
    flag_domain_id uuid,
    departments_domain_id uuid,
    tools_domain_id uuid,
    temperature_levels_domain_id uuid,
    reasoning_levels_domain_id uuid,
    voices_domain_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        agent_id AS agent_id,
        draft_id AS draft_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Single-select resource IDs
name_resource_data AS (
    SELECT
        COALESCE(
            (SELECT dn.names_id FROM names_drafts_connection dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT an.name_id FROM agent_names_junction an WHERE an.agent_id = (SELECT agent_id FROM params) LIMIT 1),
            NULL::uuid
        ) as name_id
    FROM params
),
description_resource_data AS (
    SELECT
        COALESCE(
            (SELECT dd.descriptions_id FROM descriptions_drafts_connection dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT ad.description_id FROM agent_descriptions_junction ad WHERE ad.agent_id = (SELECT agent_id FROM params) LIMIT 1),
            NULL::uuid
        ) as description_id
    FROM params
),
model_resource_data AS (
    SELECT
        COALESCE(
            (SELECT am.model_id FROM agent_models_junction am WHERE am.agent_id = (SELECT agent_id FROM params) LIMIT 1),
            NULL::uuid
        ) as model_id
    FROM params
),
prompt_resource_data AS (
    SELECT
        COALESCE(
            (SELECT ap.prompt_id FROM agent_prompts_junction ap WHERE ap.agent_id = (SELECT agent_id FROM params) AND ap.active = true LIMIT 1),
            NULL::uuid
        ) as prompt_id
    FROM params
),
instructions_resource_data AS (
    SELECT
        COALESCE(
            (SELECT ai.instruction_id FROM agent_instructions_junction ai WHERE ai.agent_id = (SELECT agent_id FROM params) LIMIT 1),
            NULL::uuid
        ) as instructions_id
    FROM params
),
flag_resource_data AS (
    SELECT
        COALESCE(
            (SELECT df.flags_id
             FROM flags_drafts_connection df
             WHERE df.draft_id = (SELECT draft_id FROM params)
             LIMIT 1),
            (SELECT af.flag_id
             FROM agent_flags_junction af
             JOIN flags_resource f ON af.flag_id = f.id
             WHERE af.agent_id = (SELECT agent_id FROM params)
               AND f.name = 'agent_active'
               AND af.value = true
             LIMIT 1),
            NULL::uuid
        ) as active_flag_id
    FROM params
),
temperature_level_resource_data AS (
    SELECT
        COALESCE(
            (SELECT atl.temperature_level_id FROM agent_temperature_levels_junction atl WHERE atl.agent_id = (SELECT agent_id FROM params) AND atl.active = true LIMIT 1),
            NULL::uuid
        ) as temperature_level_id
    FROM params
),
reasoning_level_resource_data AS (
    SELECT
        COALESCE(
            (SELECT arl.reasoning_level_id FROM agent_reasoning_levels_junction arl WHERE arl.agent_id = (SELECT agent_id FROM params) AND arl.active = true LIMIT 1),
            NULL::uuid
        ) as reasoning_level_id
    FROM params
),
-- Multi-select resource IDs
department_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(dd.departments_id ORDER BY dd.created_at)
             FROM departments_drafts_connection dd
             WHERE dd.draft_id = (SELECT draft_id FROM params)
               AND dd.active = true),
            (SELECT ARRAY_AGG(ad.department_id ORDER BY ad.created_at)
             FROM agent_departments_junction ad
             WHERE ad.agent_id = (SELECT agent_id FROM params)
               AND ad.active = true),
            ARRAY[]::uuid[]
        ) as department_ids
    FROM params
    LIMIT 1
),
tool_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(ttj.tool_id ORDER BY at.created_at)
             FROM agent_tools_junction at
             JOIN tools_resource tr ON tr.id = at.tool_id
             JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
             JOIN tool_artifact t ON t.id = ttj.tool_id
             WHERE at.agent_id = (SELECT agent_id FROM params)
               AND at.active = true
               AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)),
            ARRAY[]::uuid[]
        ) as tool_ids
    FROM params
    LIMIT 1
),
voice_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(av.voice_id ORDER BY av.created_at)
             FROM agent_voices_junction av
             WHERE av.agent_id = (SELECT agent_id FROM params)
               AND av.active = true),
            ARRAY[]::uuid[]
        ) as voice_ids
    FROM params
    LIMIT 1
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
-- Tools existence check
tools_existence_check AS (
    SELECT
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'names'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as names_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'descriptions'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as descriptions_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'models'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as models_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'prompts'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as prompts_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'instructions'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as instructions_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'flags'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as flags_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'departments'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as departments_has_tools,
        EXISTS (SELECT 1 FROM tool_artifact t WHERE EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as tools_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'temperature_levels'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as temperature_levels_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'reasoning_levels'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as reasoning_levels_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'voices'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as voices_has_tools
    FROM params x
),
-- Domain IDs from domains_resource table
domain_ids_data AS (
    SELECT
        (SELECT id FROM domains_resource WHERE resource = 'names'::resource_type AND active = true LIMIT 1) as name_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'descriptions'::resource_type AND active = true LIMIT 1) as descriptions_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'models'::resource_type AND active = true LIMIT 1) as models_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'prompts'::resource_type AND active = true LIMIT 1) as prompts_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'instructions'::resource_type AND active = true LIMIT 1) as instructions_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'flags'::resource_type AND active = true LIMIT 1) as flag_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'departments'::resource_type AND active = true LIMIT 1) as departments_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'tools'::resource_type AND active = true LIMIT 1) as tools_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'temperature_levels'::resource_type AND active = true LIMIT 1) as temperature_levels_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'reasoning_levels'::resource_type AND active = true LIMIT 1) as reasoning_levels_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'voices'::resource_type AND active = true LIMIT 1) as voices_domain_id
)
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT model_id FROM model_resource_data) as model_id,
    (SELECT prompt_id FROM prompt_resource_data) as prompt_id,
    (SELECT instructions_id FROM instructions_resource_data) as instructions_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    (SELECT temperature_level_id FROM temperature_level_resource_data) as temperature_level_id,
    (SELECT reasoning_level_id FROM reasoning_level_resource_data) as reasoning_level_id,

    -- Multi-select resource IDs
    (SELECT department_ids FROM department_ids_data) as department_ids,
    (SELECT tool_ids FROM tool_ids_data) as tool_ids,
    (SELECT voice_ids FROM voice_ids_data) as voice_ids,

    -- Candidate agents (for Python-side agent scoring)
    (SELECT COALESCE(
        ARRAY_AGG(ROW(ca.agent_id, ca.agent_name, ca.tool_resources, ca.create_tool_ids, ca.link_tool_ids, ca.department_ids, ca.updated_at, ca.is_mcp)::agent_candidate_agent),
        ARRAY[]::agent_candidate_agent[]
    ) FROM candidate_agents_data ca) as candidate_agents,

    -- Tools existence
    tec.names_has_tools,
    tec.descriptions_has_tools,
    tec.models_has_tools,
    tec.prompts_has_tools,
    tec.instructions_has_tools,
    tec.flags_has_tools,
    tec.departments_has_tools,
    tec.tools_has_tools,
    tec.temperature_levels_has_tools,
    tec.reasoning_levels_has_tools,
    tec.voices_has_tools,

    -- Domain IDs
    did.name_domain_id,
    did.descriptions_domain_id,
    did.models_domain_id,
    did.prompts_domain_id,
    did.instructions_domain_id,
    did.flag_domain_id,
    did.departments_domain_id,
    did.tools_domain_id,
    did.temperature_levels_domain_id,
    did.reasoning_levels_domain_id,
    did.voices_domain_id
FROM params x
CROSS JOIN tools_existence_check tec
CROSS JOIN domain_ids_data did;
$$;
