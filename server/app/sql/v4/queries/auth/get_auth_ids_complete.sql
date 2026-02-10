-- Auth ID Fetching (Query 2 of Two-Pass Architecture)
-- Fetches all resource IDs using user context from Query 1
-- This query runs AFTER access check, BEFORE parallel resource fetching

-- Drop and recreate composite type for candidate agents
DO $$
BEGIN
    -- Drop the type if it exists (CASCADE will drop dependent functions)
    DROP TYPE IF EXISTS auth_candidate_agent CASCADE;

    -- Recreate with fields for create/link tool IDs
    CREATE TYPE auth_candidate_agent AS (
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
        WHERE proname = 'api_get_auth_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_auth_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_auth_ids_v4(
    profile_id uuid,
    auth_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    -- Single-select resource IDs (from draft or auth junction)
    name_id uuid,
    description_id uuid,
    active_flag_id uuid,

    -- Multi-select resource IDs
    protocol_ids uuid[],
    slug_ids uuid[],

    -- Auth items (special junction)
    auth_item_ids uuid[],

    -- Candidate agents (for Python-side agent scoring)
    candidate_agents auth_candidate_agent[],

    -- Tools existence (for Python to compute show_* flags)
    names_has_tools boolean,
    protocols_has_tools boolean,
    slugs_has_tools boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        auth_id AS auth_id,
        draft_id AS draft_id,
        profile_id AS profile_id,
        group_id AS group_id,
        user_department_ids AS user_department_ids
),
-- Convert auths_resource.id to auth_artifact.id
auth_artifact_id_lookup AS (
    SELECT
        CASE
            WHEN (SELECT auth_id FROM params) IS NULL THEN NULL::uuid
            ELSE COALESCE(
                (SELECT aaj.auth_id FROM auths_resource ar JOIN auth_auths_junction aaj ON aaj.auths_id = ar.id WHERE ar.id = (SELECT auth_id FROM params)),
                (SELECT auth_id FROM params)
            )
        END as auth_artifact_id
),
-- Draft resource IDs (if draft_id is provided)
draft_name_data AS (
    SELECT ndc.names_id as name_id
    FROM names_drafts_connection ndc
    WHERE ndc.draft_id = (SELECT draft_id FROM params)
    ORDER BY ndc.version DESC
    LIMIT 1
),
draft_description_data AS (
    SELECT ddc.descriptions_id as description_id
    FROM descriptions_drafts_connection ddc
    WHERE ddc.draft_id = (SELECT draft_id FROM params)
    ORDER BY ddc.version DESC
    LIMIT 1
),
draft_flag_data AS (
    SELECT fdc.flags_id as flag_id
    FROM flags_drafts_connection fdc
    WHERE fdc.draft_id = (SELECT draft_id FROM params)
    ORDER BY fdc.version DESC
    LIMIT 1
),
draft_protocol_data AS (
    SELECT COALESCE(ARRAY_AGG(pdc.protocols_id), ARRAY[]::uuid[]) as protocol_ids
    FROM protocols_drafts_connection pdc
    WHERE pdc.draft_id = (SELECT draft_id FROM params)
),
draft_slug_data AS (
    SELECT COALESCE(ARRAY_AGG(sdc.slugs_id), ARRAY[]::uuid[]) as slug_ids
    FROM slugs_drafts_connection sdc
    WHERE sdc.draft_id = (SELECT draft_id FROM params)
),
-- Single-select resource IDs (draft overrides canonical)
name_resource_data AS (
    SELECT
        COALESCE(
            (SELECT name_id FROM draft_name_data),
            (SELECT an.name_id FROM auth_names_junction an WHERE an.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup) LIMIT 1)
        ) as name_id
    FROM params
),
description_resource_data AS (
    SELECT
        COALESCE(
            (SELECT description_id FROM draft_description_data),
            (SELECT ad.description_id FROM auth_descriptions_junction ad WHERE ad.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup) LIMIT 1)
        ) as description_id
    FROM params
),
flag_resource_data AS (
    SELECT
        COALESCE(
            (SELECT flag_id FROM draft_flag_data),
            (SELECT af.flag_id
             FROM auth_flags_junction af
             JOIN flags_resource f ON af.flag_id = f.id
             WHERE af.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup)
               AND f.name = 'auth_active'
               AND af.value = TRUE
             LIMIT 1)
        ) as active_flag_id
    FROM params
),
-- Multi-select resource IDs (draft overrides canonical)
protocol_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM draft_protocol_data WHERE array_length(protocol_ids, 1) > 0)
                THEN (SELECT protocol_ids FROM draft_protocol_data)
            WHEN (SELECT auth_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ap.protocol_id ORDER BY ap.created_at)
                 FROM auth_protocols_junction ap
                 WHERE ap.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup)),
                ARRAY[]::uuid[]
            )
        END as protocol_ids
    FROM params
    LIMIT 1
),
slug_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (SELECT 1 FROM draft_slug_data WHERE array_length(slug_ids, 1) > 0)
                THEN (SELECT slug_ids FROM draft_slug_data)
            WHEN (SELECT auth_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(asj.slug_id ORDER BY asj.created_at)
                 FROM auth_slugs_junction asj
                 WHERE asj.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup)),
                ARRAY[]::uuid[]
            )
        END as slug_ids
    FROM params
    LIMIT 1
),
-- Auth item IDs
auth_item_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT draft_id FROM params) IS NOT NULL AND EXISTS (
                SELECT 1
                FROM items_drafts_connection idc
                WHERE idc.draft_id = (SELECT draft_id FROM params)
            )
                THEN COALESCE(
                    (
                        SELECT ARRAY_AGG(idc.items_id ORDER BY i.position)
                        FROM items_drafts_connection idc
                        JOIN items_resource i ON i.id = idc.items_id
                        WHERE idc.draft_id = (SELECT draft_id FROM params)
                    ),
                    ARRAY[]::uuid[]
                )
            WHEN (SELECT auth_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(aij.item_id ORDER BY i.position)
                 FROM auth_items_junction aij
                 JOIN items_resource i ON i.id = aij.item_id
                 WHERE aij.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup)),
                ARRAY[]::uuid[]
            )
        END as auth_item_ids
    FROM params
    LIMIT 1
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
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'protocols'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as protocols_has_tools,
        EXISTS (SELECT 1 FROM resource_tools_relation rt JOIN tool_artifact t ON t.id = rt.tool_id WHERE rt.resource = 'slugs'::resource_type AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)) as slugs_has_tools
    FROM params x
)
SELECT
    -- Single-select resource IDs
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,

    -- Multi-select resource IDs
    (SELECT protocol_ids FROM protocol_ids_data) as protocol_ids,
    (SELECT slug_ids FROM slug_ids_data) as slug_ids,

    -- Auth item IDs
    (SELECT auth_item_ids FROM auth_item_ids_data) as auth_item_ids,

    -- Candidate agents (for Python-side agent scoring)
    (SELECT COALESCE(
        ARRAY_AGG(ROW(ca.agent_id, ca.agent_name, ca.tool_resources, ca.create_tool_ids, ca.link_tool_ids, ca.department_ids, ca.updated_at, ca.is_mcp)::auth_candidate_agent),
        ARRAY[]::auth_candidate_agent[]
    ) FROM candidate_agents_data ca) as candidate_agents,

    -- Tools existence
    tec.names_has_tools,
    tec.protocols_has_tools,
    tec.slugs_has_tools
FROM params x
CROSS JOIN tools_existence_check tec;
$$;
