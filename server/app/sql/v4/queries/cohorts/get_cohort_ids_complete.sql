-- Cohort ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Create composite type for candidate agents (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cohort_candidate_agent') THEN
        CREATE TYPE cohort_candidate_agent AS (
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
    simulations_has_tools boolean
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
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'flags'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as flags_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'departments'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as departments_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'simulations'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as simulations_has_tools
    FROM params x
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
        ARRAY_AGG(ROW(ca.agent_id, ca.agent_name, ca.tool_resources, ca.department_ids, ca.updated_at, ca.is_mcp)::cohort_candidate_agent),
        ARRAY[]::cohort_candidate_agent[]
    ) FROM candidate_agents_data ca) as candidate_agents,

    -- Tools existence
    tec.names_has_tools,
    tec.descriptions_has_tools,
    tec.flags_has_tools,
    tec.departments_has_tools,
    tec.simulations_has_tools
FROM params x
CROSS JOIN tools_existence_check tec;
$$;
