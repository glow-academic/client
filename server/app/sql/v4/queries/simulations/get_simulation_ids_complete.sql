-- Get simulation IDs - Pass 2 of two-pass architecture
-- Returns all resource IDs, candidate agents, tools flags, and domain IDs for parallel resource fetching

-- Create composite type for candidate agents (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'simulation_candidate_agent') THEN
        CREATE TYPE simulation_candidate_agent AS (
            agent_id uuid,
            agent_name text,
            tool_resources text[],
            create_tool_ids uuid[],
            link_tool_ids uuid[],
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
        WHERE proname = 'api_get_simulation_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_simulation_ids_v4(
    profile_id uuid,
    simulation_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select IDs
    name_id uuid,
    description_id uuid,
    -- Multi-select IDs
    flag_ids uuid[],
    department_ids uuid[],
    scenario_ids uuid[],
    scenario_flag_ids uuid[],
    scenario_position_ids uuid[],
    scenario_rubric_ids uuid[],
    scenario_time_limit_ids uuid[],
    scenario_persona_ids uuid[],
    -- Candidate agents (for Python-side agent scoring)
    candidate_agents simulation_candidate_agent[],
    -- Tools existence flags
    names_has_tools boolean,
    descriptions_has_tools boolean,
    flags_has_tools boolean,
    departments_has_tools boolean,
    scenarios_has_tools boolean,
    scenario_flags_has_tools boolean,
    scenario_personas_has_tools boolean,
    scenario_positions_has_tools boolean,
    scenario_rubrics_has_tools boolean,
    scenario_time_limits_has_tools boolean,
    -- Domain IDs
    name_domain_id uuid,
    description_domain_id uuid,
    flag_domain_id uuid,
    departments_domain_id uuid,
    scenarios_domain_id uuid,
    scenario_flags_domain_id uuid,
    scenario_personas_domain_id uuid,
    scenario_positions_domain_id uuid,
    scenario_rubrics_domain_id uuid,
    scenario_time_limits_domain_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS p_profile_id,
        simulation_id AS p_simulation_id,
        draft_id AS p_draft_id,
        COALESCE(group_id, (SELECT id FROM groups_entry ORDER BY created_at DESC LIMIT 1)) AS p_group_id,
        COALESCE(user_department_ids, ARRAY[]::uuid[]) AS p_user_dept_ids
),
-- Get name_id (from draft first, then simulation)
name_data AS (
    SELECT COALESCE(
        -- From draft
        (SELECT nd.names_id FROM names_drafts_connection nd WHERE nd.draft_id = (SELECT p_draft_id FROM params) LIMIT 1),
        -- From simulation
        (SELECT sn.name_id FROM simulation_names_junction sn WHERE sn.simulation_id = (SELECT p_simulation_id FROM params) LIMIT 1)
    ) as name_id
),
-- Get description_id (from draft first, then simulation)
description_data AS (
    SELECT COALESCE(
        -- From draft
        (SELECT dd.descriptions_id FROM descriptions_drafts_connection dd WHERE dd.draft_id = (SELECT p_draft_id FROM params) LIMIT 1),
        -- From simulation
        (SELECT sd.description_id FROM simulation_descriptions_junction sd WHERE sd.simulation_id = (SELECT p_simulation_id FROM params) LIMIT 1)
    ) as description_id
),
-- Get flag_ids (from draft first, then simulation)
flag_data AS (
    SELECT COALESCE(
        -- From draft (all flags linked to draft)
        (SELECT ARRAY_AGG(fd.flags_id) FROM flags_drafts_connection fd WHERE fd.draft_id = (SELECT p_draft_id FROM params)),
        -- From simulation (all flags with value = true)
        (SELECT ARRAY_AGG(sf.flag_id) FROM simulation_flags_junction sf
         WHERE sf.simulation_id = (SELECT p_simulation_id FROM params)
           AND sf.value = true),
        ARRAY[]::uuid[]
    ) as flag_ids
),
-- Get department_ids (from draft first, then simulation)
department_data AS (
    SELECT COALESCE(
        -- From draft
        (SELECT ARRAY_AGG(dd.departments_id) FROM departments_drafts_connection dd WHERE dd.draft_id = (SELECT p_draft_id FROM params)),
        -- From simulation
        (SELECT ARRAY_AGG(sd.department_id) FROM simulation_departments_junction sd WHERE sd.simulation_id = (SELECT p_simulation_id FROM params) AND sd.active = true),
        ARRAY[]::uuid[]
    ) as department_ids
),
-- Get scenario_ids (from draft first, then simulation)
scenario_data AS (
    SELECT COALESCE(
        -- From draft
        (SELECT ARRAY_AGG(sd.scenarios_id) FROM scenarios_drafts_connection sd WHERE sd.draft_id = (SELECT p_draft_id FROM params)),
        -- From simulation
        (SELECT ARRAY_AGG(ss.scenario_id) FROM simulation_scenarios_junction ss WHERE ss.simulation_id = (SELECT p_simulation_id FROM params) AND ss.active = true),
        ARRAY[]::uuid[]
    ) as scenario_ids
),
-- Get scenario_flag_ids
scenario_flag_data AS (
    SELECT COALESCE(
        -- From draft
        (SELECT ARRAY_AGG(sfd.scenario_flags_id) FROM scenario_flags_drafts_connection sfd WHERE sfd.draft_id = (SELECT p_draft_id FROM params)),
        -- From simulation
        (SELECT ARRAY_AGG(ssf.scenario_flag_id) FROM simulation_scenario_flags_junction ssf WHERE ssf.simulation_id = (SELECT p_simulation_id FROM params) AND ssf.value = true),
        ARRAY[]::uuid[]
    ) as scenario_flag_ids
),
-- Get scenario_position_ids
scenario_position_data AS (
    SELECT COALESCE(
        -- From draft
        (SELECT ARRAY_AGG(spd.scenario_positions_id) FROM scenario_positions_drafts_connection spd WHERE spd.draft_id = (SELECT p_draft_id FROM params)),
        -- From simulation
        (SELECT ARRAY_AGG(ssp.scenario_position_id) FROM simulation_scenario_positions_junction ssp WHERE ssp.simulation_id = (SELECT p_simulation_id FROM params) AND ssp.active = true),
        ARRAY[]::uuid[]
    ) as scenario_position_ids
),
-- Get scenario_rubric_ids
scenario_rubric_data AS (
    SELECT COALESCE(
        -- From draft
        (SELECT ARRAY_AGG(srd.scenario_rubrics_id) FROM scenario_rubrics_drafts_connection srd WHERE srd.draft_id = (SELECT p_draft_id FROM params)),
        -- From simulation
        (SELECT ARRAY_AGG(ssr.scenario_rubric_id) FROM simulation_scenario_rubrics_junction ssr WHERE ssr.simulation_id = (SELECT p_simulation_id FROM params) AND ssr.active = true),
        ARRAY[]::uuid[]
    ) as scenario_rubric_ids
),
-- Get scenario_time_limit_ids
scenario_time_limit_data AS (
    SELECT COALESCE(
        -- From draft
        (SELECT ARRAY_AGG(stld.scenario_time_limits_id) FROM scenario_time_limits_drafts_connection stld WHERE stld.draft_id = (SELECT p_draft_id FROM params)),
        -- From simulation
        (SELECT ARRAY_AGG(sstl.scenario_time_limit_id) FROM simulation_scenario_time_limits_junction sstl WHERE sstl.simulation_id = (SELECT p_simulation_id FROM params) AND sstl.active = true),
        ARRAY[]::uuid[]
    ) as scenario_time_limit_ids
),
-- Get scenario_persona_ids
scenario_persona_data AS (
    SELECT COALESCE(
        -- From draft
        (SELECT ARRAY_AGG(spd.scenario_personas_id) FROM scenario_personas_drafts_connection spd WHERE spd.draft_id = (SELECT p_draft_id FROM params)),
        -- From simulation
        (SELECT ARRAY_AGG(ssp.scenario_persona_id) FROM simulation_scenario_personas_junction ssp WHERE ssp.simulation_id = (SELECT p_simulation_id FROM params) AND ssp.active = true),
        ARRAY[]::uuid[]
    ) as scenario_persona_ids
),
-- Agent resource tools: discover all (agent, resource, tool_id, creatable) tuples
agent_resource_tools AS (
    SELECT
        a.id as agent_id,
        rt.resource::text as resource_name,
        ta.id as tool_id,
        COALESCE(tf_create.value, true) as is_creatable  -- Default true if flag not set
    FROM agent_artifact a
    JOIN agent_tools_junction atj ON atj.agent_id = a.id AND atj.active = true
    JOIN tools_resource tr ON tr.id = atj.tool_id
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
-- One create + one link tool per (agent, resource)
agent_resource_tool_pairs AS (
    SELECT
        art.agent_id,
        art.resource_name,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = true))[1] as create_tool_id,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = false))[1] as link_tool_id
    FROM agent_resource_tools art
    GROUP BY art.agent_id, art.resource_name
),
-- Aligned arrays: tool_resources, create_tool_ids, link_tool_ids (all same length, same order)
agent_tool_arrays AS (
    SELECT
        agent_id,
        ARRAY_AGG(resource_name ORDER BY resource_name) as tool_resources,
        ARRAY_AGG(create_tool_id ORDER BY resource_name) as create_tool_ids,
        ARRAY_AGG(link_tool_id ORDER BY resource_name) as link_tool_ids
    FROM agent_resource_tool_pairs
    GROUP BY agent_id
),
-- Candidate agents data (for Python-side agent scoring)
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
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'flags'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as flags_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'departments'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as departments_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'scenarios'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as scenarios_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'scenario_flags'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as scenario_flags_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'scenario_personas'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as scenario_personas_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'scenario_positions'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as scenario_positions_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'scenario_rubrics'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as scenario_rubrics_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'scenario_time_limits'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as scenario_time_limits_has_tools
    FROM params x
),
-- Domain IDs from domains_resource table
domain_ids_data AS (
    SELECT
        (SELECT id FROM domains_resource WHERE resource = 'names'::resource_type AND active = true LIMIT 1) as name_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'descriptions'::resource_type AND active = true LIMIT 1) as description_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'flags'::resource_type AND active = true LIMIT 1) as flag_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'departments'::resource_type AND active = true LIMIT 1) as departments_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'scenarios'::resource_type AND active = true LIMIT 1) as scenarios_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'scenario_flags'::resource_type AND active = true LIMIT 1) as scenario_flags_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'scenario_personas'::resource_type AND active = true LIMIT 1) as scenario_personas_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'scenario_positions'::resource_type AND active = true LIMIT 1) as scenario_positions_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'scenario_rubrics'::resource_type AND active = true LIMIT 1) as scenario_rubrics_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'scenario_time_limits'::resource_type AND active = true LIMIT 1) as scenario_time_limits_domain_id
)
SELECT
    (SELECT name_id FROM name_data),
    (SELECT description_id FROM description_data),
    (SELECT flag_ids FROM flag_data),
    (SELECT department_ids FROM department_data),
    (SELECT scenario_ids FROM scenario_data),
    (SELECT scenario_flag_ids FROM scenario_flag_data),
    (SELECT scenario_position_ids FROM scenario_position_data),
    (SELECT scenario_rubric_ids FROM scenario_rubric_data),
    (SELECT scenario_time_limit_ids FROM scenario_time_limit_data),
    (SELECT scenario_persona_ids FROM scenario_persona_data),
    -- Candidate agents (for Python-side agent scoring)
    (SELECT COALESCE(
        ARRAY_AGG(ROW(ca.agent_id, ca.agent_name, ca.tool_resources, ca.create_tool_ids, ca.link_tool_ids, ca.department_ids, ca.updated_at, ca.is_mcp)::simulation_candidate_agent),
        ARRAY[]::simulation_candidate_agent[]
    ) FROM candidate_agents_data ca) as candidate_agents,
    -- Tools existence
    tec.names_has_tools,
    tec.descriptions_has_tools,
    tec.flags_has_tools,
    tec.departments_has_tools,
    tec.scenarios_has_tools,
    tec.scenario_flags_has_tools,
    tec.scenario_personas_has_tools,
    tec.scenario_positions_has_tools,
    tec.scenario_rubrics_has_tools,
    tec.scenario_time_limits_has_tools,
    -- Domain IDs
    did.name_domain_id,
    did.description_domain_id,
    did.flag_domain_id,
    did.departments_domain_id,
    did.scenarios_domain_id,
    did.scenario_flags_domain_id,
    did.scenario_personas_domain_id,
    did.scenario_positions_domain_id,
    did.scenario_rubrics_domain_id,
    did.scenario_time_limits_domain_id
FROM params x
CROSS JOIN tools_existence_check tec
CROSS JOIN domain_ids_data did;
$$;
