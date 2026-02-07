-- Cohort ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Drop and recreate composite type for candidate agents (with tool IDs)
DROP TYPE IF EXISTS cohort_candidate_agent CASCADE;
CREATE TYPE cohort_candidate_agent AS (
    agent_id uuid,
    agent_name text,
    tool_resources text[],
    create_tool_ids uuid[],
    link_tool_ids uuid[],
    department_ids uuid[],
    updated_at timestamptz,
    is_mcp boolean
);

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_cohort_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_cohort_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_cohort_ids_v4(
    profile_id uuid,
    cohort_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or cohort junction)
    name_id uuid,
    description_id uuid,
    active_flag_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    simulation_ids uuid[],

    -- Simulation positions (special composite type from current implementation)
    simulation_position_values int[],

    -- Suggestion IDs (computed in resource search endpoints)
    name_suggestions uuid[],
    description_suggestions uuid[],
    department_suggestions uuid[],
    simulation_suggestions uuid[],

    -- Candidate agents (for Python-side agent scoring)
    candidate_agents cohort_candidate_agent[],

    -- Tools existence (for Python to compute show_* flags)
    names_has_tools boolean,
    descriptions_has_tools boolean,
    flags_has_tools boolean,
    departments_has_tools boolean,
    simulations_has_tools boolean,

    -- Domain IDs (from domains_resource table)
    names_domain_id uuid,
    descriptions_domain_id uuid,
    flags_domain_id uuid,
    departments_domain_id uuid,
    simulations_domain_id uuid,
    simulation_positions_domain_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        cohort_id AS cohort_id,
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
draft_simulations_data AS (
    SELECT COALESCE(ARRAY_REMOVE(ARRAY_AGG(ds.simulations_id ORDER BY ds.created_at), NULL), ARRAY[]::uuid[]) as simulation_ids
    FROM params x
    LEFT JOIN simulations_drafts_connection ds ON ds.draft_id = x.draft_id
    LIMIT 1
),
-- Cohort junction multi-select resource IDs
cohort_departments_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT cohort_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(cd.department_id ORDER BY cd.created_at)
                 FROM cohort_departments_junction cd
                 WHERE cd.cohort_id = (SELECT cohort_id FROM params) AND cd.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
cohort_simulations_junction_data AS (
    SELECT
        CASE
            WHEN (SELECT cohort_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(cs.simulation_id ORDER BY cs.created_at)
                 FROM cohort_simulations_junction cs
                 WHERE cs.cohort_id = (SELECT cohort_id FROM params) AND cs.active = true),
                ARRAY[]::uuid[]
            )
        END as simulation_ids
    FROM params
    LIMIT 1
),
-- Combined multi-select IDs (draft preferred over cohort)
cohort_departments_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT department_ids FROM draft_departments_data), 1), 0) > 0
                THEN (SELECT department_ids FROM draft_departments_data)
            WHEN COALESCE(array_length((SELECT department_ids FROM cohort_departments_junction_data), 1), 0) > 0
                THEN (SELECT department_ids FROM cohort_departments_junction_data)
            ELSE ARRAY[]::uuid[]
        END as department_ids
    FROM params
    LIMIT 1
),
cohort_simulations_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT simulation_ids FROM draft_simulations_data), 1), 0) > 0
                THEN (SELECT simulation_ids FROM draft_simulations_data)
            WHEN COALESCE(array_length((SELECT simulation_ids FROM cohort_simulations_junction_data), 1), 0) > 0
                THEN (SELECT simulation_ids FROM cohort_simulations_junction_data)
            ELSE ARRAY[]::uuid[]
        END as simulation_ids
    FROM params
    LIMIT 1
),
-- Single-select resource IDs (from draft or cohort junction)
name_resource_data AS (
    SELECT COALESCE(
        (SELECT n.id FROM names_drafts_connection dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT cn.name_id FROM cohort_names_junction cn WHERE cn.cohort_id = (SELECT cohort_id FROM params) LIMIT 1)
    ) as name_id
    FROM params
),
description_resource_data AS (
    SELECT COALESCE(
        (SELECT dd.descriptions_id FROM descriptions_drafts_connection dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT cd.description_id FROM cohort_descriptions_junction cd WHERE cd.cohort_id = (SELECT cohort_id FROM params) LIMIT 1)
    ) as description_id
    FROM params
),
flag_resource_data AS (
    SELECT COALESCE(
        (SELECT df.flags_id FROM flags_drafts_connection df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
        (SELECT cf.flag_id FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = (SELECT cohort_id FROM params) AND f.name = 'cohort_active' AND cf.value = TRUE LIMIT 1)
    ) as active_flag_id
    FROM params
),
-- Simulation positions (from draft or cohort junction)
simulation_positions_draft_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG(dsp.value ORDER BY dsp.value),
            '{}'::int[]
        ) as simulation_position_values
    FROM params x
    LEFT JOIN simulation_positions_drafts_connection dsp ON dsp.draft_id = x.draft_id
    LIMIT 1
),
cohort_simulation_positions_data AS (
    SELECT
        CASE
            WHEN (SELECT cohort_id FROM params) IS NULL THEN '{}'::int[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(spr.value ORDER BY spr.value)
                 FROM cohort_simulation_positions_junction csp
                 JOIN simulation_positions_resource spr ON spr.id = csp.simulation_position_id
                 WHERE csp.cohort_id = (SELECT cohort_id FROM params)
                   AND csp.active = true),
                '{}'::int[]
            )
        END as simulation_position_values
    FROM params
    LIMIT 1
),
simulation_positions_combined_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL
                AND COALESCE(array_length((SELECT simulation_position_values FROM simulation_positions_draft_data), 1), 0) > 0
                THEN (SELECT simulation_position_values FROM simulation_positions_draft_data)
            WHEN COALESCE(array_length((SELECT simulation_position_values FROM cohort_simulation_positions_data), 1), 0) > 0
                THEN (SELECT simulation_position_values FROM cohort_simulation_positions_data)
            ELSE '{}'::int[]
        END as simulation_position_values
    FROM params
    LIMIT 1
),
-- Candidate agents data (for Python-side agent scoring)
-- Three-CTE tool resolution pattern (matches persona gold standard)
-- Step 0: Flatten agent -> tools -> resource_tools_relation with is_creatable flag
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
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'flags'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as flags_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'departments'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as departments_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'simulations'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as simulations_has_tools
    FROM params x
),
-- Domain IDs from domains_resource table
domain_ids_data AS (
    SELECT
        (SELECT id FROM domains_resource WHERE resource = 'names'::resource_type AND active = true LIMIT 1) as names_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'descriptions'::resource_type AND active = true LIMIT 1) as descriptions_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'flags'::resource_type AND active = true LIMIT 1) as flags_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'departments'::resource_type AND active = true LIMIT 1) as departments_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'simulations'::resource_type AND active = true LIMIT 1) as simulations_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'simulation_positions'::resource_type AND active = true LIMIT 1) as simulation_positions_domain_id
)
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,

    -- Multi-select resource IDs
    (SELECT department_ids FROM cohort_departments_combined_data) as department_ids,
    (SELECT simulation_ids FROM cohort_simulations_combined_data) as simulation_ids,

    -- Simulation positions
    (SELECT simulation_position_values FROM simulation_positions_combined_data) as simulation_position_values,

    -- Suggestion IDs (computed in resource search endpoints)
    ARRAY[]::uuid[] as name_suggestions,
    ARRAY[]::uuid[] as description_suggestions,
    ARRAY[]::uuid[] as department_suggestions,
    ARRAY[]::uuid[] as simulation_suggestions,

    -- Candidate agents (for Python-side agent scoring)
    (SELECT COALESCE(
        ARRAY_AGG(ROW(ca.agent_id, ca.agent_name, ca.tool_resources, ca.create_tool_ids, ca.link_tool_ids, ca.department_ids, ca.updated_at, ca.is_mcp)::cohort_candidate_agent),
        ARRAY[]::cohort_candidate_agent[]
    ) FROM candidate_agents_data ca) as candidate_agents,

    -- Tools existence
    tec.names_has_tools,
    tec.descriptions_has_tools,
    tec.flags_has_tools,
    tec.departments_has_tools,
    tec.simulations_has_tools,

    -- Domain IDs
    did.names_domain_id,
    did.descriptions_domain_id,
    did.flags_domain_id,
    did.departments_domain_id,
    did.simulations_domain_id,
    did.simulation_positions_domain_id
FROM params x
CROSS JOIN tools_existence_check tec
CROSS JOIN domain_ids_data did;
$$;
