-- Get default persona detail for creation
-- Converted to function with composite types

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_persona_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_new_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_persona_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_persona_new_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_persona_new_v4_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

CREATE TYPE types.q_get_persona_new_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    numerical boolean,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean
);

CREATE TYPE types.q_get_persona_new_v4_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text
);

CREATE TYPE types.q_get_persona_new_v4_color AS (
    hex text,
    name text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_persona_new_v4(
    profile_id uuid,
    color_search text DEFAULT NULL,
    icon_search text DEFAULT NULL,
    color_show_selected boolean DEFAULT NULL,
    icon_show_selected boolean DEFAULT NULL,
    current_color text DEFAULT NULL,
    current_icon text DEFAULT NULL
)
RETURNS TABLE (
    actor_name text,
    user_role text,
    primary_department_id uuid,
    valid_department_ids uuid[],
    valid_agent_ids uuid[],
    valid_parameter_ids uuid[],
    valid_parameter_item_ids uuid[],
    departments types.q_get_persona_new_v4_department[],
    agents types.q_get_persona_new_v4_agent[],
    parameters types.q_get_persona_new_v4_parameter[],
    fields types.q_get_persona_new_v4_field[],
    preset_colors types.q_get_persona_new_v4_color[],
    suggested_icons text[],
    valid_icons text[],
    name text,
    description text,
    department_ids uuid[],
    active boolean,
    color text,
    icon text,
    instructions text,
    in_use boolean,
    scenario_count int,
    can_edit boolean,
    can_duplicate boolean,
    can_delete boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        color_search AS color_search,
        icon_search AS icon_search,
        COALESCE(color_show_selected, false) AS color_show_selected,
        COALESCE(icon_show_selected, false) AS icon_show_selected,
        current_color AS current_color,
        current_icon AS current_icon
),
user_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name,
        p.role as user_role
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
department_mapping_data AS (
    SELECT 
        d.id as department_id,
        d.title as name,
        COALESCE(d.description, '') as description
    FROM params x
    JOIN departments d ON d.active = true
    JOIN profile_departments pd ON d.id = pd.department_id AND pd.profile_id = x.profile_id AND pd.active = true
),
valid_department_ids_data AS (
    SELECT ARRAY_AGG(department_id ORDER BY name) as valid_department_ids
    FROM department_mapping_data
),
primary_department_id_data AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.is_primary = TRUE
    LIMIT 1
),
agent_mapping_data AS (
    SELECT 
        a.id as agent_id,
        a.name,
        COALESCE(a.description, '') as description,
        ARRAY[a.role::text] as roles
    FROM params x
    JOIN agents a ON a.active = true AND a.role IN ('simulation'::agent_role, 'voice'::agent_role)
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    GROUP BY a.id, a.name, a.description, a.role
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
valid_agent_ids_data AS (
    SELECT ARRAY_AGG(agent_id ORDER BY name) as valid_agent_ids
    FROM agent_mapping_data
),
parameter_mapping_data AS (
    SELECT 
        p.id as parameter_id,
        p.name,
        COALESCE(p.description, '') as description,
        false as numerical,
        COALESCE(p.document_parameter, false) as document_parameter,
        COALESCE(p.persona_parameter, false) as persona_parameter,
        COALESCE(p.scenario_parameter, false) as scenario_parameter,
        COALESCE(p.video_parameter, false) as video_parameter
    FROM parameters p
    WHERE p.active = true AND p.persona_parameter = true
),
valid_parameter_ids_data AS (
    SELECT ARRAY_AGG(parameter_id ORDER BY name) as valid_parameter_ids
    FROM parameter_mapping_data
),
field_mapping_data AS (
    SELECT 
        f.id as field_id,
        f.name,
        COALESCE(f.description, '') as description,
        pf.parameter_id,
        p.name as parameter_name
    FROM parameter_mapping_data pmd
    JOIN parameter_fields pf ON pf.parameter_id = pmd.parameter_id AND pf.active = true
    JOIN fields f ON f.id = pf.field_id AND f.active = true
    JOIN parameters p ON p.id = pf.parameter_id
    WHERE p.active = true
),
valid_parameter_item_ids_data AS (
    SELECT ARRAY_AGG(field_id ORDER BY name) as valid_parameter_item_ids
    FROM field_mapping_data
),
-- All preset colors (hardcoded)
all_preset_colors AS (
    SELECT * FROM (VALUES
        ('#EF4444', 'Red'),
        ('#F97316', 'Orange'),
        ('#F59E0B', 'Amber'),
        ('#10B981', 'Emerald'),
        ('#3B82F6', 'Blue'),
        ('#6366F1', 'Indigo'),
        ('#8B5CF6', 'Violet'),
        ('#EC4899', 'Pink')
    ) AS t(hex, name)
),
-- Filtered preset colors based on search and show_selected
preset_colors_filtered AS (
    SELECT apc.hex, apc.name
    FROM all_preset_colors apc
    CROSS JOIN params p
    WHERE 
        -- Search filter: if color_search provided, match name or hex
        (p.color_search IS NULL OR p.color_search = '' OR
         LOWER(apc.name) LIKE '%' || LOWER(p.color_search) || '%' OR
         LOWER(apc.hex) LIKE '%' || LOWER(p.color_search) || '%')
        -- Show selected filter: if enabled and current_color provided, only show current color
        AND (
            NOT p.color_show_selected OR
            p.current_color IS NULL OR
            UPPER(apc.hex) = UPPER(COALESCE(p.current_color, ''))
        )
),
-- All suggested icons (hardcoded)
all_suggested_icons AS (
    SELECT unnest(ARRAY['Sparkles', 'Zap', 'Star', 'Heart', 'Users']) AS icon_name
),
-- Filtered suggested icons based on search and show_selected
suggested_icons_filtered AS (
    SELECT asi.icon_name
    FROM all_suggested_icons asi
    CROSS JOIN params p
    WHERE 
        -- Search filter: if icon_search provided, match name
        (p.icon_search IS NULL OR p.icon_search = '' OR
         LOWER(asi.icon_name) LIKE '%' || LOWER(p.icon_search) || '%')
        -- Show selected filter: if enabled and current_icon provided, only show current icon
        AND (
            NOT p.icon_show_selected OR
            p.current_icon IS NULL OR
            LOWER(asi.icon_name) = LOWER(COALESCE(p.current_icon, ''))
        )
),
-- All valid icons (hardcoded)
all_valid_icons AS (
    SELECT unnest(ARRAY[
        'Activity', 'Anchor', 'Award', 'Bell', 'Book', 'Briefcase', 'Calendar', 'Camera',
        'ChevronRight', 'Clock', 'Cloud', 'Code', 'Compass', 'Database', 'FileText', 'Globe',
        'Mail', 'Mic', 'Monitor', 'Phone', 'Radio', 'Search', 'Settings', 'Shield', 'Video', 'Wifi'
    ]) AS icon_name
),
-- Filtered valid icons based on search and show_selected
valid_icons_filtered AS (
    SELECT avi.icon_name
    FROM all_valid_icons avi
    CROSS JOIN params p
    WHERE 
        -- Search filter: if icon_search provided, match name
        (p.icon_search IS NULL OR p.icon_search = '' OR
         LOWER(avi.icon_name) LIKE '%' || LOWER(p.icon_search) || '%')
        -- Show selected filter: if enabled and current_icon provided, only show current icon
        AND (
            NOT p.icon_show_selected OR
            p.current_icon IS NULL OR
            LOWER(avi.icon_name) = LOWER(COALESCE(p.current_icon, ''))
        )
)
SELECT 
    up.actor_name::text as actor_name,
    up.user_role::text as user_role,
    (SELECT department_id FROM primary_department_id_data) as primary_department_id,
    COALESCE(vdid.valid_department_ids, ARRAY[]::uuid[]) as valid_department_ids,
    COALESCE(vaid.valid_agent_ids, ARRAY[]::uuid[]) as valid_agent_ids,
    COALESCE(vpid.valid_parameter_ids, ARRAY[]::uuid[]) as valid_parameter_ids,
    COALESCE(vpiid.valid_parameter_item_ids, ARRAY[]::uuid[]) as valid_parameter_item_ids,
    -- Aggregate departments separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description)::types.q_get_persona_new_v4_department
            ORDER BY dmd.name
        ) FROM department_mapping_data dmd),
        '{}'::types.q_get_persona_new_v4_department[]
    ) as departments,
    -- Aggregate agents separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (amd.agent_id, amd.name, amd.description, amd.roles)::types.q_get_persona_new_v4_agent
            ORDER BY amd.name
        ) FROM agent_mapping_data amd),
        '{}'::types.q_get_persona_new_v4_agent[]
    ) as agents,
    -- Aggregate parameters separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (pmd.parameter_id, pmd.name, pmd.description, pmd.numerical, 
             pmd.document_parameter, pmd.persona_parameter, pmd.scenario_parameter, pmd.video_parameter)::types.q_get_persona_new_v4_parameter
            ORDER BY pmd.name
        ) FROM parameter_mapping_data pmd),
        '{}'::types.q_get_persona_new_v4_parameter[]
    ) as parameters,
    -- Aggregate fields separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (fmd.field_id, fmd.name, fmd.description, fmd.parameter_id, fmd.parameter_name)::types.q_get_persona_new_v4_field
            ORDER BY fmd.name
        ) FROM field_mapping_data fmd),
        '{}'::types.q_get_persona_new_v4_field[]
    ) as fields,
    -- Filtered preset colors (SQL-side filtering)
    COALESCE(
        (SELECT ARRAY_AGG((pcf.hex, pcf.name)::types.q_get_persona_new_v4_color ORDER BY pcf.name) FROM preset_colors_filtered pcf),
        '{}'::types.q_get_persona_new_v4_color[]
    ) as preset_colors,
    -- Filtered suggested icons (SQL-side filtering)
    COALESCE(
        (SELECT ARRAY_AGG(sif.icon_name ORDER BY sif.icon_name) FROM suggested_icons_filtered sif),
        '{}'::text[]
    ) as suggested_icons,
    -- Filtered valid icons (SQL-side filtering)
    COALESCE(
        (SELECT ARRAY_AGG(vif.icon_name ORDER BY vif.icon_name) FROM valid_icons_filtered vif),
        '{}'::text[]
    ) as valid_icons,
    -- Default values for new persona
    ''::text as name,
    ''::text as description,
    CASE 
        WHEN up.user_role = 'superadmin' THEN NULL::uuid[]
        ELSE COALESCE(ARRAY[(SELECT department_id FROM primary_department_id_data)], ARRAY[]::uuid[])
    END as department_ids,
    true::boolean as active,
    '#3B82F6'::text as color,
    'Sparkles'::text as icon,
    ''::text as instructions,
    false::boolean as in_use,
    0::int as scenario_count,
    -- can_edit: true for superadmin, or if default_department_ids is not empty
    CASE 
        WHEN up.user_role = 'superadmin' THEN true
        WHEN (SELECT department_id FROM primary_department_id_data) IS NOT NULL THEN true
        ELSE false
    END::boolean as can_edit,
    false::boolean as can_duplicate,
    false::boolean as can_delete
FROM user_profile up
CROSS JOIN valid_department_ids_data vdid
CROSS JOIN valid_agent_ids_data vaid
CROSS JOIN valid_parameter_ids_data vpid
CROSS JOIN valid_parameter_item_ids_data vpiid
$$;

COMMIT;
