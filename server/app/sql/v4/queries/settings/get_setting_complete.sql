-- Unified get setting function - handles both new (setting_id = NULL) and detail (setting_id provided)
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
        WHERE proname = 'api_get_setting_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_setting_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop in reverse dependency order: parent types first (that depend on child types), then child types
-- q_get_setting_v4_auth depends on q_get_setting_v4_auth_item[], so drop auth first
DO $$
DECLARE
    r RECORD;
    type_order text[] := ARRAY[
        'q_get_setting_v4_auth',  -- Parent type that depends on auth_item
        'q_get_setting_v4_auth_item',  -- Child type (no dependencies)
        'q_get_setting_v4_department',
        'q_get_setting_v4_provider',
        'q_get_setting_v4_key',
        'q_get_setting_v4_name_resource',
        'q_get_setting_v4_color_resource',
        'q_get_setting_v4_flag_resource',
        'q_get_setting_v4_description_resource',
        'q_get_setting_v4_color_option',
        'q_get_setting_v4_role_resource',
        'q_get_setting_v4_route_resource',
        'q_get_setting_v4_role_route'
    ];
    type_name text;
BEGIN
    -- Drop in reverse dependency order (parents before children)
    FOREACH type_name IN ARRAY type_order
    LOOP
        BEGIN
            EXECUTE format('DROP TYPE IF EXISTS types.%I', type_name);
        EXCEPTION WHEN OTHERS THEN
            -- Type might not exist or have other dependencies, skip it
            NULL;
        END;
    END LOOP;
    
    -- Drop any remaining types matching the pattern (safety net)
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_setting_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        BEGIN
            EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
        EXCEPTION WHEN OTHERS THEN
            -- Type might have dependencies, skip it
            NULL;
        END;
    END LOOP;
END $$;

-- 3) Recreate types
-- Create child types first (before parent types that reference them)
CREATE TYPE types.q_get_setting_v4_auth_item AS (
    id uuid,
    name text,
    description text,
    encrypted boolean
);

CREATE TYPE types.q_get_setting_v4_department AS (
    department_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_setting_v4_profile AS (
    profile_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_setting_v4_auth AS (
    auth_id uuid,
    name text,
    description text,
    slug text,
    active boolean,
    auth_items_junction types.q_get_setting_v4_auth_item[]
);

CREATE TYPE types.q_get_setting_v4_provider AS (
    provider_id uuid,
    name text,
    description text,
    value text,
    active boolean
);

CREATE TYPE types.q_get_setting_v4_key AS (
    key_id uuid,
    name text,
    masked_key text,
    description text,
    active boolean,
    department_ids text[]
);

CREATE TYPE types.q_get_setting_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_setting_v4_color_resource AS (
    id uuid,
    name text,
    description text,
    hex_code text,
    generated boolean
);

CREATE TYPE types.q_get_setting_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon text,
    generated boolean
);

CREATE TYPE types.q_get_setting_v4_description_resource AS (
    id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_setting_v4_color_option AS (
    id uuid,
    name text,
    description text,
    hex_code text,
    generated boolean
);

CREATE TYPE types.q_get_setting_v4_role_resource AS (
    role_id uuid,
    role text,
    name text,
    description text,
    icon_value text,
    color_hex text,
    generated boolean
);

CREATE TYPE types.q_get_setting_v4_route_resource AS (
    route_id uuid,
    route text,
    role_id uuid,
    generated boolean
);

CREATE TYPE types.q_get_setting_v4_role_route AS (
    id uuid,
    role_id uuid,
    route_id uuid,
    generated boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_setting_v4(
    profile_id uuid,
    setting_id uuid DEFAULT NULL,
    color_search text DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    setting_exists boolean,
    can_edit boolean,
    disabled_reason text,
    draft_version int,
    -- Group ID for linking resources
    group_id uuid,
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_setting_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_setting_v4_name_resource[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_setting_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_setting_v4_description_resource[],
    -- Multi-select resources: colors (theme colors)
    color_ids uuid[],
    color_resources types.q_get_setting_v4_color_resource[],
    show_colors boolean,
    colors_agent_id uuid,
    colors_required boolean,
    color_suggestions uuid[],
    colors types.q_get_setting_v4_color_option[],
    -- Single-select resources: flag
    active_flag_id uuid,
    flag_resource types.q_get_setting_v4_flag_resource,
    show_flag boolean,
    flag_agent_id uuid,
    flag_required boolean,
    flags types.q_get_setting_v4_flag_resource[],
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_setting_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_setting_v4_department[],
    -- Multi-select resources: profiles
    profile_ids uuid[],
    profile_resources types.q_get_setting_v4_profile[],
    show_profiles boolean,
    profiles_agent_id uuid,
    profiles_required boolean,
    profile_suggestions uuid[],
    profiles types.q_get_setting_v4_profile[],
    -- Multi-select resources: auths
    auth_ids uuid[],
    auth_resources types.q_get_setting_v4_auth[],
    show_auths boolean,
    auths_agent_id uuid,
    auths_required boolean,
    auth_suggestions uuid[],
    auths types.q_get_setting_v4_auth[],
    -- Provider key IDs (denormalized from settings_resource)
    provider_key_ids uuid[],
    -- Multi-select resources: keys
    key_ids uuid[],
    key_resources types.q_get_setting_v4_key[],
    show_keys boolean,
    keys_agent_id uuid,
    keys_required boolean,
    key_suggestions uuid[],
    keys types.q_get_setting_v4_key[],
    -- Multi-select resources: roles
    role_ids uuid[],
    role_resources types.q_get_setting_v4_role_resource[],
    show_roles boolean,
    roles_required boolean,
    roles types.q_get_setting_v4_role_resource[],
    -- Multi-select resources: routes
    route_ids uuid[],
    route_resources types.q_get_setting_v4_route_resource[],
    show_routes boolean,
    routes_required boolean,
    routes types.q_get_setting_v4_route_resource[],
    -- Role-route junction resources
    role_route_ids uuid[],
    role_route_resources types.q_get_setting_v4_role_route[],
    show_role_routes boolean,
    role_routes types.q_get_setting_v4_role_route[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        setting_id AS setting_id,
        profile_id AS profile_id,
        color_search AS color_search,
        draft_id AS draft_id,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check setting existence if setting_id provided
setting_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT setting_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM setting_artifact WHERE id = (SELECT setting_id FROM params))::boolean
        END as setting_exists
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
            d.group_id,
            (SELECT id FROM view_groups_entry ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params x
    LEFT JOIN view_drafts_entry d ON d.id = x.draft_id
    -- Always return at least one row (use COALESCE to handle NULL draft_id case)
    WHERE TRUE
    LIMIT 1
),
draft_version_data AS (
    -- Keep draft_version for client-side expected_version sync to avoid unintended draft forks.
    SELECT d.version as draft_version
    FROM params x
    LEFT JOIN view_drafts_entry d ON d.id = x.draft_id
    WHERE TRUE
    LIMIT 1
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
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Conditional: Get setting department data only if setting_id provided
-- Use department_settings_junction table (reverse direction: settings_id -> department_id)
setting_departments_data AS (
    SELECT 
        ds.settings_id as setting_id,
        ARRAY_AGG(ds.department_id ORDER BY ds.created_at) as department_ids
    FROM params x
    JOIN department_settings_junction ds ON ds.settings_id = x.setting_id AND ds.active = true
    WHERE x.setting_id IS NOT NULL
    GROUP BY ds.settings_id
),
setting_department_access_check AS (
    SELECT 
        s.id as setting_id,
        CASE 
            WHEN up.role = 'superadmin'::profile_type THEN true
            WHEN EXISTS (
                SELECT 1 FROM department_settings_junction ds 
                WHERE ds.settings_id = s.id 
                AND ds.active = true 
                AND ds.department_id IN (SELECT department_id FROM user_departments)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM department_settings_junction ds3 
                WHERE ds3.settings_id = s.id 
                AND ds3.active = true
            ) THEN true
            ELSE false
        END as has_access
    FROM params x
    JOIN setting_artifact s ON s.id = x.setting_id
    CROSS JOIN user_profile up
    WHERE x.setting_id IS NOT NULL
),
department_mapping_data AS (
    SELECT
        d.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = ddj.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = ddj.department_id LIMIT 1), '') as description,
        COALESCE(d.generated, false) as generated
    FROM params x
    CROSS JOIN user_profile up
    JOIN departments_resource d ON (
        -- Only include departments with active flag AND user is linked to them
        EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
        AND
        EXISTS (SELECT 1 FROM profile_departments_junction pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
    )
    JOIN department_departments_junction ddj ON ddj.departments_id = d.id
),
profile_mapping_data AS (
    SELECT
        p.id as profile_id,
        COALESCE(
            (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1) || ' ' ||
            (SELECT n2.name FROM profile_names_junction pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id LIMIT 1),
            ''
        ) as name,
        COALESCE(
            (SELECT r.name FROM profile_roles_junction pr JOIN roles_resource r ON pr.role_id = r.id WHERE pr.profile_id = p.id LIMIT 1),
            (SELECT r2.role::text FROM profile_roles_junction pr2 JOIN roles_resource r2 ON pr2.role_id = r2.id WHERE pr2.profile_id = p.id LIMIT 1),
            ''
        ) as description,
        false as generated
    FROM profile_artifact p
    WHERE EXISTS (
        SELECT 1
        FROM profile_flags_junction pf
        JOIN flags_resource f ON pf.flag_id = f.id
        WHERE pf.profile_id = p.id
          AND f.name = 'profile_active'
          AND pf.value = true
    )
),
primary_department_id_data AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.is_primary = TRUE
    LIMIT 1
),
-- Active departments for user (departments with active flag that user is linked to)
active_departments_data AS (
    SELECT ARRAY_AGG(DISTINCT d.id) as department_ids
    FROM params x
    JOIN departments_resource d ON EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
    WHERE EXISTS (SELECT 1 FROM profile_departments_junction pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
),
ui_flags AS (
    SELECT 
        -- Single-select resource flags (based on whether options exist)
        true as show_name,  -- Always show name picker
        true as show_description,  -- Always show description picker
        -- show_colors will be computed later using colors_data
        true as show_colors,  -- Will be updated in SELECT to check colors array
        true as show_flag,  -- Flag is a boolean toggle that should be shown
        -- Multi-select resource flags (based on business logic)
        CASE 
            WHEN (SELECT COUNT(*) FROM department_mapping_data) > 0 THEN true
            ELSE false
        END as show_departments,
        CASE
            WHEN (SELECT COUNT(*) FROM profile_mapping_data) > 0 THEN true
            ELSE false
        END as show_profiles,
        true as show_auths,  -- Always show auths picker
        true as show_providers,  -- Always show providers picker
        true as show_keys  -- Always show keys picker
    FROM params x
    CROSS JOIN user_profile up
),
-- Resource data CTEs - query from setting_* tables or draft_* tables if draft_id provided
-- NOTE: These must be defined BEFORE they are referenced in other CTEs
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dn.names_id FROM names_drafts_connection dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT sn.name_id FROM setting_names_junction sn WHERE sn.setting_id = (SELECT setting_id FROM params) LIMIT 1)
        ) as name_id,
        (SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_setting_v4_name_resource FROM names_drafts_connection dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_name_resource,
        (SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_setting_v4_name_resource FROM setting_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.setting_id = (SELECT setting_id FROM params) LIMIT 1) as setting_name_resource
    FROM params
),
description_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dd.descriptions_id FROM descriptions_drafts_connection dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT sd.description_id FROM setting_descriptions_junction sd WHERE sd.setting_id = (SELECT setting_id FROM params) LIMIT 1)
        ) as description_id,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_setting_v4_description_resource FROM descriptions_drafts_connection dd JOIN descriptions_resource d ON dd.descriptions_id = d.id WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_description_resource,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_setting_v4_description_resource FROM setting_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.setting_id = (SELECT setting_id FROM params) LIMIT 1) as setting_description_resource
    FROM params
),
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id FROM flags_drafts_connection df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT sf.flag_id FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = (SELECT setting_id FROM params) AND f.name = 'setting_active' AND sf.value = TRUE LIMIT 1)
        ) as active_flag_id,
        (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_setting_v4_flag_resource FROM flags_drafts_connection df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_flag_resource,
        (SELECT ROW(f.id, f.name, f.description, f.icon, COALESCE(f.generated, false))::types.q_get_setting_v4_flag_resource FROM setting_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = (SELECT setting_id FROM params) AND f.name = 'setting_active' AND sf.value = TRUE LIMIT 1) as setting_flag_resource
    FROM params
),
-- Color resource data (multi-select for theme colors)
color_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(dc.colors_id ORDER BY dc.created_at)
             FROM colors_drafts_connection dc 
             WHERE dc.draft_id = (SELECT draft_id FROM params)),
            (SELECT ARRAY_AGG(sc.color_id ORDER BY sc.created_at)
             FROM setting_colors_junction sc 
             WHERE sc.setting_id = (SELECT setting_id FROM params))
        ) as color_ids,
        (SELECT ARRAY_AGG(ROW(c.id, c.name, c.description, c.hex_code, COALESCE(c.generated, false))::types.q_get_setting_v4_color_resource ORDER BY dc.created_at)
         FROM colors_drafts_connection dc 
         JOIN colors_resource c ON dc.colors_id = c.id 
         WHERE dc.draft_id = (SELECT draft_id FROM params)) as draft_color_resources,
        (SELECT ARRAY_AGG(ROW(c.id, c.name, c.description, c.hex_code, COALESCE(c.generated, false))::types.q_get_setting_v4_color_resource ORDER BY sc.created_at)
         FROM setting_colors_junction sc 
         JOIN colors_resource c ON sc.color_id = c.id 
         WHERE sc.setting_id = (SELECT setting_id FROM params)) as setting_color_resources
    FROM params
),
profile_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(dp.profiles_id ORDER BY dp.created_at)
             FROM profiles_drafts_connection dp
             WHERE dp.draft_id = (SELECT draft_id FROM params)),
            (SELECT ARRAY_AGG(sp.profile_id ORDER BY sp.created_at)
             FROM setting_profiles_junction sp
             WHERE sp.setting_id = (SELECT setting_id FROM params)
               AND sp.active = true)
        ) as profile_ids,
        (SELECT ARRAY_AGG(
            (pmd.profile_id, pmd.name, pmd.description, pmd.generated)::types.q_get_setting_v4_profile
            ORDER BY dp.created_at
        )
         FROM profiles_drafts_connection dp
         JOIN profile_mapping_data pmd ON pmd.profile_id = dp.profiles_id
         WHERE dp.draft_id = (SELECT draft_id FROM params)) as draft_profile_resources,
        (SELECT ARRAY_AGG(
            (pmd.profile_id, pmd.name, pmd.description, pmd.generated)::types.q_get_setting_v4_profile
            ORDER BY sp.created_at
        )
         FROM setting_profiles_junction sp
         JOIN profile_mapping_data pmd ON pmd.profile_id = sp.profile_id
         WHERE sp.setting_id = (SELECT setting_id FROM params)
           AND sp.active = true) as setting_profile_resources
    FROM params
),
-- Name suggestions: linked to settings OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(sn.name_id ORDER BY sn.created_at DESC)
             FROM (
                 SELECT DISTINCT sn.name_id, MAX(sn.created_at) as created_at
                 FROM setting_names_junction sn
                 JOIN names_resource n ON n.id = sn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE sn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to settings (setting_names_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       COALESCE(sn.generated, false) = false
                       OR
                       (
                           COALESCE(sn.generated, false) = true
                           AND COALESCE(n.generated, false) = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM names_calls_connection WHERE names_id = n.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY sn.name_id
                 ORDER BY MAX(sn.created_at) DESC
                 LIMIT 20
             ) sn),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Description suggestions: linked to settings OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(sd.description_id ORDER BY sd.created_at DESC)
             FROM (
                 SELECT DISTINCT sd.description_id, MAX(sd.created_at) as created_at
                 FROM setting_descriptions_junction sd
                 JOIN descriptions_resource d ON d.id = sd.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE sd.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       -- Option 1: Linked to settings (setting_descriptions_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       COALESCE(sd.generated, false) = false
                       OR
                       (
                           COALESCE(sd.generated, false) = true
                           AND COALESCE(d.generated, false) = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM descriptions_calls_connection WHERE descriptions_id = d.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY sd.description_id
                 ORDER BY MAX(sd.created_at) DESC
                 LIMIT 20
             ) sd),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Color suggestions: linked to settings OR same group with generated=true
color_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(sc.color_id ORDER BY sc.created_at DESC)
             FROM (
                 SELECT DISTINCT sc.color_id, MAX(sc.created_at) as created_at
                 FROM setting_colors_junction sc
                 JOIN colors_resource c ON c.id = sc.color_id
                 CROSS JOIN draft_group_data dgd
                 WHERE sc.color_id IS NOT NULL
                   AND (
                       -- Option 1: Linked to settings (setting_colors_junction junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       COALESCE(sc.generated, false) = false
                       OR
                       (
                           COALESCE(sc.generated, false) = true
                           AND COALESCE(c.generated, false) = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c2
                               JOIN view_runs_entry r ON r.id = c2.run_id
                               WHERE c2.id IN (SELECT call_id FROM colors_calls_connection WHERE colors_id = c.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY sc.color_id
                 ORDER BY MAX(sc.created_at) DESC
                 LIMIT 20
             ) sc),
            ARRAY[]::uuid[]
        ) as color_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Names: linked to settings with active=true OR same group with generated=true
names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_setting_v4_name_resource
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_setting_v4_name_resource[]
        ) as names
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Descriptions: linked to settings with active=true OR same group with generated=true
descriptions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (d.id, d.description, COALESCE(d.generated, false))::types.q_get_setting_v4_description_resource
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_setting_v4_description_resource[]
        ) as descriptions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Colors (all available color options)
colors_data AS (
    SELECT DISTINCT
        c.id,
        c.name,
        c.description,
        c.hex_code,
        COALESCE(c.generated, false) as generated,
        -- Add sort priority: suggested colors first (1), then others (2)
        CASE 
            WHEN c.id = ANY(csd.color_suggestions) THEN 1
            ELSE 2
        END as sort_priority
    FROM colors_resource c
    CROSS JOIN params p
    CROSS JOIN color_suggestions_data csd
    WHERE c.active = true
      AND (
        -- Always include selected color_ids if they exist
        c.id = ANY(COALESCE((SELECT color_ids FROM color_resource_data), ARRAY[]::uuid[]))
        OR (
            -- Search filter: if color_search provided, match name or hex_code
            (p.color_search IS NULL OR p.color_search = '' OR
             LOWER(c.name) LIKE '%' || LOWER(p.color_search) || '%' OR
             LOWER(c.hex_code) LIKE '%' || LOWER(p.color_search) || '%')
        )
      )
    ORDER BY sort_priority, c.name
    LIMIT 30  -- Multiple of 3 for nice grid layout
),
colors_agg AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (c.id, c.name, c.description, c.hex_code, c.generated)::types.q_get_setting_v4_color_option
                ORDER BY c.sort_priority, c.name
            ),
            '{}'::types.q_get_setting_v4_color_option[]
        ) AS colors,
        COUNT(*)::int AS colors_count
    FROM colors_data c
),
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
-- Department IDs (selected department IDs for setting)
-- Use department_settings_junction table (reverse direction: settings_id -> department_id)
setting_department_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT setting_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(ds.department_id ORDER BY ds.created_at)
                 FROM department_settings_junction ds
                 WHERE ds.settings_id = (SELECT setting_id FROM params)
                   AND ds.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Department suggestions: linked to settings OR same group with generated=true
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(ds.department_id ORDER BY ds.created_at DESC)
             FROM (
                 SELECT DISTINCT ds.department_id, MAX(ds.created_at) as created_at
                 FROM department_settings_junction ds
                 JOIN departments_resource d ON d.id = ds.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE ds.department_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
                   AND (
                       -- Option 1: Linked to settings with active=true
                       ds.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM descriptions_calls_connection WHERE descriptions_id = d.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY ds.department_id
                 ORDER BY MAX(ds.created_at) DESC
                 LIMIT 20
             ) ds),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
profile_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(sp.profile_id ORDER BY sp.created_at DESC)
             FROM setting_profiles_junction sp
             WHERE sp.active = true),
            ARRAY[]::uuid[]
        ) as profile_suggestions
    FROM params
    LIMIT 1
),
profiles_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (pmd.profile_id, pmd.name, pmd.description, pmd.generated)::types.q_get_setting_v4_profile
                ORDER BY pmd.name
            ),
            '{}'::types.q_get_setting_v4_profile[]
        ) as profiles
    FROM profile_mapping_data pmd
),
-- Auth IDs (selected auth IDs for setting)
setting_auth_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT setting_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(sa.auth_id ORDER BY sa.created_at)
                 FROM setting_auths_junction sa
                 WHERE sa.settings_id = (SELECT setting_id FROM params)
                   AND sa.active = true),
                ARRAY[]::uuid[]
            )
        END as auth_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Auth suggestions: linked to settings OR same group with generated=true
auth_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(sa.auth_id ORDER BY sa.created_at DESC)
             FROM (
                 SELECT DISTINCT sa.auth_id, MAX(sa.created_at) as created_at
                 FROM setting_auths_junction sa
                 JOIN auths_resource a ON a.id = sa.auth_id
                 CROSS JOIN draft_group_data dgd
                 WHERE sa.auth_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM auth_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'auth_active'
                         AND af.value = true
                   )
                   AND (
                       -- Option 1: Linked to settings with active=true
                       sa.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           COALESCE(sa.generated, false) = true
                           AND COALESCE(a.generated, false) = true
                           AND EXISTS (
                               SELECT 1 FROM view_calls_entry c
                               JOIN view_runs_entry r ON r.id = c.run_id
                               WHERE c.id IN (SELECT call_id FROM args_calls_connection WHERE args_id = a.id)
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY sa.auth_id
                 ORDER BY MAX(sa.created_at) DESC
                 LIMIT 20
             ) sa),
            ARRAY[]::uuid[]
        ) as auth_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Auth mapping data (all auths with nested auth_items_junction)
auth_mapping_data AS (
    SELECT DISTINCT
        a.id as auth_id,
        (SELECT n.name FROM auth_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM auth_descriptions_junction ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.auth_id = a.id LIMIT 1), '') as description,
        (SELECT s.value FROM auth_slugs_junction as_j JOIN slugs_resource s ON s.id = as_j.slug_id WHERE as_j.auth_id = a.id LIMIT 1) as slug,
        EXISTS (SELECT 1 FROM auth_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'auth_active' AND af.value = TRUE) AS active,
        COALESCE(
            ARRAY_AGG(
                (ai.id, ai.name, COALESCE(ai.description, ''), ai.encrypted)::types.q_get_setting_v4_auth_item
                ORDER BY ai.name
            ) FILTER (WHERE ai.id IS NOT NULL),
            '{}'::types.q_get_setting_v4_auth_item[]
        ) as auth_items_junction,
        COALESCE(a.generated, false) as generated
    FROM params x
    CROSS JOIN user_profile up
    JOIN auths_resource a ON EXISTS (SELECT 1 FROM auth_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'auth_active' AND af.value = true)
    LEFT JOIN auth_items_junction ai_j ON ai_j.auth_id = a.id
    LEFT JOIN items_resource ai ON ai.id = ai_j.item_id
    GROUP BY a.id, (SELECT n.name FROM auth_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.auth_id = a.id LIMIT 1), (SELECT d.description FROM auth_descriptions_junction ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.auth_id = a.id LIMIT 1), (SELECT s.value FROM auth_slugs_junction as_j JOIN slugs_resource s ON s.id = as_j.slug_id WHERE as_j.auth_id = a.id LIMIT 1), EXISTS (SELECT 1 FROM auth_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = a.id AND f.name = 'auth_active' AND af.value = TRUE), a.generated
),
-- Provider key IDs (from settings_resource.provider_key_ids)
setting_provider_key_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT setting_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT sr.provider_key_ids
                 FROM setting_settings_junction ssj
                 JOIN settings_resource sr ON sr.id = ssj.settings_id
                 WHERE ssj.setting_id = (SELECT setting_id FROM params)
                   AND ssj.active = true
                 LIMIT 1),
                ARRAY[]::uuid[]
            )
        END as provider_key_ids
    FROM params
    LIMIT 1
),
-- Provider mapping data (all providers)
provider_mapping_data AS (
    SELECT
        p.id as provider_id,
        (SELECT n.name FROM provider_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.provider_id = pr.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM provider_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.provider_id = pr.id LIMIT 1), '') as description,
        (SELECT n.name FROM provider_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.provider_id = pr.id LIMIT 1) as value,  -- value is the name
        p.active
    FROM params x
    CROSS JOIN user_profile up
    JOIN providers_resource p ON p.active = true
    JOIN provider_providers_junction ppj ON ppj.providers_id = p.id
    JOIN provider_artifact pr ON pr.id = ppj.provider_id
    GROUP BY p.id, (SELECT n.name FROM provider_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.provider_id = pr.id LIMIT 1), COALESCE((SELECT d.description FROM provider_descriptions_junction pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.provider_id = pr.id LIMIT 1), ''), p.active
),
-- Key IDs (selected key IDs for setting)
-- Keys are linked via setting_provider_keys_junction -> provider_keys_resource and setting_auth_item_keys_junction
setting_key_ids_data AS (
    SELECT
        CASE
            WHEN (SELECT setting_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (
                    SELECT ARRAY_AGG(key_id ORDER BY created_at)
                    FROM (
                        SELECT DISTINCT pkr.key_id, MIN(spk.created_at) as created_at
                        FROM setting_provider_keys_junction spk
                        JOIN provider_keys_resource pkr ON pkr.id = spk.provider_key_id
                        WHERE spk.setting_id = (SELECT setting_id FROM params)
                          AND spk.active = true
                        GROUP BY pkr.key_id
                    UNION
                    SELECT DISTINCT akr.key_id, MIN(sak.created_at) as created_at
                    FROM setting_auth_item_keys_junction sak
                    JOIN auth_item_keys_resource akr ON akr.id = sak.auth_item_keys_id
                    WHERE sak.setting_id = (SELECT setting_id FROM params)
                      AND sak.active = true
                    GROUP BY akr.key_id
                ) combined_keys
            ),
            ARRAY[]::uuid[]
            )
        END as key_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Key suggestions: linked to settings via setting_provider_keys_junction -> provider_keys_resource or setting_auth_item_keys_junction
key_suggestions_data AS (
    SELECT
        COALESCE(
            (
                SELECT ARRAY_AGG(key_id ORDER BY created_at DESC)
                FROM (
                    SELECT DISTINCT pkr.key_id, MAX(spk.created_at) as created_at
                    FROM setting_provider_keys_junction spk
                    JOIN provider_keys_resource pkr ON pkr.id = spk.provider_key_id
                    WHERE pkr.key_id IS NOT NULL
                      AND spk.active = true
                    GROUP BY pkr.key_id
                    UNION
                    SELECT DISTINCT akr.key_id, MAX(sak.created_at) as created_at
                    FROM setting_auth_item_keys_junction sak
                    JOIN auth_item_keys_resource akr ON akr.id = sak.auth_item_keys_id
                    WHERE akr.key_id IS NOT NULL
                      AND sak.active = true
                    GROUP BY akr.key_id
                ) combined_keys
                ORDER BY MAX(created_at) DESC
                LIMIT 20
            ),
            ARRAY[]::uuid[]
        ) as key_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Key mapping data (all keys accessible to user)
key_mapping_data AS (
    SELECT DISTINCT
        kr.id as key_id,
        kr.name as name,
        CASE 
            WHEN LENGTH(kr.key) > 4 THEN LEFT(kr.key, 4) || '****'
            ELSE '****'
        END as masked_key,
        kr.description as description,
        kr.active as active,
        COALESCE(
            (SELECT ARRAY_AGG(ds.department_id::text ORDER BY ds.department_id::text)
             FROM (
                 SELECT DISTINCT ds.department_id
                 FROM setting_provider_keys_junction spk
                 JOIN provider_keys_resource pkr ON pkr.id = spk.provider_key_id
                 JOIN setting_artifact s ON s.id = spk.setting_id
                 JOIN department_settings_junction ds ON ds.settings_id = s.id AND ds.active = true
                 WHERE pkr.key_id = kr.id AND spk.active = true
             ) ds),
            ARRAY[]::text[]
        ) as department_ids
    FROM params x
    CROSS JOIN user_profile up
    JOIN keys_resource kr ON true
    WHERE
        -- Include keys with matching department links OR default keys (no department links) OR superadmin can see all
        EXISTS (
            SELECT 1 FROM setting_provider_keys_junction spk
            JOIN provider_keys_resource pkr ON pkr.id = spk.provider_key_id
            JOIN setting_artifact s ON s.id = spk.setting_id
            JOIN department_settings_junction ds ON ds.settings_id = s.id AND ds.active = true
            JOIN user_departments ud ON ud.department_id = ds.department_id
            WHERE pkr.key_id = kr.id AND spk.active = true
        )
        OR NOT EXISTS (
            SELECT 1 FROM setting_provider_keys_junction spk2
            JOIN provider_keys_resource pkr2 ON pkr2.id = spk2.provider_key_id
            JOIN setting_artifact s2 ON s2.id = spk2.setting_id
            JOIN department_settings_junction ds2 ON ds2.settings_id = s2.id AND ds2.active = true
            WHERE pkr2.key_id = kr.id AND spk2.active = true
        )
        OR up.role = 'superadmin'
),
-- Role IDs (selected role IDs for setting)
setting_role_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(rd.roles_id ORDER BY rd.created_at)
             FROM roles_drafts_connection rd
             WHERE rd.draft_id = (SELECT draft_id FROM params)),
            CASE
                WHEN (SELECT setting_id FROM params) IS NULL THEN ARRAY[]::uuid[]
                ELSE COALESCE(
                    (SELECT ARRAY_AGG(sr.role_id ORDER BY sr.created_at)
                     FROM setting_roles_junction sr
                     WHERE sr.setting_id = (SELECT setting_id FROM params)
                       AND sr.active = true),
                    ARRAY[]::uuid[]
                )
            END
        ) as role_ids
    FROM params
    LIMIT 1
),
-- Role resources (details for selected roles)
role_resources_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (r.id, r.role::text, COALESCE(r.name, r.role::text), COALESCE(r.description, ''), COALESCE(i.value, 'User'), COALESCE(c.hex_code, '#64748b'), COALESCE(r.generated, false))::types.q_get_setting_v4_role_resource
                ORDER BY r.name
            ),
            '{}'::types.q_get_setting_v4_role_resource[]
        ) as role_resources
    FROM roles_resource r
    LEFT JOIN icons_resource i ON i.id = r.icon_id
    LEFT JOIN colors_resource c ON c.id = r.color_id
    WHERE r.id = ANY(COALESCE((SELECT role_ids FROM setting_role_ids_data), ARRAY[]::uuid[]))
),
-- All available roles
roles_all_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (r.id, r.role::text, COALESCE(r.name, r.role::text), COALESCE(r.description, ''), COALESCE(i.value, 'User'), COALESCE(c.hex_code, '#64748b'), COALESCE(r.generated, false))::types.q_get_setting_v4_role_resource
                ORDER BY r.name
            ),
            '{}'::types.q_get_setting_v4_role_resource[]
        ) as roles
    FROM roles_resource r
    LEFT JOIN icons_resource i ON i.id = r.icon_id
    LEFT JOIN colors_resource c ON c.id = r.color_id
),
-- Route IDs (selected route IDs for setting)
setting_route_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(rd.routes_id ORDER BY rd.created_at)
             FROM routes_drafts_connection rd
             WHERE rd.draft_id = (SELECT draft_id FROM params)),
            CASE
                WHEN (SELECT setting_id FROM params) IS NULL THEN ARRAY[]::uuid[]
                ELSE COALESCE(
                    (SELECT ARRAY_AGG(x.route_id ORDER BY x.created_at)
                     FROM (
                         SELECT rr.route_id, MIN(srr.created_at) AS created_at
                         FROM setting_role_routes_junction srr
                         JOIN role_routes_resource rr ON rr.id = srr.role_routes_id
                         WHERE srr.setting_id = (SELECT setting_id FROM params)
                           AND srr.active = true
                           AND rr.active = true
                         GROUP BY rr.route_id
                     ) x),
                    ARRAY[]::uuid[]
                )
            END
        ) as route_ids
    FROM params
    LIMIT 1
),
-- Route resources (details for selected routes)
route_resources_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (r.id, r.route::text, r.role_id, COALESCE(r.generated, false))::types.q_get_setting_v4_route_resource
                ORDER BY r.route
            ),
            '{}'::types.q_get_setting_v4_route_resource[]
        ) as route_resources
    FROM routes_resource r
    WHERE r.id = ANY(COALESCE((SELECT route_ids FROM setting_route_ids_data), ARRAY[]::uuid[]))
),
-- All available routes
routes_all_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (r.id, r.route::text, r.role_id, COALESCE(r.generated, false))::types.q_get_setting_v4_route_resource
                ORDER BY r.route
            ),
            '{}'::types.q_get_setting_v4_route_resource[]
        ) as routes
    FROM routes_resource r
),
-- Role-route IDs (selected role_routes for setting)
setting_role_route_ids_data AS (
    SELECT
        COALESCE(
            (SELECT ARRAY_AGG(rrd.role_routes_id ORDER BY rrd.created_at)
             FROM role_routes_drafts_connection rrd
             WHERE rrd.draft_id = (SELECT draft_id FROM params)),
            COALESCE(
                (SELECT ARRAY_AGG(rr.id ORDER BY rr.created_at)
                 FROM role_routes_resource rr
                 WHERE rr.role_id = ANY(COALESCE((SELECT role_ids FROM setting_role_ids_data), ARRAY[]::uuid[]))
                   AND rr.route_id = ANY(COALESCE((SELECT route_ids FROM setting_route_ids_data), ARRAY[]::uuid[]))
                   AND rr.active = true),
                ARRAY[]::uuid[]
            )
        ) as role_route_ids
    FROM params
    LIMIT 1
),
-- Role-route resources (details)
role_route_resources_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (rr.id, rr.role_id, rr.route_id, COALESCE(rr.generated, false))::types.q_get_setting_v4_role_route
                ORDER BY rr.created_at
            ),
            '{}'::types.q_get_setting_v4_role_route[]
        ) as role_route_resources
    FROM role_routes_resource rr
    WHERE rr.id = ANY(COALESCE((SELECT role_route_ids FROM setting_role_route_ids_data), ARRAY[]::uuid[]))
),
-- All role_routes (within setting's roles/routes)
role_routes_all_data AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (rr.id, rr.role_id, rr.route_id, COALESCE(rr.generated, false))::types.q_get_setting_v4_role_route
                ORDER BY rr.created_at
            ),
            '{}'::types.q_get_setting_v4_role_route[]
        ) as role_routes
    FROM role_routes_resource rr
    WHERE rr.active = true
),
-- Tools existence check
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
            WHERE rt.resource = 'colors'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as colors_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'flags'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as flags_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'auths'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as auths_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'providers'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as providers_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'keys'::resource_type 
              AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as keys_has_tools
    FROM params x
),
agent_artifact_tool_counts AS (
    SELECT 
        a.id as agent_id,
        COUNT(DISTINCT CASE WHEN ar.resource IS NOT NULL THEN rt.resource::text END) as matched_artifact_count,
        COUNT(DISTINCT CASE WHEN ar.resource IS NULL THEN rt.resource::text END) as extra_outside_count
    FROM agent_artifact a
    LEFT JOIN agent_tools_junction at ON at.agent_id = a.id AND at.active = true
    LEFT JOIN tools_resource tr ON tr.id = at.tool_id
    JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    LEFT JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (
        SELECT 1 FROM tool_flags_junction tf
        JOIN flags_resource f ON tf.flag_id = f.id
        WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true
    )
    LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
    LEFT JOIN artifact_resources_relation ar ON ar.resource = rt.resource AND ar.artifact = 'setting'::artifact_type
    GROUP BY a.id
),
-- Selected department for agents (used in agent selection)
selected_department_for_agents AS (
    SELECT 
        COALESCE(
            (SELECT department_id FROM primary_department_id_data),
            (SELECT department_id FROM department_mapping_data LIMIT 1),
            NULL::uuid
        ) as department_id
    FROM params
    LIMIT 1
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
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifact_type = 'setting'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
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
                         WHERE NULL::uuid = ea.agent_id 
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
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifact_type = 'setting'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
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
                         WHERE NULL::uuid = ea.agent_id 
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
-- Agent selection for 'colors' resource
colors_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifact_type = 'setting'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
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
              AND rt.resource = 'colors'::resource_type
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
                         WHERE NULL::uuid = ea.agent_id 
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
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifact_type = 'setting'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
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
                         WHERE NULL::uuid = ea.agent_id 
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
-- Agent selection for 'departments' resource
departments_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifact_type = 'setting'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
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
              AND rt.resource = 'departments'::resource_type
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
                         WHERE NULL::uuid = ea.agent_id 
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
-- Agent selection for 'auths' resource
auths_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifact_type = 'setting'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
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
              AND rt.resource = 'auths'::resource_type
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
                         WHERE NULL::uuid = ea.agent_id 
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
-- Agent selection for 'providers' resource
providers_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifact_type = 'setting'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
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
              AND rt.resource = 'providers'::resource_type
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
                         WHERE NULL::uuid = ea.agent_id 
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
-- Agent selection for 'keys' resource
keys_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 
            
            WHERE NULL::uuid = a.id
              AND NULL::artifact_type = 'setting'::artifact_type
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments_junction ad
                JOIN user_departments ud ON ad.department_id = ud.department_id
                WHERE NULL::uuid = a.id AND ad.active = true
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
              AND rt.resource = 'keys'::resource_type
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
                         WHERE NULL::uuid = ea.agent_id 
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
-- Permissions data
permissions_data AS (
    SELECT 
        CASE 
            WHEN (SELECT setting_id FROM params) IS NULL THEN
                -- New mode: can_edit based on whether user has departments
                CASE 
                    WHEN EXISTS (SELECT 1 FROM user_departments) THEN true
                    ELSE false
                END
            ELSE
                -- Edit mode: can_edit based on access check
                COALESCE((SELECT has_access FROM setting_department_access_check), false)
        END as can_edit,
        CASE 
            WHEN (SELECT setting_id FROM params) IS NULL THEN
                -- New mode: disabled_reason if no departments
                CASE 
                    WHEN NOT EXISTS (SELECT 1 FROM user_departments) THEN 'No accessible departments found for user'::text
                    ELSE NULL::text
                END
            ELSE
                -- Edit mode: disabled_reason if no access
                CASE 
                    WHEN NOT COALESCE((SELECT has_access FROM setting_department_access_check), false) THEN 'You don''t have access to this setting. It may be restricted to other departments.'::text
                    ELSE NULL::text
                END
        END as base_disabled_reason
    FROM params x
    CROSS JOIN user_profile up
),
-- Missing tools check
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            CASE WHEN NOT tec.names_has_tools THEN 'name' ELSE NULL END,
            CASE WHEN NOT tec.colors_has_tools THEN 'color' ELSE NULL END,
            CASE WHEN NOT tec.flags_has_tools THEN 'flag' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM tools_existence_check tec
),
-- Permissions final (merge base permissions with missing tools check)
permissions_final AS (
    SELECT 
        pd.can_edit AND array_length(mtc.missing_resources, 1) IS NULL as can_edit,
        CASE 
            WHEN array_length(mtc.missing_resources, 1) > 0 THEN
                'No tool configured for ' || 
                array_to_string(mtc.missing_resources, ', ') || 
                '. Therefore we cannot proceed ahead.'::text
            ELSE pd.base_disabled_reason
        END as disabled_reason
    FROM permissions_data pd
    CROSS JOIN missing_tools_check mtc
)
SELECT
    -- Required fields (first 5)
    (SELECT setting_exists FROM setting_exists_check) as setting_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    -- Group ID for linking resources
    dgd.group_id,
    -- Single-select resources: name
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT name_res FROM (SELECT nrd.draft_name_resource as name_res UNION ALL SELECT nrd.setting_name_resource LIMIT 1) sub WHERE name_res IS NOT NULL LIMIT 1) as name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_name
    END as show_name,
    (SELECT agent_id FROM name_agent_data) as name_agent_id,
    true as name_required,
    COALESCE((SELECT name_suggestions FROM name_suggestions_data), ARRAY[]::uuid[]) as name_suggestions,
    COALESCE((SELECT names FROM names_suggestions_objects), ARRAY[]::types.q_get_setting_v4_name_resource[]) as names,
    -- Single-select resources: description
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT desc_res FROM (SELECT drd.draft_description_resource as desc_res UNION ALL SELECT drd.setting_description_resource LIMIT 1) sub WHERE desc_res IS NOT NULL LIMIT 1) as description_resource,
    uf.show_description,
    (SELECT agent_id FROM description_agent_data) as description_agent_id,
    false as description_required,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.id, dd.description, dd.generated)::types.q_get_setting_v4_description_resource
            ORDER BY dd.description
        ) FROM (SELECT DISTINCT id, description, generated FROM descriptions_suggestions_objects dso CROSS JOIN LATERAL unnest(dso.descriptions) dd) dd),
        COALESCE((SELECT descriptions FROM descriptions_suggestions_objects), ARRAY[]::types.q_get_setting_v4_description_resource[])
    ) as descriptions,
    -- Multi-select resources: colors (theme colors)
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'color_ids' IS NOT NULL AND jsonb_typeof(payload->'color_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'color_ids'))::uuid[]
                ELSE NULL
            END
        FROM draft_payload_data),
        CASE 
            WHEN (SELECT setting_id FROM params) IS NULL THEN
                -- For new settings, leave color_ids empty (no auto-selection)
                ARRAY[]::uuid[]
            ELSE (SELECT color_ids FROM color_resource_data)
        END
    ) as color_ids,
    -- Color resources (selected colors filtered by color_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (crd.color_id, crd.name, crd.description, crd.hex_code, crd.generated)::types.q_get_setting_v4_color_resource
            ORDER BY crd.created_at
        )
        FROM (
            SELECT DISTINCT c.id as color_id, c.name, c.description, c.hex_code, COALESCE(c.generated, false) as generated, sc.created_at
            FROM setting_colors_junction sc
            JOIN colors_resource c ON c.id = sc.color_id
            WHERE sc.setting_id = (SELECT setting_id FROM params)
              AND c.id = ANY(
                  COALESCE(
                      (SELECT 
                          CASE 
                              WHEN payload->'color_ids' IS NOT NULL AND jsonb_typeof(payload->'color_ids') = 'array' THEN
                                  ARRAY(SELECT jsonb_array_elements_text(payload->'color_ids'))::uuid[]
                              ELSE NULL
                          END
                      FROM draft_payload_data),
                      CASE 
                          WHEN (SELECT setting_id FROM params) IS NULL THEN
                              ARRAY[]::uuid[]
                          ELSE (SELECT color_ids FROM color_resource_data)
                      END
                  )
              )
        ) crd),
        '{}'::types.q_get_setting_v4_color_resource[]
    ) as color_resources,
    CASE 
        WHEN NOT tec.colors_has_tools THEN false
        WHEN cag.colors_count > 0 THEN true
        ELSE false
    END as show_colors,
    (SELECT agent_id FROM colors_agent_data) as colors_agent_id,
    true as colors_required,
    COALESCE((SELECT color_suggestions FROM color_suggestions_data), ARRAY[]::uuid[]) as color_suggestions,
    cag.colors as colors,
    -- Single-select resources: flag
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    (SELECT flag_res FROM (SELECT frd.draft_flag_resource as flag_res UNION ALL SELECT frd.setting_flag_resource LIMIT 1) sub WHERE flag_res IS NOT NULL LIMIT 1) as flag_resource,
    uf.show_flag,
    (SELECT agent_id FROM flag_agent_data) as flag_agent_id,
    false as flag_required,
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.id, fd.name, fd.description, fd.icon, fd.generated)::types.q_get_setting_v4_flag_resource
            ORDER BY fd.name
        ) FROM (SELECT DISTINCT id, name, description, icon, generated FROM flags_data) fd),
        '{}'::types.q_get_setting_v4_flag_resource[]
    ) as flags,
    -- Multi-select resources: departments
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'department_ids' IS NOT NULL AND jsonb_typeof(payload->'department_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids'))::uuid[]
                ELSE NULL
            END
        FROM draft_payload_data),
        CASE 
            WHEN (SELECT setting_id FROM params) IS NULL THEN
                -- For new settings, leave department_ids empty (no auto-selection)
                ARRAY[]::uuid[]
            ELSE sdd.department_ids
        END
    ) as department_ids,
    -- Department resources (selected departments filtered by department_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_setting_v4_department
            ORDER BY dmd.name
        )
        FROM department_mapping_data dmd
        WHERE dmd.department_id = ANY(
            COALESCE(
                (SELECT 
                    CASE 
                        WHEN payload->'department_ids' IS NOT NULL AND jsonb_typeof(payload->'department_ids') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids'))::uuid[]
                        ELSE NULL
                    END
                FROM draft_payload_data),
                CASE 
                    WHEN (SELECT setting_id FROM params) IS NULL THEN
                        -- For new settings, leave department_ids empty (no auto-selection)
                        ARRAY[]::uuid[]
                    ELSE sdd.department_ids
                END
            )
        )),
        '{}'::types.q_get_setting_v4_department[]
    ) as department_resources,
    CASE 
        WHEN NOT tec.departments_has_tools AND uf.show_departments THEN false
        WHEN EXISTS (SELECT 1 FROM department_mapping_data LIMIT 1) THEN true
        ELSE uf.show_departments
    END as show_departments,
    (SELECT agent_id FROM departments_agent_data) as departments_agent_id,
    CASE 
        WHEN uf.show_departments THEN true
        ELSE false
    END as departments_required,
    dsd_dept.department_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_setting_v4_department
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM department_mapping_data) dmd),
        '{}'::types.q_get_setting_v4_department[]
    ) as departments,
    -- Multi-select resources: profiles
    COALESCE((SELECT profile_ids FROM profile_resource_data), ARRAY[]::uuid[]) as profile_ids,
    COALESCE(
        (SELECT prd.draft_profile_resources FROM profile_resource_data prd WHERE prd.draft_profile_resources IS NOT NULL LIMIT 1),
        (SELECT prd.setting_profile_resources FROM profile_resource_data prd WHERE prd.setting_profile_resources IS NOT NULL LIMIT 1),
        '{}'::types.q_get_setting_v4_profile[]
    ) as profile_resources,
    uf.show_profiles,
    NULL::uuid as profiles_agent_id,
    false as profiles_required,
    COALESCE((SELECT profile_suggestions FROM profile_suggestions_data), ARRAY[]::uuid[]) as profile_suggestions,
    COALESCE((SELECT profiles FROM profiles_data), '{}'::types.q_get_setting_v4_profile[]) as profiles,
    -- Multi-select resources: auths
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'auth_ids' IS NOT NULL AND jsonb_typeof(payload->'auth_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'auth_ids'))::uuid[]
                ELSE NULL
            END
        FROM draft_payload_data),
        CASE 
            WHEN (SELECT setting_id FROM params) IS NULL THEN
                -- For new settings, leave auth_ids empty (no auto-selection)
                ARRAY[]::uuid[]
            ELSE said.auth_ids
        END
    ) as auth_ids,
    -- Auth resources (selected auths filtered by auth_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (amd.auth_id, amd.name, amd.description, amd.slug, amd.active, amd.auth_items_junction)::types.q_get_setting_v4_auth
            ORDER BY amd.name
        )
        FROM (SELECT DISTINCT auth_id, name, description, slug, active, auth_items_junction FROM auth_mapping_data WHERE auth_id = ANY(
            COALESCE(
                (SELECT 
                    CASE 
                        WHEN payload->'auth_ids' IS NOT NULL AND jsonb_typeof(payload->'auth_ids') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'auth_ids'))::uuid[]
                        ELSE NULL
                    END
                FROM draft_payload_data),
                CASE 
                    WHEN (SELECT setting_id FROM params) IS NULL THEN
                        ARRAY[]::uuid[]
                    ELSE said.auth_ids
                END
            )
        )) amd),
        '{}'::types.q_get_setting_v4_auth[]
    ) as auth_resources,
    CASE 
        WHEN NOT tec.auths_has_tools AND uf.show_auths THEN false
        WHEN EXISTS (SELECT 1 FROM auth_mapping_data LIMIT 1) THEN true
        ELSE uf.show_auths
    END as show_auths,
    (SELECT agent_id FROM auths_agent_data) as auths_agent_id,
    false as auths_required,
    COALESCE((SELECT auth_suggestions FROM auth_suggestions_data), ARRAY[]::uuid[]) as auth_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (amd.auth_id, amd.name, amd.description, amd.slug, amd.active, amd.auth_items_junction)::types.q_get_setting_v4_auth
            ORDER BY amd.name
        ) FROM (SELECT DISTINCT auth_id, name, description, slug, active, auth_items_junction FROM auth_mapping_data) amd),
        '{}'::types.q_get_setting_v4_auth[]
    ) as auths,
    -- Provider key IDs
    COALESCE(
        (SELECT
            CASE
                WHEN payload->'provider_key_ids' IS NOT NULL AND jsonb_typeof(payload->'provider_key_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'provider_key_ids'))::uuid[]
                ELSE NULL
            END
        FROM draft_payload_data),
        spkid.provider_key_ids
    ) as provider_key_ids,
    -- Multi-select resources: keys
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'key_ids' IS NOT NULL AND jsonb_typeof(payload->'key_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'key_ids'))::uuid[]
                ELSE NULL
            END
        FROM draft_payload_data),
        CASE 
            WHEN (SELECT setting_id FROM params) IS NULL THEN
                -- For new settings, leave key_ids empty (no auto-selection)
                ARRAY[]::uuid[]
            ELSE skid.key_ids
        END
    ) as key_ids,
    -- Key resources (selected keys filtered by key_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (kmd.key_id, kmd.name, kmd.masked_key, kmd.description, kmd.active, kmd.department_ids)::types.q_get_setting_v4_key
            ORDER BY kmd.name
        )
        FROM (SELECT DISTINCT key_id, name, masked_key, description, active, department_ids FROM key_mapping_data WHERE key_id = ANY(
            COALESCE(
                (SELECT 
                    CASE 
                        WHEN payload->'key_ids' IS NOT NULL AND jsonb_typeof(payload->'key_ids') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'key_ids'))::uuid[]
                        ELSE NULL
                    END
                FROM draft_payload_data),
                CASE 
                    WHEN (SELECT setting_id FROM params) IS NULL THEN
                        ARRAY[]::uuid[]
                    ELSE skid.key_ids
                END
            )
        )) kmd),
        '{}'::types.q_get_setting_v4_key[]
    ) as key_resources,
    CASE 
        WHEN NOT tec.keys_has_tools AND uf.show_keys THEN false
        WHEN EXISTS (SELECT 1 FROM key_mapping_data LIMIT 1) THEN true
        ELSE uf.show_keys
    END as show_keys,
    (SELECT agent_id FROM keys_agent_data) as keys_agent_id,
    false as keys_required,
    COALESCE((SELECT key_suggestions FROM key_suggestions_data), ARRAY[]::uuid[]) as key_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (kmd.key_id, kmd.name, kmd.masked_key, kmd.description, kmd.active, kmd.department_ids)::types.q_get_setting_v4_key
            ORDER BY kmd.name
        ) FROM (SELECT DISTINCT key_id, name, masked_key, description, active, department_ids FROM key_mapping_data) kmd),
        '{}'::types.q_get_setting_v4_key[]
    ) as keys,
    -- Multi-select resources: roles
    (SELECT role_ids FROM setting_role_ids_data) as role_ids,
    (SELECT role_resources FROM role_resources_data) as role_resources,
    true as show_roles,
    false as roles_required,
    (SELECT roles FROM roles_all_data) as roles,
    -- Multi-select resources: routes
    (SELECT route_ids FROM setting_route_ids_data) as route_ids,
    (SELECT route_resources FROM route_resources_data) as route_resources,
    true as show_routes,
    false as routes_required,
    (SELECT routes FROM routes_all_data) as routes,
    -- Role-route junction resources
    (SELECT role_route_ids FROM setting_role_route_ids_data) as role_route_ids,
    (SELECT role_route_resources FROM role_route_resources_data) as role_route_resources,
    true as show_role_routes,
    (SELECT role_routes FROM role_routes_all_data) as role_routes
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
LEFT JOIN setting_departments_data sdd ON true
CROSS JOIN active_departments_data add
CROSS JOIN draft_group_data dgd
CROSS JOIN draft_version_data dvd
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN color_resource_data crd
CROSS JOIN flag_resource_data frd
CROSS JOIN color_suggestions_data csd
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_suggestions_data dsd
CROSS JOIN names_suggestions_objects nso
CROSS JOIN descriptions_suggestions_objects dso
CROSS JOIN colors_agg cag
CROSS JOIN department_suggestions_data dsd_dept
CROSS JOIN setting_auth_ids_data said
CROSS JOIN setting_provider_key_ids_data spkid
CROSS JOIN setting_key_ids_data skid
$$;

