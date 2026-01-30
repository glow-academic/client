-- Get simulation IDs - Pass 2 of two-pass architecture
-- Returns all resource IDs, agent IDs, and tools flags for parallel resource fetching

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
    -- Agent IDs
    name_agent_id uuid,
    description_agent_id uuid,
    flag_agent_id uuid,
    departments_agent_id uuid,
    scenarios_agent_id uuid,
    basic_agent_id uuid,
    general_agent_id uuid,
    -- Tools existence flags
    names_has_tools boolean,
    descriptions_has_tools boolean,
    flags_has_tools boolean,
    departments_has_tools boolean,
    scenarios_has_tools boolean
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
-- Get agent IDs from resource_tools_relation and groups
agent_data AS (
    SELECT
        -- Name agent
        (SELECT a.id FROM agent_artifact a
         JOIN agent_tools_junction at ON at.agent_id = a.id
         JOIN tools_resource tr ON tr.id = at.tool_id
         JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
         JOIN tool_artifact t ON t.id = ttj.tool_id
         JOIN resource_tools_relation rt ON rt.tool_id = t.id
         WHERE rt.resource = 'names'::resource_type
           AND at.active = true
           AND EXISTS (
               SELECT 1 FROM agent_flags_junction af
               JOIN flags_resource f ON f.id = af.flag_id
               WHERE af.agent_id = a.id
                 AND f.name = 'agent_active'
                 AND af.value = true
           )
         LIMIT 1) as name_agent_id,
        -- Description agent
        (SELECT a.id FROM agent_artifact a
         JOIN agent_tools_junction at ON at.agent_id = a.id
         JOIN tools_resource tr ON tr.id = at.tool_id
         JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
         JOIN tool_artifact t ON t.id = ttj.tool_id
         JOIN resource_tools_relation rt ON rt.tool_id = t.id
         WHERE rt.resource = 'descriptions'::resource_type
           AND at.active = true
           AND EXISTS (
               SELECT 1 FROM agent_flags_junction af
               JOIN flags_resource f ON f.id = af.flag_id
               WHERE af.agent_id = a.id
                 AND f.name = 'agent_active'
                 AND af.value = true
           )
         LIMIT 1) as description_agent_id,
        -- Flag agent
        (SELECT a.id FROM agent_artifact a
         JOIN agent_tools_junction at ON at.agent_id = a.id
         JOIN tools_resource tr ON tr.id = at.tool_id
         JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
         JOIN tool_artifact t ON t.id = ttj.tool_id
         JOIN resource_tools_relation rt ON rt.tool_id = t.id
         WHERE rt.resource = 'flags'::resource_type
           AND at.active = true
           AND EXISTS (
               SELECT 1 FROM agent_flags_junction af
               JOIN flags_resource f ON f.id = af.flag_id
               WHERE af.agent_id = a.id
                 AND f.name = 'agent_active'
                 AND af.value = true
           )
         LIMIT 1) as flag_agent_id,
        -- Departments agent
        (SELECT a.id FROM agent_artifact a
         JOIN agent_tools_junction at ON at.agent_id = a.id
         JOIN tools_resource tr ON tr.id = at.tool_id
         JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
         JOIN tool_artifact t ON t.id = ttj.tool_id
         JOIN resource_tools_relation rt ON rt.tool_id = t.id
         WHERE rt.resource = 'departments'::resource_type
           AND at.active = true
           AND EXISTS (
               SELECT 1 FROM agent_flags_junction af
               JOIN flags_resource f ON f.id = af.flag_id
               WHERE af.agent_id = a.id
                 AND f.name = 'agent_active'
                 AND af.value = true
           )
         LIMIT 1) as departments_agent_id,
        -- Scenarios agent
        (SELECT a.id FROM agent_artifact a
         JOIN agent_tools_junction at ON at.agent_id = a.id
         JOIN tools_resource tr ON tr.id = at.tool_id
         JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
         JOIN tool_artifact t ON t.id = ttj.tool_id
         JOIN resource_tools_relation rt ON rt.tool_id = t.id
         WHERE rt.resource = 'scenarios'::resource_type
           AND at.active = true
           AND EXISTS (
               SELECT 1 FROM agent_flags_junction af
               JOIN flags_resource f ON f.id = af.flag_id
               WHERE af.agent_id = a.id
                 AND f.name = 'agent_active'
                 AND af.value = true
           )
         LIMIT 1) as scenarios_agent_id,
        -- Basic agent (simulation basic agent)
        (SELECT a.id FROM agent_artifact a
         JOIN agent_flags_junction af ON af.agent_id = a.id
         JOIN flags_resource f ON f.id = af.flag_id
         WHERE f.name = 'agent_simulation_basic'
           AND af.value = true
           AND EXISTS (
               SELECT 1 FROM agent_flags_junction af2
               JOIN flags_resource f2 ON f2.id = af2.flag_id
               WHERE af2.agent_id = a.id
                 AND f2.name = 'agent_active'
                 AND af2.value = true
           )
         LIMIT 1) as basic_agent_id,
        -- General agent (simulation general agent)
        (SELECT a.id FROM agent_artifact a
         JOIN agent_flags_junction af ON af.agent_id = a.id
         JOIN flags_resource f ON f.id = af.flag_id
         WHERE f.name = 'agent_simulation_general'
           AND af.value = true
           AND EXISTS (
               SELECT 1 FROM agent_flags_junction af2
               JOIN flags_resource f2 ON f2.id = af2.flag_id
               WHERE af2.agent_id = a.id
                 AND f2.name = 'agent_active'
                 AND af2.value = true
           )
         LIMIT 1) as general_agent_id
),
-- Check tools existence
tools_check AS (
    SELECT
        EXISTS (
            SELECT 1 FROM tool_artifact t
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE rt.resource = 'names'::resource_type
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM tool_artifact t
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE rt.resource = 'descriptions'::resource_type
        ) as descriptions_has_tools,
        EXISTS (
            SELECT 1 FROM tool_artifact t
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE rt.resource = 'flags'::resource_type
        ) as flags_has_tools,
        EXISTS (
            SELECT 1 FROM tool_artifact t
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE rt.resource = 'departments'::resource_type
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM tool_artifact t
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE rt.resource = 'scenarios'::resource_type
        ) as scenarios_has_tools
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
    ad.name_agent_id,
    ad.description_agent_id,
    ad.flag_agent_id,
    ad.departments_agent_id,
    ad.scenarios_agent_id,
    ad.basic_agent_id,
    ad.general_agent_id,
    tc.names_has_tools,
    tc.descriptions_has_tools,
    tc.flags_has_tools,
    tc.departments_has_tools,
    tc.scenarios_has_tools
FROM agent_data ad
CROSS JOIN tools_check tc;
$$;
