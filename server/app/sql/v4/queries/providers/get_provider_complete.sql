-- Unified get provider function - handles both new (provider_id = NULL) and detail (provider_id provided)
-- Converted to function with composite types
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_provider_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_provider_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITH CASCADE (to handle dependencies)
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_provider_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_provider_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_provider_v4_description_resource AS (
    id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_provider_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon_id uuid,
    generated boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_provider_v4(
    profile_id uuid,
    provider_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    provider_exists boolean,
    can_edit boolean,
    disabled_reason text,
    draft_version int,
    group_id uuid,
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_provider_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_provider_v4_name_resource[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_provider_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_provider_v4_description_resource[],
    -- Single-select resources: flag
    active_flag_id uuid,
    flag_resource types.q_get_provider_v4_flag_resource,
    show_flag boolean,
    flag_agent_id uuid,
    flag_required boolean,
    flags types.q_get_provider_v4_flag_resource[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        provider_id AS provider_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check provider existence if provider_id provided
provider_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT provider_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM provider_artifact WHERE id = (SELECT provider_id FROM params))::boolean
        END as provider_exists
),
-- Draft data is now stored in draft_* junction tables, not in payload
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload
    FROM params x
    WHERE x.draft_id IS NOT NULL
    LIMIT 1
),
-- Get group_id from draft or provider (via junction tables)
draft_group_data AS (
    SELECT
        COALESCE(
            d.group_id,
            pgj.group_id,
            (SELECT id FROM groups_entry ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params x
    LEFT JOIN drafts_entry d ON d.id = x.draft_id
    LEFT JOIN provider_artifact p ON p.id = x.provider_id
    LEFT JOIN provider_groups_junction pgj ON pgj.provider_id = p.id
    -- Always return at least one row (use COALESCE to handle NULL draft_id/provider_id case)
    WHERE TRUE
    LIMIT 1
),
draft_version_data AS (
    -- Keep draft_version for client-side expected_version sync to avoid unintended draft forks.
    SELECT d.version as draft_version
    FROM params x
    LEFT JOIN drafts_entry d ON d.id = x.draft_id
    WHERE TRUE
    LIMIT 1
),
user_profile AS (
    SELECT role, actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Tool existence checks
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'names'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'descriptions'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as descriptions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'flags'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as flags_has_tools
    FROM params x
),
-- Missing tools check for required resources
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            CASE WHEN NOT tec.names_has_tools THEN 'name' ELSE NULL END,
            CASE WHEN NOT tec.flags_has_tools THEN 'flag' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM tools_existence_check tec
),
ui_flags AS (
    SELECT 
        true as show_name,  -- Always show name picker
        true as show_description,  -- Always show description picker
        true as show_flag  -- Flag is a boolean toggle that should be shown
    FROM params x
),
-- Name suggestions: linked to providers OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pn.name_id ORDER BY pn.created_at DESC)
             FROM (
                 SELECT DISTINCT pn.name_id, MAX(pn.created_at) as created_at
                 FROM provider_names_junction pn
                 JOIN names_resource n ON n.id = pn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to providers (provider_names_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       pn.generated = false
                       OR
                       (
                           pn.generated = true
                           AND n.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls_entry c
                               JOIN runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM names_calls_connection WHERE names_id = n.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY pn.name_id
                 ORDER BY MAX(pn.created_at) DESC
                 LIMIT 20
             ) pn),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Description suggestions: linked to providers OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pd.description_id ORDER BY pd.created_at DESC)
             FROM (
                 SELECT DISTINCT pd.description_id, MAX(pd.created_at) as created_at
                 FROM provider_descriptions_junction pd
                 JOIN descriptions_resource d ON d.id = pd.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pd.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       -- Option 1: Linked to providers (provider_descriptions_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       pd.generated = false
                       OR
                       (
                           pd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls_entry c
                               JOIN runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM descriptions_calls_connection WHERE descriptions_id = d.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY pd.description_id
                 ORDER BY MAX(pd.created_at) DESC
                 LIMIT 20
             ) pd),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Suggested resource objects CTEs - fetch full resource objects for suggestions
names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_provider_v4_name_resource
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_provider_v4_name_resource[]
        ) as names
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
descriptions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (d.id, d.description, COALESCE(d.generated, false))::types.q_get_provider_v4_description_resource
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_provider_v4_description_resource[]
        ) as descriptions
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
-- Resource data CTEs - query from provider_* tables or draft_* tables if draft_id provided
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT n.id FROM names_drafts_connection dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pn.name_id FROM provider_names_junction pn WHERE pn.provider_id = (SELECT provider_id FROM params) LIMIT 1)
        ) as name_id,
        (
            SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_provider_v4_name_resource 
            FROM (
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 1 as priority
                FROM names_drafts_connection dn 
                JOIN names_resource n ON dn.names_id = n.id 
                WHERE dn.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 2 as priority
                FROM provider_names_junction pn 
                JOIN names_resource n ON pn.name_id = n.id 
                WHERE pn.provider_id = (SELECT provider_id FROM params)
            ) n
            ORDER BY priority
            LIMIT 1
        ) as name_resource
    FROM params
),
description_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT d.id FROM descriptions_drafts_connection dd JOIN descriptions_resource d ON dd.descriptions_id = d.id WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pd.description_id FROM provider_descriptions_junction pd WHERE pd.provider_id = (SELECT provider_id FROM params) LIMIT 1)
        ) as description_id,
        (
            SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_provider_v4_description_resource 
            FROM (
                SELECT d.id, d.description, COALESCE(d.generated, false) as generated, 1 as priority
                FROM descriptions_drafts_connection dd 
                JOIN descriptions_resource d ON dd.descriptions_id = d.id 
                WHERE dd.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT d.id, d.description, COALESCE(d.generated, false) as generated, 2 as priority
                FROM provider_descriptions_junction pd 
                JOIN descriptions_resource d ON pd.description_id = d.id 
                WHERE pd.provider_id = (SELECT provider_id FROM params)
            ) d
            ORDER BY priority
            LIMIT 1
        ) as description_resource
    FROM params
),
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT f.id FROM flags_drafts_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pf.flag_id FROM provider_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.provider_id = (SELECT provider_id FROM params) AND f.name = 'provider_active' AND pf.value = TRUE LIMIT 1)
        ) as active_flag_id,
        (
            SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_provider_v4_flag_resource 
            FROM (
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 1 as priority
                FROM flags_drafts_connection df 
                JOIN flags_resource f ON df.flags_id = f.id 
                WHERE df.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false) as generated, 2 as priority
                FROM provider_flags_junction pf 
                JOIN flags_resource f ON pf.flag_id = f.id 
                JOIN flags_resource fl ON pf.flag_id = fl.id 
                WHERE pf.provider_id = (SELECT provider_id FROM params) 
                  AND fl.name = 'active' 
                  AND f.name = 'provider_active' 
                  AND pf.value = TRUE
            ) f
            ORDER BY priority
            LIMIT 1
        ) as flag_resource
    FROM params
),
-- Flags (all available flag options)
flags_data AS (
    SELECT DISTINCT
        f.id,
        f.name,
        f.description,
        f.icon_id,
        COALESCE(f.generated, false) as generated
    FROM flags_resource f
    CROSS JOIN params p
    WHERE 
        -- Always include selected active_flag_id if it exists
        f.id = (SELECT active_flag_id FROM flag_resource_data)
        OR (SELECT active_flag_id FROM flag_resource_data) IS NULL
    ORDER BY f.name
),
-- Descriptions: linked to providers OR same group with generated=true
descriptions_data AS (
    SELECT DISTINCT
        d.id,
        d.description,
        COALESCE(d.generated, false) as generated
    FROM descriptions_resource d
    CROSS JOIN params p
    CROSS JOIN draft_group_data dgd
    WHERE 
        -- Always include selected description_id if it exists
        d.id = (SELECT description_id FROM description_resource_data)
        OR (
            (
                -- Option 1: Linked to providers (provider_descriptions_junction junction table means it's used)
                EXISTS (
                    SELECT 1 FROM provider_descriptions_junction pd
                    WHERE pd.description_id = d.id
                )
                OR
                -- Option 2: Linked to same group with generated=true
                (
                    d.generated = true
                    AND EXISTS (
                        SELECT 1 FROM calls_entry c
                        JOIN runs_entry r ON r.id = c.run_id
                        WHERE c.id IN (SELECT call_id FROM descriptions_calls_connection WHERE descriptions_id = d.id)
                          AND r.group_id = dgd.group_id
                    )
                )
            )
            AND d.description IS NOT NULL
            AND d.description != ''
        )
    ORDER BY d.description
),
-- Agent selection CTEs (inline agent selection logic)
name_agent_data AS (
    SELECT 
        a.id as agent_id
    FROM params x
    CROSS JOIN tools_existence_check tec
    LEFT JOIN LATERAL (
        SELECT a.id
        FROM agent_artifact a
        WHERE EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id
              AND rt.resource = 'names'::resource_type
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        )
        AND (
            x.mcp = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f ON af_mcp.flag_id = f.id WHERE af_mcp.agent_id = a.id
                  AND f.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
        ORDER BY a.updated_at DESC, a.id ASC
        LIMIT 1
    ) a ON tec.names_has_tools
    LIMIT 1
),
description_agent_data AS (
    SELECT 
        a.id as agent_id
    FROM params x
    CROSS JOIN tools_existence_check tec
    LEFT JOIN LATERAL (
        SELECT a.id
        FROM agent_artifact a
        WHERE EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id
              AND rt.resource = 'descriptions'::resource_type
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        )
        AND (
            x.mcp = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f ON af_mcp.flag_id = f.id WHERE af_mcp.agent_id = a.id
                  AND f.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
        ORDER BY a.updated_at DESC, a.id ASC
        LIMIT 1
    ) a ON tec.descriptions_has_tools
    LIMIT 1
),
flag_agent_data AS (
    SELECT 
        a.id as agent_id
    FROM params x
    CROSS JOIN tools_existence_check tec
    LEFT JOIN LATERAL (
        SELECT a.id
        FROM agent_artifact a
        WHERE EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id
              AND rt.resource = 'flags'::resource_type
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        )
        AND (
            x.mcp = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f ON af_mcp.flag_id = f.id WHERE af_mcp.agent_id = a.id
                  AND f.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
        ORDER BY a.updated_at DESC, a.id ASC
        LIMIT 1
    ) a ON tec.flags_has_tools
    LIMIT 1
)
SELECT 
    -- Required fields (first 5)
    up.actor_name,
    pec.provider_exists,
    CASE 
        WHEN up.role IN ('admin'::profile_type, 'superadmin'::profile_type) THEN true
        WHEN array_length(mtc.missing_resources, 1) > 0 THEN false
        ELSE true
    END as can_edit,
    CASE 
        WHEN array_length(mtc.missing_resources, 1) > 0 THEN
            'No tool configured for ' || array_to_string(mtc.missing_resources, ', ') || '. Therefore we cannot proceed ahead.'
        ELSE NULL
    END as disabled_reason,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    dgd.group_id,
    -- Single-select resources: name
    nrd.name_id,
    COALESCE(nrd.name_resource, ROW(NULL::uuid, NULL::text, false::boolean)::types.q_get_provider_v4_name_resource) as name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_name
    END as show_name,
    (SELECT agent_id FROM name_agent_data) as name_agent_id,
    true as name_required,  -- Name is required
    nsd.name_suggestions,
    nso.names,
    -- Single-select resources: description
    drd.description_id,
    COALESCE(drd.description_resource, ROW(NULL::uuid, NULL::text, false::boolean)::types.q_get_provider_v4_description_resource) as description_resource,
    CASE 
        WHEN NOT tec.descriptions_has_tools THEN false
        ELSE uf.show_description
    END as show_description,
    (SELECT agent_id FROM description_agent_data) as description_agent_id,
    false as description_required,  -- Description is optional
    dsd.description_suggestions,
    dso.descriptions,
    -- Single-select resources: flag
    frd.active_flag_id,
    COALESCE(frd.flag_resource, ROW(NULL::uuid, NULL::text, NULL::text, NULL::uuid, false::boolean)::types.q_get_provider_v4_flag_resource) as flag_resource,
    CASE 
        WHEN NOT tec.flags_has_tools THEN false
        ELSE uf.show_flag
    END as show_flag,
    (SELECT agent_id FROM flag_agent_data) as flag_agent_id,
    false as flag_required,  -- Flag is optional
    COALESCE(
        (SELECT ARRAY_AGG(
            (f.id, f.name, f.description, f.icon_id, f.generated)::types.q_get_provider_v4_flag_resource
            ORDER BY f.name
        ) FROM flags_data f),
        '{}'::types.q_get_provider_v4_flag_resource[]
    ) as flags
FROM params x
CROSS JOIN provider_exists_check pec
CROSS JOIN draft_group_data dgd
CROSS JOIN draft_version_data dvd
CROSS JOIN user_profile up
CROSS JOIN tools_existence_check tec
CROSS JOIN missing_tools_check mtc
CROSS JOIN ui_flags uf
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_suggestions_data dsd
CROSS JOIN names_suggestions_objects nso
CROSS JOIN descriptions_suggestions_objects dso
LEFT JOIN name_resource_data nrd ON TRUE
LEFT JOIN description_resource_data drd ON TRUE
LEFT JOIN flag_resource_data frd ON TRUE
$$;
