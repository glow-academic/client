-- Unified get auth function - handles both new (auth_id = NULL) and detail (auth_id provided)
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
        WHERE proname = 'api_get_auth_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_auth_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_auth_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_auth_v4_protocol AS (
    id uuid,
    value text,
    generated boolean
);

CREATE TYPE types.q_get_auth_v4_slug AS (
    id uuid,
    value text,
    generated boolean
);

CREATE TYPE types.q_get_auth_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_auth_v4_description_resource AS (
    id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_auth_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon text,
    generated boolean
);

CREATE TYPE types.q_get_auth_v4_auth_item AS (
    auth_item_id uuid,
    name text,
    description text,
    position integer,
    active boolean,
    value_masked text,
    key_id text,
    encrypted boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_auth_v4(
    profile_id uuid,
    auth_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false,
    draft_group_id uuid DEFAULT NULL,
    draft_version int DEFAULT NULL
)
RETURNS TABLE (
    -- Required fields (first 5)
    auth_exists boolean,
    can_edit boolean,
    disabled_reason text,
    group_id uuid,
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_auth_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_auth_v4_name_resource[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_auth_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_auth_v4_description_resource[],
    -- Single-select resources: flag
    active_flag_id uuid,
    flag_resource types.q_get_auth_v4_flag_resource,
    show_flag boolean,
    flag_agent_id uuid,
    flag_required boolean,
    flag_suggestions uuid[],
    -- Multi-select resources: protocols
    protocol_ids uuid[],
    protocol_resources types.q_get_auth_v4_protocol[],
    show_protocols boolean,
    protocols_agent_id uuid,
    protocols_required boolean,
    protocol_suggestions uuid[],
    protocols types.q_get_auth_v4_protocol[],
    -- Multi-select resources: slugs
    slug_ids uuid[],
    slug_resources types.q_get_auth_v4_slug[],
    show_slugs boolean,
    slugs_agent_id uuid,
    slugs_required boolean,
    slug_suggestions uuid[],
    slugs types.q_get_auth_v4_slug[],
    -- Special handling: auth_items_junction
    auth_items_junction types.q_get_auth_v4_auth_item[],
    auth_item_ids jsonb,
    auth_item_active_states jsonb,
    auth_item_encrypted_states jsonb,
    draft_version int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        auth_id AS auth_id,
        profile_id AS profile_id,
        draft_id AS draft_id,
        COALESCE(mcp, false) AS mcp
),
-- Convert auths_resource.id to auth_artifact.id (junction tables reference auth_artifact.id)
-- Use auth_auths_junction to link auths_resource to auth_artifact
auth_artifact_id_lookup AS (
    SELECT
        CASE
            WHEN (SELECT auth_id FROM params) IS NULL THEN NULL::uuid
            ELSE COALESCE(
                (SELECT aaj.auth_id FROM auths_resource ar JOIN auth_auths_junction aaj ON aaj.auths_id = ar.id WHERE ar.id = (SELECT auth_id FROM params)),
                (SELECT auth_id FROM params)  -- Fallback: assume it's already auth_artifact.id if not found in resource table
            )
        END as auth_artifact_id
),
-- Conditional: Only check auth existence if auth_id provided
auth_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT auth_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM auths_resource WHERE id = (SELECT auth_id FROM params))::boolean
        END as auth_exists
),
-- Draft data is now stored in draft_* junction tables, not in payload
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload
    FROM params x
    WHERE x.draft_id IS NOT NULL
    LIMIT 1
),
-- Get group_id from draft (should always exist after migration, but handle NULL case)
draft_group_data AS (
    SELECT
        COALESCE(
            draft_group_id,
            (SELECT id FROM groups_entry ORDER BY created_at DESC LIMIT 1)
        ) as group_id
),
-- User context: actor_name comes from get_profile_context_internal() in Python
user_profile AS (
    SELECT COALESCE(r.role, 'member'::profile_type) as role,
           ''::text as actor_name
    FROM profile_roles_junction prj
    JOIN roles_resource r ON prj.role_id = r.id
    WHERE prj.profile_id = (SELECT profile_id FROM params)
    LIMIT 1
),
-- Resource data CTEs - query from auth_* tables or draft_* tables if draft_id provided
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dn.names_id FROM auth_drafts_names_connection dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT an.name_id FROM auth_names_junction an WHERE an.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup) LIMIT 1)
        ) as name_id,
        (
            SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_auth_v4_name_resource 
            FROM (
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 1 as priority
                FROM auth_drafts_names_connection dn 
                JOIN names_resource n ON dn.names_id = n.id 
                WHERE dn.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 2 as priority
                FROM auth_names_junction an 
                JOIN names_resource n ON an.name_id = n.id 
                WHERE an.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup)
            ) n
            ORDER BY priority
            LIMIT 1
        ) as name_resource
    FROM params
),
description_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dd.descriptions_id FROM auth_drafts_descriptions_connection dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT ad.description_id FROM auth_descriptions_junction ad WHERE ad.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup) LIMIT 1)
        ) as description_id,
        (
            SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_auth_v4_description_resource 
            FROM (
                SELECT d.id, d.description, COALESCE(d.generated, false) as generated, 1 as priority
                FROM auth_drafts_descriptions_connection dd 
                JOIN descriptions_resource d ON dd.descriptions_id = d.id 
                WHERE dd.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT d.id, d.description, COALESCE(d.generated, false) as generated, 2 as priority
                FROM auth_descriptions_junction ad 
                JOIN descriptions_resource d ON ad.description_id = d.id 
                WHERE ad.auth_id = (SELECT auth_id FROM params)
            ) d
            ORDER BY priority
            LIMIT 1
        ) as description_resource
    FROM params
),
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id FROM auth_drafts_flags_connection df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT af.flag_id FROM auth_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup) AND f.name = 'auth_active' AND af.value = TRUE LIMIT 1)
        ) as active_flag_id,
        (
            SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_auth_v4_flag_resource 
            FROM (
                SELECT f.id, f.name, f.description, f.icon, COALESCE(f.generated, false) as generated, 1 as priority
                FROM auth_drafts_flags_connection df 
                JOIN flags_resource f ON df.flags_id = f.id 
                WHERE df.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT f.id, f.name, f.description, f.icon, COALESCE(f.generated, false) as generated, 2 as priority
                FROM auth_flags_junction af 
                JOIN flags_resource f ON af.flag_id = f.id 
                JOIN flags_resource fl ON af.flag_id = fl.id 
                WHERE af.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup) AND fl.name = 'active' AND f.name = 'auth_active' AND af.value = TRUE
            ) f
            ORDER BY priority
            LIMIT 1
        ) as flag_resource
    FROM params
),
-- Protocol IDs (selected protocol IDs for auth)
protocol_ids_data AS (
    SELECT 
        COALESCE(
            CASE 
                WHEN (SELECT auth_id FROM params) IS NULL THEN ARRAY[]::uuid[]
                ELSE (
                    SELECT ARRAY_AGG(ap.protocol_id ORDER BY ap.created_at)
                    FROM auth_protocols_junction ap
                    WHERE ap.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup)
                )
            END,
            ARRAY[]::uuid[]
        ) as protocol_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Slug IDs (selected slug IDs for auth)
slug_ids_data AS (
    SELECT 
        COALESCE(
            CASE 
                WHEN (SELECT auth_id FROM params) IS NULL THEN ARRAY[]::uuid[]
                ELSE (
                    SELECT ARRAY_AGG(as_j.slug_id ORDER BY as_j.created_at)
                    FROM auth_slugs_junction as_j
                    WHERE as_j.auth_id = (SELECT auth_artifact_id FROM auth_artifact_id_lookup)
                )
            END,
            ARRAY[]::uuid[]
        ) as slug_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Protocol mapping (for protocols array - all available protocols)
protocol_mapping_data AS (
    SELECT 
        p.id,
        p.value,
        COALESCE(p.generated, false) as generated
    FROM protocols_resource p
    CROSS JOIN params x
    WHERE p.id IS NOT NULL
    ORDER BY p.value
),
-- Slug mapping (for slugs array - all available slugs)
slug_mapping_data AS (
    SELECT 
        s.id,
        s.value,
        COALESCE(s.generated, false) as generated
    FROM slugs_resource s
    CROSS JOIN params x
    WHERE s.id IS NOT NULL
    ORDER BY s.value
),
-- Name suggestions: linked to auths OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(an.name_id ORDER BY an.created_at DESC)
             FROM (
                 SELECT DISTINCT an.name_id, MAX(an.created_at) as created_at
                 FROM auth_names_junction an
                 JOIN names_resource n ON n.id = an.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE an.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to auths (auth_names_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       n.generated = false
                       OR
                       (
                           n.generated = true
                       )
                   )
                 GROUP BY an.name_id
                 ORDER BY MAX(an.created_at) DESC
                 LIMIT 20
             ) an),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Description suggestions: linked to auths OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(ad.description_id ORDER BY ad.created_at DESC)
             FROM (
                 SELECT DISTINCT ad.description_id, MAX(ad.created_at) as created_at
                 FROM auth_descriptions_junction ad
                 JOIN descriptions_resource d ON d.id = ad.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE ad.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       -- Option 1: Linked to auths (auth_descriptions_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       d.generated = false
                       OR
                       (
                           d.generated = true
                       )
                   )
                 GROUP BY ad.description_id
                 ORDER BY MAX(ad.created_at) DESC
                 LIMIT 20
             ) ad),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Protocol suggestions: linked to auths OR same group with generated=true
protocol_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(ap.protocol_id ORDER BY ap.created_at DESC)
             FROM (
                 SELECT DISTINCT ap.protocol_id, MAX(ap.created_at) as created_at
                 FROM auth_protocols_junction ap
                 JOIN protocols_resource p ON p.id = ap.protocol_id
                 CROSS JOIN draft_group_data dgd
                 WHERE ap.protocol_id IS NOT NULL
                   AND p.value IS NOT NULL
                   AND p.value != ''
                   AND (
                       -- Option 1: Linked to auths (auth_protocols_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       p.generated = false
                       OR
                       (
                           p.generated = true
                       )
                   )
                 GROUP BY ap.protocol_id
                 ORDER BY MAX(ap.created_at) DESC
                 LIMIT 20
             ) ap),
            ARRAY[]::uuid[]
        ) as protocol_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Slug suggestions: linked to auths OR same group with generated=true
slug_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(as_j.slug_id ORDER BY as_j.created_at DESC)
             FROM (
                 SELECT DISTINCT as_j.slug_id, MAX(as_j.created_at) as created_at
                 FROM auth_slugs_junction as_j
                 JOIN slugs_resource s ON s.id = as_j.slug_id
                 CROSS JOIN draft_group_data dgd
                 WHERE as_j.slug_id IS NOT NULL
                   AND s.value IS NOT NULL
                   AND s.value != ''
                   AND (
                       -- Option 1: Linked to auths (auth_slugs_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       s.generated = false
                       OR
                       (
                           s.generated = true
                       )
                   )
                 GROUP BY as_j.slug_id
                 ORDER BY MAX(as_j.created_at) DESC
                 LIMIT 20
             ) as_j),
            ARRAY[]::uuid[]
        ) as slug_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Flag suggestions: linked to auths OR same group with generated=true
flag_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(af.flag_id ORDER BY af.created_at DESC)
             FROM (
                 SELECT DISTINCT af.flag_id, MAX(af.created_at) as created_at
                 FROM auth_flags_junction af
                 JOIN flags_resource f ON f.id = af.flag_id
                 JOIN flags_resource fl ON af.flag_id = fl.id
                 CROSS JOIN draft_group_data dgd
                 WHERE af.flag_id IS NOT NULL
                   AND fl.name = 'active'
                   AND f.name = 'auth_active'
                   AND (
                       -- Option 1: Linked to auths (auth_flags_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       f.generated = false
                       OR
                       (
                           f.generated = true
                       )
                   )
                 GROUP BY af.flag_id
                 ORDER BY MAX(af.created_at) DESC
                 LIMIT 20
             ) af),
            ARRAY[]::uuid[]
        ) as flag_suggestions
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
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_auth_v4_name_resource
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_auth_v4_name_resource[]
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
                    (d.id, d.description, COALESCE(d.generated, false))::types.q_get_auth_v4_description_resource
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_auth_v4_description_resource[]
        ) as descriptions
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
-- Descriptions: suggested options only (like names) - linked to auths OR same group with generated=true
-- Note: This is used for the descriptions array which should only show suggested options, not all available
-- Note: We don't actually need this CTE anymore since we use descriptions_suggestions_objects directly
-- Flags (all available flag options)
flags_data AS (
    SELECT DISTINCT
        f.id,
        f.name,
        f.description,
        f.icon,
        COALESCE(f.generated, false) as generated
    FROM flags_resource f
    CROSS JOIN params p
    WHERE 
        -- Always include selected active_flag_id if it exists
        f.id = (SELECT active_flag_id FROM flag_resource_data)
        OR (SELECT active_flag_id FROM flag_resource_data) IS NULL
    ORDER BY f.name
),
-- Auth items data (special handling - not a standard resource)
auth_items_data AS (
    SELECT 
        i.id as auth_item_id,
        i.name,
        i.description,
        i.position,
        i.active,
        i.encrypted,
        NULL::text as key_id,
        CASE 
            WHEN i.encrypted THEN '****'::text
            ELSE ''::text
        END as value_masked
    FROM params x
    CROSS JOIN auth_artifact_id_lookup aail
    LEFT JOIN auth_items_junction ai_j ON ai_j.auth_id = aail.auth_artifact_id AND aail.auth_artifact_id IS NOT NULL
    LEFT JOIN items_resource i ON i.id = ai_j.item_id
    WHERE x.auth_id IS NOT NULL AND aail.auth_artifact_id IS NOT NULL AND i.id IS NOT NULL
    ORDER BY i.position
),
-- Agent selection helper CTEs (shared across all agent selections)
-- For auth, we don't have departments, so use profile primary department or NULL
profile_primary_department_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
    LIMIT 1
),
selected_department_for_agents AS (
    SELECT 
        (SELECT department_id FROM profile_primary_department_for_agents) as department_id
),
user_departments_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments_junction pd ON pd.profile_id = p.profile_id AND pd.active = true
),
agent_artifact_tool_counts AS (
    SELECT
        a.id as agent_id,
        COUNT(DISTINCT CASE WHEN ar.resource IS NOT NULL THEN rt.resource::text END) as matched_artifact_count,
        COUNT(DISTINCT CASE WHEN ar.resource IS NULL THEN rt.resource::text END) as extra_outside_count
    FROM agent_artifact a
    LEFT JOIN agent_tools_junction at ON at.agent_id = a.id AND at.active = true
    LEFT JOIN tools_resource tr ON tr.id = at.tool_id
    LEFT JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    LEFT JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (
        SELECT 1 FROM tool_flags_junction tf
        JOIN flags_resource f ON tf.flag_id = f.id
        WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true
    )
    LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
    LEFT JOIN artifact_resources_relation ar ON ar.resource = rt.resource AND ar.artifact = 'auth'::artifact_type
    GROUP BY a.id
),

-- Agent selection for 'names' resource
name_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'names'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'descriptions' resource
description_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'descriptions'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'flags' resource
flag_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'flags'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'protocols' resource
protocols_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'protocols'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'slugs' resource
slugs_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments_junction ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools_junction at
            JOIN tools_resource tr ON tr.id = at.tool_id
            JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
            JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'slugs'::resource_type
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags_junction af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments_junction ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- UI flags
ui_flags AS (
    SELECT 
        -- Single-select resource flags (based on whether options exist)
        true as show_name,  -- Always show name picker
        true as show_description,  -- Always show description picker
        true as show_flag,  -- Flag is a boolean toggle that should be shown
        -- Multi-select resource flags (based on business logic)
        CASE 
            WHEN (SELECT COUNT(*) FROM protocol_mapping_data) > 0 THEN true
            ELSE false
        END as show_protocols,
        CASE 
            WHEN (SELECT COUNT(*) FROM slug_mapping_data) > 0 THEN true
            ELSE false
        END as show_slugs
    FROM params x
    CROSS JOIN user_profile up
),
-- Check for missing tools on required resources (after all agent selection CTEs and ui_flags)
-- IMPORTANT: We check for TOOLS existence (not agents). Tools are required, agents are optional.
-- If no tools exist for a resource, we error. If tools exist but no agent exists, that's fine (manual entry).
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
            WHERE rt.resource = 'protocols'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as protocols_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'slugs'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as slugs_has_tools
    FROM params x
),
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            -- Check if tools exist (not agents). Error only if NO tools exist.
            CASE WHEN NOT tec.names_has_tools THEN 'name' ELSE NULL END,
            CASE WHEN NOT tec.protocols_has_tools AND uf.show_protocols THEN 'protocols' ELSE NULL END,
            CASE WHEN NOT tec.slugs_has_tools AND uf.show_slugs THEN 'slugs' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM params x
    CROSS JOIN ui_flags uf
    CROSS JOIN tools_existence_check tec
),
permissions_data_with_tools AS (
    SELECT 
        CASE 
            WHEN (SELECT auth_id FROM params) IS NULL THEN
                -- New mode permissions
                CASE 
                    WHEN up.role IN ('admin'::profile_type, 'superadmin'::profile_type) THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode permissions
                CASE 
                    WHEN up.role IN ('admin'::profile_type, 'superadmin'::profile_type) THEN true
                    ELSE false
                END
        END as base_can_edit,
        CASE 
            WHEN (SELECT auth_id FROM params) IS NULL THEN
                -- New mode: always editable if can_edit is true
                NULL::text
            ELSE
                -- Detail mode: compute disabled_reason
                CASE 
                    WHEN up.role IN ('admin'::profile_type, 'superadmin'::profile_type) THEN 
                        NULL::text
                    ELSE 
                        'This auth entry cannot be edited. You can view the details but cannot make changes.'::text
                END
        END as base_disabled_reason
    FROM params x
    CROSS JOIN user_profile up
),
permissions_final AS (
    SELECT 
        mtc.missing_resources,
        CASE 
            WHEN array_length(mtc.missing_resources, 1) > 0 THEN false
            ELSE pd.base_can_edit
        END as can_edit,
        CASE 
            WHEN array_length(mtc.missing_resources, 1) > 0 THEN
                'No tool configured for ' || 
                array_to_string(mtc.missing_resources, ', ') || 
                '. Therefore we cannot proceed ahead.'::text
            ELSE pd.base_disabled_reason
        END as disabled_reason
    FROM permissions_data_with_tools pd
    CROSS JOIN missing_tools_check mtc
)
SELECT
    -- Required fields (first 5)
    (SELECT auth_exists FROM auth_exists_check) as auth_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    dgd.group_id,
    -- Single-select resources: name
    (SELECT name_id FROM name_resource_data) as name_id,
    nrd.name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_name
    END as show_name,
    (SELECT agent_id FROM name_agent_data) as name_agent_id,
    true as name_required,
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    COALESCE((SELECT names FROM names_suggestions_objects), ARRAY[]::types.q_get_auth_v4_name_resource[]) as names,
    -- Single-select resources: description
    (SELECT description_id FROM description_resource_data) as description_id,
    drd.description_resource,
    uf.show_description,
    (SELECT agent_id FROM description_agent_data) as description_agent_id,
    false as description_required,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE((SELECT descriptions FROM descriptions_suggestions_objects), ARRAY[]::types.q_get_auth_v4_description_resource[]) as descriptions,
    -- Single-select resources: flag
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    frd.flag_resource,
    uf.show_flag,
    (SELECT agent_id FROM flag_agent_data) as flag_agent_id,
    false as flag_required,
    COALESCE((SELECT flag_suggestions FROM flag_suggestions_data), ARRAY[]::uuid[]) as flag_suggestions,
    -- Multi-select resources: protocols
    pid.protocol_ids,
    -- Protocol resources (selected protocols filtered by protocol_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (pmd.id, pmd.value, pmd.generated)::types.q_get_auth_v4_protocol
            ORDER BY pmd.value
        )
        FROM protocol_mapping_data pmd
        WHERE pmd.id IS NOT NULL AND pmd.id = ANY(pid.protocol_ids)),
        '{}'::types.q_get_auth_v4_protocol[]
    ) as protocol_resources,
    CASE 
        WHEN NOT tec.protocols_has_tools AND uf.show_protocols THEN false
        WHEN EXISTS (SELECT 1 FROM protocol_mapping_data LIMIT 1) THEN true
        ELSE uf.show_protocols
    END as show_protocols,
    (SELECT agent_id FROM protocols_agent_data) as protocols_agent_id,
    CASE 
        WHEN uf.show_protocols THEN true
        ELSE false
    END as protocols_required,
    COALESCE((SELECT protocol_suggestions FROM protocol_suggestions_data), ARRAY[]::uuid[]) as protocol_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (pmd.id, pmd.value, pmd.generated)::types.q_get_auth_v4_protocol
            ORDER BY pmd.value
        ) FROM protocol_mapping_data pmd WHERE pmd.id IS NOT NULL),
        '{}'::types.q_get_auth_v4_protocol[]
    ) as protocols,
    -- Multi-select resources: slugs
    sid.slug_ids,
    -- Slug resources (selected slugs filtered by slug_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (smd.id, smd.value, smd.generated)::types.q_get_auth_v4_slug
            ORDER BY smd.value
        )
        FROM slug_mapping_data smd
        WHERE smd.id IS NOT NULL AND smd.id = ANY(sid.slug_ids)),
        '{}'::types.q_get_auth_v4_slug[]
    ) as slug_resources,
    CASE 
        WHEN NOT tec.slugs_has_tools AND uf.show_slugs THEN false
        WHEN EXISTS (SELECT 1 FROM slug_mapping_data LIMIT 1) THEN true
        ELSE uf.show_slugs
    END as show_slugs,
    (SELECT agent_id FROM slugs_agent_data) as slugs_agent_id,
    CASE 
        WHEN uf.show_slugs THEN true
        ELSE false
    END as slugs_required,
    COALESCE((SELECT slug_suggestions FROM slug_suggestions_data), ARRAY[]::uuid[]) as slug_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (smd.id, smd.value, smd.generated)::types.q_get_auth_v4_slug
            ORDER BY smd.value
        ) FROM slug_mapping_data smd WHERE smd.id IS NOT NULL),
        '{}'::types.q_get_auth_v4_slug[]
    ) as slugs,
    -- Special handling: auth_items_junction
    COALESCE(
        (SELECT ARRAY_AGG(
            (aid.auth_item_id, aid.name, aid.description, aid.position, aid.active, aid.value_masked, aid.key_id, aid.encrypted)::types.q_get_auth_v4_auth_item
            ORDER BY aid.position
        ) FROM auth_items_data aid WHERE aid.auth_item_id IS NOT NULL),
        '{}'::types.q_get_auth_v4_auth_item[]
    ) as auth_items_junction,
    -- Extract auth_item_ids from draft payload if available, otherwise extract from auth_items_junction array
    COALESCE(
        (SELECT payload->'authItemIds' FROM draft_payload_data),
        (SELECT payload->'auth_item_ids' FROM draft_payload_data),
        (SELECT COALESCE(jsonb_agg(aid.auth_item_id::text ORDER BY aid.position), '[]'::jsonb) FROM auth_items_data aid),
        '[]'::jsonb
    ) as auth_item_ids,
    -- Extract auth_item_active_states from draft payload if available, otherwise extract from auth_items_junction array
    COALESCE(
        (SELECT payload->'authItemActiveStates' FROM draft_payload_data),
        (SELECT payload->'auth_item_active_states' FROM draft_payload_data),
        (SELECT COALESCE(jsonb_object_agg(aid.auth_item_id::text, aid.active), '{}'::jsonb) FROM auth_items_data aid),
        '{}'::jsonb
    ) as auth_item_active_states,
    -- Extract auth_item_encrypted_states from draft payload if available, otherwise extract from auth_items_junction array
    COALESCE(
        (SELECT payload->'authItemEncryptedStates' FROM draft_payload_data),
        (SELECT payload->'auth_item_encrypted_states' FROM draft_payload_data),
        (SELECT COALESCE(jsonb_object_agg(aid.auth_item_id::text, aid.encrypted), '{}'::jsonb) FROM auth_items_data aid),
        '{}'::jsonb
    ) as auth_item_encrypted_states,
    COALESCE(draft_version, 0) as draft_version
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
CROSS JOIN draft_group_data dgd
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN flag_resource_data frd
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_suggestions_data dsd
CROSS JOIN names_suggestions_objects nso
CROSS JOIN descriptions_suggestions_objects dso
CROSS JOIN protocol_ids_data pid
CROSS JOIN slug_ids_data sid
CROSS JOIN protocol_suggestions_data psd
CROSS JOIN slug_suggestions_data ssd
LEFT JOIN auth_items_data aid ON aid.auth_item_id IS NOT NULL
GROUP BY 
    up.actor_name,
    perm_final.can_edit,
    perm_final.disabled_reason,
    dgd.group_id,
    nrd.name_id,
    nrd.name_resource,
    uf.show_name,
    uf.show_description,
    uf.show_flag,
    uf.show_protocols,
    uf.show_slugs,
    tec.names_has_tools,
    tec.protocols_has_tools,
    tec.slugs_has_tools,
    drd.description_id,
    drd.description_resource,
    frd.active_flag_id,
    frd.flag_resource,
    pid.protocol_ids,
    sid.slug_ids
$$;

