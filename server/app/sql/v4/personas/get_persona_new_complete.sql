-- Get default persona detail for creation
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
    department_id uuid
);

CREATE TYPE types.q_get_persona_new_v4_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

CREATE TYPE types.q_get_persona_new_v4_parameter AS (
    parameter_id uuid
);

CREATE TYPE types.q_get_persona_new_v4_field AS (
    field_id uuid
);

CREATE TYPE types.q_get_persona_new_v4_color AS (
    hex text,
    name text
);

CREATE TYPE types.q_get_persona_new_v4_name_resource AS (
    id uuid,
    name text
);

CREATE TYPE types.q_get_persona_new_v4_color_resource AS (
    id uuid,
    name text,
    description text,
    hex_code text
);

CREATE TYPE types.q_get_persona_new_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon_id uuid
);

CREATE TYPE types.q_get_persona_new_v4_icon_resource AS (
    id uuid,
    name text,
    description text,
    value text
);

CREATE TYPE types.q_get_persona_new_v4_description_resource AS (
    id uuid,
    description text
);

CREATE TYPE types.q_get_persona_new_v4_instructions_resource AS (
    id uuid,
    template text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_persona_new_v4(
    profile_id uuid,
    color_search text DEFAULT NULL,
    icon_search text DEFAULT NULL,
    color_show_selected boolean DEFAULT NULL,
    icon_show_selected boolean DEFAULT NULL,
    current_color text DEFAULT NULL,
    current_icon text DEFAULT NULL,
    draft_id uuid DEFAULT NULL
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
    can_delete boolean,
    -- Resource IDs for form state
    name_id uuid,
    description_id uuid,
    color_id uuid,
    icon_id uuid,
    instructions_id uuid,
    active_flag_id uuid,
    -- Resource composite types
    name_resource types.q_get_persona_new_v4_name_resource,
    description_resource types.q_get_persona_new_v4_description_resource,
    color_resource types.q_get_persona_new_v4_color_resource,
    icon_resource types.q_get_persona_new_v4_icon_resource,
    instructions_resource types.q_get_persona_new_v4_instructions_resource,
    flag_resource types.q_get_persona_new_v4_flag_resource,
    -- Preset colors as resource array
    preset_colors_resources types.q_get_persona_new_v4_color_resource[]
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
        current_icon AS current_icon,
        draft_id AS draft_id
),
-- Draft data is now stored in draft_* junction tables, not in payload
-- TODO: Query draft_names, draft_colors, etc. to get draft data
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload
    FROM params x
    WHERE x.draft_id IS NOT NULL
    LIMIT 1
),
user_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name,
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
        (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM params x
    JOIN departments d ON EXISTS (SELECT 1 FROM department_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.department_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_department_flags AND df.value = true)
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
        (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1),
        COALESCE((SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1), '') as description,
        ARRAY[COALESCE(da.artifact::text, '')] as roles
    FROM params x
    JOIN agents a ON EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    JOIN agent_domains adom ON adom.agent_id = a.id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact IN (CAST('scenario' AS artifacts), CAST('message' AS artifacts))
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    GROUP BY a.id, (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1), (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1), da.artifact
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
        (SELECT n.name FROM parameter_names pn JOIN names n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM parameter_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1), '') as description,
        false as numerical,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'document_parameter' AND pf.type = 'document_parameter'::type_parameter_flags AND pf.value = TRUE) as document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'persona_parameter' AND pf.type = 'persona_parameter'::type_parameter_flags AND pf.value = TRUE) as persona_parameter,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'scenario_parameter' AND pf.type = 'scenario_parameter'::type_parameter_flags AND pf.value = TRUE) as scenario_parameter,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'video_parameter' AND pf.type = 'video_parameter'::type_parameter_flags AND pf.value = TRUE) as video_parameter
    FROM parameters p
    WHERE EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_parameter_flags AND pf.value = true) 
      AND EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'persona_parameter' AND pf.type = 'persona_parameter'::type_parameter_flags AND pf.value = true)
),
valid_parameter_ids_data AS (
    SELECT ARRAY_AGG(parameter_id ORDER BY name) as valid_parameter_ids
    FROM parameter_mapping_data
),
field_mapping_data AS (
    SELECT 
        f.id as field_id,
        (SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        COALESCE((SELECT d.description FROM field_descriptions fd JOIN descriptions d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), '') as description,
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1),
        (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as parameter_name
    FROM parameter_mapping_data pmd
    JOIN fields f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = pmd.parameter_id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'active' AND ff.type = 'active'::type_field_flags AND ff.value = true)
    JOIN parameters p ON p.id = (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)
    WHERE EXISTS (SELECT 1 FROM persona_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_persona_flags AND pf.value = true)
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
),
-- Resource data CTEs - query from draft_* tables if draft_id provided, otherwise NULL
name_resource_data AS (
    SELECT 
        (SELECT dn.names_id FROM draft_names dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1) as name_id,
        CASE 
            WHEN EXISTS (SELECT 1 FROM draft_names dn JOIN names n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params)) THEN
                (SELECT ROW(n.id, n.name)::types.q_get_persona_new_v4_name_resource FROM draft_names dn JOIN names n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1)
        END as name_resource
    FROM params
),
description_resource_data AS (
    SELECT 
        (SELECT dd.descriptions_id FROM draft_descriptions dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1) as description_id,
        CASE 
            WHEN EXISTS (SELECT 1 FROM draft_descriptions dd JOIN descriptions d ON dd.descriptions_id = d.id WHERE dd.draft_id = (SELECT draft_id FROM params)) THEN
                (SELECT ROW(d.id, d.description)::types.q_get_persona_new_v4_description_resource FROM draft_descriptions dd JOIN descriptions d ON dd.descriptions_id = d.id WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1)
        END as description_resource
    FROM params
),
color_resource_data AS (
    SELECT 
        (SELECT dc.colors_id FROM draft_colors dc WHERE dc.draft_id = (SELECT draft_id FROM params) LIMIT 1) as color_id,
        CASE 
            WHEN EXISTS (SELECT 1 FROM draft_colors dc JOIN colors c ON dc.colors_id = c.id WHERE dc.draft_id = (SELECT draft_id FROM params)) THEN
                (SELECT ROW(c.id, c.name, c.description, c.hex_code)::types.q_get_persona_new_v4_color_resource FROM draft_colors dc JOIN colors c ON dc.colors_id = c.id WHERE dc.draft_id = (SELECT draft_id FROM params) LIMIT 1)
        END as color_resource
    FROM params
),
icon_resource_data AS (
    SELECT 
        (SELECT di.icons_id FROM draft_icons di WHERE di.draft_id = (SELECT draft_id FROM params) LIMIT 1) as icon_id,
        CASE 
            WHEN EXISTS (SELECT 1 FROM draft_icons di JOIN icons i ON di.icons_id = i.id WHERE di.draft_id = (SELECT draft_id FROM params)) THEN
                (SELECT ROW(i.id, i.name, i.description, i.value)::types.q_get_persona_new_v4_icon_resource FROM draft_icons di JOIN icons i ON di.icons_id = i.id WHERE di.draft_id = (SELECT draft_id FROM params) LIMIT 1)
        END as icon_resource
    FROM params
),
instructions_resource_data AS (
    SELECT 
        (SELECT dinst.instructions_id FROM draft_instructions dinst WHERE dinst.draft_id = (SELECT draft_id FROM params) LIMIT 1) as instructions_id,
        CASE 
            WHEN EXISTS (SELECT 1 FROM draft_instructions dinst JOIN instructions inst ON dinst.instructions_id = inst.id WHERE dinst.draft_id = (SELECT draft_id FROM params)) THEN
                (SELECT ROW(inst.id, inst.template)::types.q_get_persona_new_v4_instructions_resource FROM draft_instructions dinst JOIN instructions inst ON dinst.instructions_id = inst.id WHERE dinst.draft_id = (SELECT draft_id FROM params) LIMIT 1)
        END as instructions_resource
    FROM params
),
flag_resource_data AS (
    SELECT 
        (SELECT df.flags_id FROM draft_flags df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1) as active_flag_id,
        CASE 
            WHEN EXISTS (SELECT 1 FROM draft_flags df JOIN flags f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params)) THEN
                (SELECT ROW(f.id, f.name, f.description, f.icon_id)::types.q_get_persona_new_v4_flag_resource FROM draft_flags df JOIN flags f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1)
        END as flag_resource
    FROM params
),
-- Preset colors as resource array (convert preset_colors_filtered to color_resource array)
preset_colors_resources_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                ROW(NULL::uuid, pcf.name, 'Color: ' || pcf.hex, pcf.hex)::types.q_get_persona_new_v4_color_resource
                ORDER BY pcf.name
            ) FROM preset_colors_filtered pcf),
            '{}'::types.q_get_persona_new_v4_color_resource[]
        ) as preset_colors_resources
    FROM params
)
SELECT
    up.actor_name::text as actor_name,
    up.user_role::text as user_role,
    (SELECT department_id FROM primary_department_id_data) as primary_department_id,
    COALESCE(vdid.valid_department_ids, ARRAY[]::uuid[]) as valid_department_ids,
    COALESCE(vaid.valid_agent_ids, ARRAY[]::uuid[]) as valid_agent_ids,
    COALESCE(vpid.valid_parameter_ids, ARRAY[]::uuid[]) as valid_parameter_ids,
    COALESCE(vpiid.valid_parameter_item_ids, ARRAY[]::uuid[]) as valid_parameter_item_ids,
    -- Aggregate departments separately (only IDs)
    COALESCE(
        (SELECT ARRAY_AGG(
            ROW(dmd.department_id)::types.q_get_persona_new_v4_department
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
    -- Aggregate parameters separately (only IDs)
    COALESCE(
        (SELECT ARRAY_AGG(
            ROW(pmd.parameter_id)::types.q_get_persona_new_v4_parameter
            ORDER BY pmd.name
        ) FROM parameter_mapping_data pmd),
        '{}'::types.q_get_persona_new_v4_parameter[]
    ) as parameters,
    -- Aggregate fields separately (only IDs)
    COALESCE(
        (SELECT ARRAY_AGG(
            ROW(fmd.field_id)::types.q_get_persona_new_v4_field
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
    -- Default values for new persona (merged with draft payload if draft_id provided)
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        ''::text
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        ''::text
    ) as description,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'department_ids' IS NOT NULL AND jsonb_typeof(payload->'department_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids'))::uuid[]
                ELSE NULL
            END
        FROM draft_payload_data),
        CASE 
            WHEN up.user_role = 'superadmin' THEN NULL::uuid[]
            ELSE COALESCE(ARRAY[(SELECT department_id FROM primary_department_id_data)], ARRAY[]::uuid[])
        END
    ) as department_ids,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        true::boolean
    ) as active,
    COALESCE(
        (SELECT payload->>'color' FROM draft_payload_data),
        NULL::text
    ) as color,
    COALESCE(
        (SELECT payload->>'icon' FROM draft_payload_data),
        NULL::text
    ) as icon,
    COALESCE(
        (SELECT payload->>'instructions' FROM draft_payload_data),
        ''::text
    ) as instructions,
    false::boolean as in_use,
    0::int as scenario_count,
    -- can_edit: true for superadmin, or if default_department_ids is not empty
    CASE 
        WHEN up.user_role = 'superadmin' THEN true
        WHEN (SELECT department_id FROM primary_department_id_data) IS NOT NULL THEN true
        ELSE false
    END::boolean as can_edit,
    false::boolean as can_duplicate,
    false::boolean as can_delete,
    -- Resource IDs for form state
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT color_id FROM color_resource_data) as color_id,
    (SELECT icon_id FROM icon_resource_data) as icon_id,
    (SELECT instructions_id FROM instructions_resource_data) as instructions_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    -- Resource composite types
    (SELECT name_resource FROM name_resource_data) as name_resource,
    (SELECT description_resource FROM description_resource_data) as description_resource,
    (SELECT color_resource FROM color_resource_data) as color_resource,
    (SELECT icon_resource FROM icon_resource_data) as icon_resource,
    (SELECT instructions_resource FROM instructions_resource_data) as instructions_resource,
    (SELECT flag_resource FROM flag_resource_data) as flag_resource,
    -- Preset colors as resource array
    (SELECT preset_colors_resources FROM preset_colors_resources_data) as preset_colors_resources
FROM user_profile up
CROSS JOIN valid_department_ids_data vdid
CROSS JOIN valid_agent_ids_data vaid
CROSS JOIN valid_parameter_ids_data vpid
CROSS JOIN valid_parameter_item_ids_data vpiid
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN color_resource_data crd
CROSS JOIN icon_resource_data ird
CROSS JOIN instructions_resource_data instrd
CROSS JOIN flag_resource_data frd
CROSS JOIN preset_colors_resources_data pcrd
$$;