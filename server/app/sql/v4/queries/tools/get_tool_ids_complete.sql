-- Tool ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Drop and recreate composite type for candidate agents
DO $$
BEGIN
    DROP TYPE IF EXISTS tool_candidate_agent CASCADE;

    CREATE TYPE tool_candidate_agent AS (
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

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_tool_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_tool_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_tool_ids_v4(
    profile_id uuid,
    tool_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    name_id uuid,
    description_id uuid,
    active_flag_id uuid,

    args_ids uuid[],
    arg_position_ids uuid[],
    args_outputs_ids uuid[],

    candidate_agents tool_candidate_agent[],

    names_has_tools boolean,
    descriptions_has_tools boolean,
    args_has_tools boolean,
    arg_positions_has_tools boolean,
    args_outputs_has_tools boolean,

    name_domain_id uuid,
    description_domain_id uuid,
    flag_domain_id uuid,
    args_domain_id uuid,
    arg_positions_domain_id uuid,
    args_outputs_domain_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        tool_id AS tool_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
name_resource_data AS (
    SELECT
        COALESCE(
            (SELECT nd.names_id FROM names_drafts_connection nd WHERE nd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT tn.name_id FROM tool_names_junction tn WHERE tn.tool_id = (SELECT tool_id FROM params) AND tn.active = true LIMIT 1)
        ) as name_id
    FROM params
),
description_resource_data AS (
    SELECT
        COALESCE(
            (SELECT dd.descriptions_id FROM descriptions_drafts_connection dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT td.description_id FROM tool_descriptions_junction td WHERE td.tool_id = (SELECT tool_id FROM params) AND td.active = true LIMIT 1)
        ) as description_id
    FROM params
),
flag_resource_data AS (
    SELECT
        COALESCE(
            (SELECT fd.flags_id FROM flags_drafts_connection fd WHERE fd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT tf.flag_id
             FROM tool_flags_junction tf
             JOIN flags_resource f ON tf.flag_id = f.id
             WHERE tf.tool_id = (SELECT tool_id FROM params)
               AND tf.active = true
               AND f.name = 'tool_active'
               AND tf.value = TRUE
             LIMIT 1)
        ) as active_flag_id
    FROM params
),
args_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN COALESCE(
                (SELECT ARRAY_AGG(ad.args_id ORDER BY ad.created_at)
                 FROM args_drafts_connection ad
                 WHERE ad.draft_id = (SELECT draft_id FROM params)
                   AND ad.active = true),
                ARRAY[]::uuid[]
            )
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ta.args_id ORDER BY ta.created_at)
                 FROM tool_args_junction ta
                 WHERE ta.tool_id = (SELECT tool_id FROM params)),
                ARRAY[]::uuid[]
            )
        END as args_ids
    FROM params
    LIMIT 1
),
arg_position_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN COALESCE(
                (SELECT ARRAY_AGG(apd.arg_positions_id ORDER BY apd.created_at)
                 FROM arg_positions_drafts_connection apd
                 WHERE apd.draft_id = (SELECT draft_id FROM params)
                   AND apd.active = true),
                ARRAY[]::uuid[]
            )
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(tap.arg_positions_id ORDER BY tap.created_at)
                 FROM tool_arg_positions_junction tap
                 WHERE tap.tool_id = (SELECT tool_id FROM params)
                   AND tap.active = true),
                ARRAY[]::uuid[]
            )
        END as arg_position_ids
    FROM params
    LIMIT 1
),
args_outputs_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL THEN COALESCE(
                (SELECT ARRAY_AGG(dao.args_outputs_id ORDER BY dao.created_at)
                 FROM args_outputs_drafts_connection dao
                 WHERE dao.draft_id = (SELECT draft_id FROM params)
                   AND dao.active = true),
                ARRAY[]::uuid[]
            )
            WHEN (SELECT tool_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(tao.args_outputs_id ORDER BY tao.created_at)
                 FROM tool_args_outputs_junction tao
                 WHERE tao.tool_id = (SELECT tool_id FROM params)),
                ARRAY[]::uuid[]
            )
        END as args_outputs_ids
    FROM params
    LIMIT 1
),
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
tools_existence_check AS (
    SELECT
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'names'::resource_type AND rt.active = true AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as names_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'descriptions'::resource_type AND rt.active = true AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as descriptions_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'args'::resource_type AND rt.active = true AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as args_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'arg_positions'::resource_type AND rt.active = true AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as arg_positions_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'args_outputs'::resource_type AND rt.active = true AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as args_outputs_has_tools
    FROM params x
),
domain_ids_data AS (
    SELECT
        (SELECT id FROM domains_resource WHERE resource = 'names'::resource_type AND active = true LIMIT 1) as name_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'descriptions'::resource_type AND active = true LIMIT 1) as description_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'flags'::resource_type AND active = true LIMIT 1) as flag_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'args'::resource_type AND active = true LIMIT 1) as args_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'arg_positions'::resource_type AND active = true LIMIT 1) as arg_positions_domain_id,
        (SELECT id FROM domains_resource WHERE resource = 'args_outputs'::resource_type AND active = true LIMIT 1) as args_outputs_domain_id
)
SELECT
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,

    (SELECT args_ids FROM args_ids_data) as args_ids,
    (SELECT arg_position_ids FROM arg_position_ids_data) as arg_position_ids,
    (SELECT args_outputs_ids FROM args_outputs_ids_data) as args_outputs_ids,

    (SELECT COALESCE(
        ARRAY_AGG(ROW(ca.agent_id, ca.agent_name, ca.tool_resources, ca.create_tool_ids, ca.link_tool_ids, ca.department_ids, ca.updated_at, ca.is_mcp)::tool_candidate_agent),
        ARRAY[]::tool_candidate_agent[]
    ) FROM candidate_agents_data ca) as candidate_agents,

    tec.names_has_tools,
    tec.descriptions_has_tools,
    tec.args_has_tools,
    tec.arg_positions_has_tools,
    tec.args_outputs_has_tools,

    did.name_domain_id,
    did.description_domain_id,
    did.flag_domain_id,
    did.args_domain_id,
    did.arg_positions_domain_id,
    did.args_outputs_domain_id
FROM params x
CROSS JOIN tools_existence_check tec
CROSS JOIN domain_ids_data did;
$$;
