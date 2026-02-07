-- Rubric ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Drop and recreate composite type for candidate agents
DO $$
BEGIN
    DROP TYPE IF EXISTS rubric_candidate_agent CASCADE;

    CREATE TYPE rubric_candidate_agent AS (
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
        WHERE proname = 'api_get_rubric_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_rubric_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_rubric_ids_v4(
    profile_id uuid,
    rubric_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or rubric junction)
    name_id uuid,
    description_id uuid,
    active_flag_id uuid,
    total_points_id uuid,
    pass_points_id uuid,

    -- Multi-select resource IDs
    department_ids uuid[],
    standard_group_ids uuid[],
    standard_ids uuid[],

    -- Candidate agents (for Python-side agent scoring)
    candidate_agents rubric_candidate_agent[],

    -- Tools existence (for Python to compute show_* flags)
    names_has_tools boolean,
    descriptions_has_tools boolean,
    departments_has_tools boolean,
    points_has_tools boolean,
    standard_groups_has_tools boolean,
    standards_has_tools boolean,

    -- Domain IDs (for domain-based generation)
    name_domain_id uuid,
    description_domain_id uuid,
    flag_domain_id uuid,
    departments_domain_id uuid,
    points_domain_id uuid,
    pass_points_domain_id uuid,
    standard_groups_domain_id uuid,
    standards_domain_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        rubric_id AS rubric_id,
        profile_id AS profile_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Rubric junction multi-select resource IDs (canonical only).
rubric_departments_data AS (
    SELECT
        CASE
            WHEN (SELECT rubric_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(rd.department_id ORDER BY rd.created_at)
                 FROM rubric_departments_junction rd
                 WHERE rd.rubric_id = (SELECT rubric_id FROM params) AND rd.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
rubric_standard_groups_data AS (
    SELECT
        CASE
            WHEN (SELECT rubric_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(rsg.standard_group_id ORDER BY rsg.position, rsg.created_at)
                 FROM rubric_standard_groups_junction rsg
                 WHERE rsg.rubric_id = (SELECT rubric_id FROM params) AND rsg.active = true),
                ARRAY[]::uuid[]
            )
        END as standard_group_ids
    FROM params
    LIMIT 1
),
rubric_standards_data AS (
    SELECT
        CASE
            WHEN (SELECT rubric_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(rs.standard_id ORDER BY rs.created_at)
                 FROM rubric_standards_junction rs
                 WHERE rs.rubric_id = (SELECT rubric_id FROM params) AND rs.active = true),
                ARRAY[]::uuid[]
            )
        END as standard_ids
    FROM params
    LIMIT 1
),
-- Single-select resource IDs (canonical only).
name_resource_data AS (
    SELECT
        (SELECT rn.name_id FROM rubric_names_junction rn WHERE rn.rubric_id = (SELECT rubric_id FROM params) LIMIT 1) as name_id
    FROM params
),
description_resource_data AS (
    SELECT
        (SELECT rd.description_id FROM rubric_descriptions_junction rd WHERE rd.rubric_id = (SELECT rubric_id FROM params) LIMIT 1) as description_id
    FROM params
),
flag_resource_data AS (
    SELECT
        (SELECT rf.flag_id
         FROM rubric_flags_junction rf
         JOIN flags_resource f ON rf.flag_id = f.id
         WHERE rf.rubric_id = (SELECT rubric_id FROM params)
           AND f.name = 'rubric_active'
           AND rf.value = TRUE
         LIMIT 1) as active_flag_id
    FROM params
),
total_points_resource_data AS (
    SELECT
        (SELECT rp.point_id
         FROM rubric_points_junction rp
         WHERE rp.rubric_id = (SELECT rubric_id FROM params)
           AND rp.type = 'total'::point_type
         LIMIT 1) as total_points_id
    FROM params
),
pass_points_resource_data AS (
    SELECT
        (SELECT rp.point_id
         FROM rubric_points_junction rp
         WHERE rp.rubric_id = (SELECT rubric_id FROM params)
           AND rp.type = 'pass'::point_type
         LIMIT 1) as pass_points_id
    FROM params
),
-- Candidate agents data (for Python-side agent scoring)
agent_resource_tools AS (
    SELECT
        a.id as agent_id,
        rt.resource::text as resource_name,
        ta.id as tool_id,
        COALESCE(tf_create.value, true) as is_creatable
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
agent_resource_tool_pairs AS (
    SELECT
        art.agent_id,
        art.resource_name,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = true))[1] as create_tool_id,
        (ARRAY_AGG(art.tool_id ORDER BY art.tool_id) FILTER (WHERE art.is_creatable = false))[1] as link_tool_id
    FROM agent_resource_tools art
    GROUP BY art.agent_id, art.resource_name
),
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
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'departments'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as departments_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'points'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as points_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'standard_groups'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as standard_groups_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'standards'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as standards_has_tools
    FROM params x
),
-- Domain IDs from domains_resource table
domain_ids_data AS (
    SELECT
        (SELECT id FROM domains_resource WHERE resource = 'names'::resource_type AND active = true LIMIT 1) as name_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'descriptions'::resource_type AND active = true LIMIT 1) as description_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'flags'::resource_type AND active = true LIMIT 1) as flag_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'departments'::resource_type AND active = true LIMIT 1) as departments_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'points'::resource_type AND active = true LIMIT 1) as points_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'points'::resource_type AND active = true LIMIT 1) as pass_points_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'standard_groups'::resource_type AND active = true LIMIT 1) as standard_groups_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'standards'::resource_type AND active = true LIMIT 1) as standards_domain_id
)
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    (SELECT total_points_id FROM total_points_resource_data) as total_points_id,
    (SELECT pass_points_id FROM pass_points_resource_data) as pass_points_id,

    -- Multi-select resource IDs
    (SELECT department_ids FROM rubric_departments_data) as department_ids,
    (SELECT standard_group_ids FROM rubric_standard_groups_data) as standard_group_ids,
    (SELECT standard_ids FROM rubric_standards_data) as standard_ids,

    -- Candidate agents (for Python-side agent scoring)
    (SELECT COALESCE(
        ARRAY_AGG(ROW(ca.agent_id, ca.agent_name, ca.tool_resources, ca.create_tool_ids, ca.link_tool_ids, ca.department_ids, ca.updated_at, ca.is_mcp)::rubric_candidate_agent),
        ARRAY[]::rubric_candidate_agent[]
    ) FROM candidate_agents_data ca) as candidate_agents,

    -- Tools existence
    tec.names_has_tools,
    tec.descriptions_has_tools,
    tec.departments_has_tools,
    tec.points_has_tools,
    tec.standard_groups_has_tools,
    tec.standards_has_tools,

    -- Domain IDs
    did.name_domain_id,
    did.description_domain_id,
    did.flag_domain_id,
    did.departments_domain_id,
    did.points_domain_id,
    did.pass_points_domain_id,
    did.standard_groups_domain_id,
    did.standards_domain_id
FROM params x
CROSS JOIN tools_existence_check tec
CROSS JOIN domain_ids_data did;
$$;
