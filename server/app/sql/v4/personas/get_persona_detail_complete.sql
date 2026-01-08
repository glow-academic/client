-- Get persona detail with agents, departments, and access control
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
        WHERE proname = 'api_get_persona_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_detail_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_persona_detail_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_persona_detail_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_persona_detail_v4_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

CREATE TYPE types.q_get_persona_detail_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    numerical boolean,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean
);

CREATE TYPE types.q_get_persona_detail_v4_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text
);

CREATE TYPE types.q_get_persona_detail_v4_example AS (
    example_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_persona_detail_v4_example_history_item AS (
    example text,
    department_ids text[]
);

CREATE TYPE types.q_get_persona_detail_v4_color AS (
    hex text,
    name text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_persona_detail_v4(
    persona_id uuid,
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
    persona_exists boolean,
    name text,
    description text,
    department_ids uuid[],
    active boolean,
    color text,
    icon text,
    instructions text,
    in_use boolean,
    scenario_count bigint,
    can_edit boolean,
    can_duplicate boolean,
    can_delete boolean,
    valid_department_ids uuid[],
    valid_agent_ids uuid[],
    valid_parameter_ids uuid[],
    valid_parameter_item_ids uuid[],
    linked_parameter_ids uuid[],
    parameter_field_ids uuid[],
    example_ids uuid[],
    actor_name text,
    departments types.q_get_persona_detail_v4_department[],
    agents types.q_get_persona_detail_v4_agent[],
    parameters types.q_get_persona_detail_v4_parameter[],
    fields types.q_get_persona_detail_v4_field[],
    examples types.q_get_persona_detail_v4_example[],
    examples_history types.q_get_persona_detail_v4_example_history_item[],
    preset_colors types.q_get_persona_detail_v4_color[],
    suggested_icons text[],
    valid_icons text[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        persona_id AS persona_id,
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
persona_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM personas WHERE id = (SELECT persona_id FROM params)
    )::boolean as persona_exists
),
user_profile AS (
    SELECT 
        p.role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
persona_departments_data AS (
    SELECT 
        pd.persona_id,
        ARRAY_AGG(pd.department_id ORDER BY pd.created_at) as department_ids
    FROM persona_departments pd
    WHERE pd.persona_id = (SELECT persona_id FROM params) AND pd.active = true
    GROUP BY pd.persona_id
),
persona_department_access_check AS (
    SELECT 
        p.id as persona_id,
        CASE 
            WHEN up.role = 'superadmin'::profile_role THEN true
            WHEN EXISTS (
                SELECT 1 FROM persona_departments pd 
                WHERE pd.persona_id = p.id 
                AND pd.active = true 
                AND pd.department_id IN (SELECT department_id FROM user_departments)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM persona_departments pd3 
                WHERE pd3.persona_id = p.id 
                AND pd3.active = true
            ) THEN true
            ELSE false
        END as has_access
    FROM params x
    JOIN personas p ON p.id = x.persona_id
    CROSS JOIN user_profile up
),
persona_data AS (
    SELECT 
        (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        (SELECT d.description FROM persona_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1),
        EXISTS (SELECT 1 FROM persona_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_persona_flags AND pf.value = TRUE) as active,
        (SELECT c.hex_code FROM persona_colors pc JOIN colors c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as color,
        (SELECT i.value FROM persona_icons pi JOIN icons i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as icon,
        (SELECT i.template FROM persona_instructions pi JOIN instructions i ON pi.instruction_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as instructions,
        COALESCE(pdd.department_ids, NULL) as department_ids
    FROM params x
    JOIN personas p ON p.id = x.persona_id
    LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
    INNER JOIN persona_department_access_check pdac ON pdac.persona_id = p.id AND pdac.has_access = true
),
department_mapping_data AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1), '') as description
    FROM params x
    JOIN departments d ON EXISTS (SELECT 1 FROM document_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.document_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_document_flags AND df.value = true)
    JOIN profile_departments pd ON d.id = pd.department_id AND pd.profile_id = x.profile_id AND pd.active = true
),
valid_department_ids_data AS (
    SELECT ARRAY_AGG(department_id ORDER BY name) as valid_department_ids
    FROM department_mapping_data
),
agent_mapping_data AS (
    SELECT 
        a.id as agent_id,
        (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1),
        COALESCE((SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1), '') as description,
        ARRAY[COALESCE(da.artifact::text, '')] as roles
    FROM agents a
    JOIN agent_domains adom ON adom.agent_id = a.id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
    AND da.artifact IN (CAST('scenario' AS artifacts), CAST('message' AS artifacts))
    AND (
        EXISTS (
            SELECT 1 FROM agent_departments ad 
            WHERE ad.agent_id = a.id 
            AND ad.active = true 
            AND ad.department_id IN (SELECT department_id FROM user_departments)
        )
        OR NOT EXISTS (
            SELECT 1 FROM agent_departments ad2 
            WHERE ad2.agent_id = a.id 
            AND ad2.active = true
        )
    )
),
valid_agent_ids_data AS (
    SELECT ARRAY_AGG(agent_id) as valid_agent_ids
    FROM agent_mapping_data
),
usage_data AS (
    SELECT COUNT(*) as usage_count
    FROM params x
    JOIN scenario_personas sp ON sp.persona_id = x.persona_id AND sp.active = true
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
linked_parameter_ids_data AS (
    SELECT ARRAY[]::uuid[] as linked_parameter_ids
),
field_mapping_data AS (
    SELECT 
        f.id as field_id,
        (SELECT n.name FROM field_names fn JOIN names n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        COALESCE((SELECT d.description FROM field_descriptions fd JOIN descriptions d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), '') as description,
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1),
        (SELECT n.name FROM parameter_names pn JOIN names n ON pn.name_id = n.id WHERE pn.parameter_id = pmd.parameter_id LIMIT 1) as parameter_name
    FROM parameter_mapping_data pmd
    JOIN fields f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = pmd.parameter_id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags fl ON ff.flag_id = fl.id WHERE ff.field_id = f.id AND fl.name = 'active' AND ff.type = 'active'::type_field_flags AND ff.value = true)
    JOIN parameters p ON p.id = (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1)
    WHERE EXISTS (SELECT 1 FROM persona_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_persona_flags AND pf.value = true)
),
valid_parameter_item_ids_data AS (
    SELECT ARRAY_AGG(field_id ORDER BY name) as valid_parameter_item_ids
    FROM field_mapping_data
),
parameter_field_ids_data AS (
    SELECT ARRAY[]::uuid[] as parameter_field_ids
),
persona_examples_data AS (
    SELECT 
        ARRAY_AGG(e.id ORDER BY pe.idx) as example_ids
    FROM params x
    JOIN persona_examples pe ON pe.persona_id = x.persona_id
    JOIN examples e ON e.id = pe.example_id
),
example_mapping_data AS (
    SELECT 
        e.id as example_id,
        e.example as name,
        e.example as description
    FROM params x
    JOIN persona_examples pe ON pe.persona_id = x.persona_id
    JOIN examples e ON e.id = pe.example_id
),
accessible_personas AS (
    SELECT DISTINCT p.id as persona_id
    FROM params x
    JOIN personas p ON true
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    CROSS JOIN user_profile up
    WHERE (
        up.role = 'superadmin'::profile_role
        OR pd.department_id IN (SELECT department_id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
    )
),
examples_with_departments AS (
    SELECT 
        e.example,
        COALESCE(
            ARRAY_AGG(DISTINCT pd.department_id::text) FILTER (
                WHERE pd.department_id IS NOT NULL
            ),
            ARRAY[]::text[]
        ) as department_ids
    FROM persona_examples pe
    JOIN examples e ON e.id = pe.example_id
    JOIN accessible_personas ap ON ap.persona_id = pe.persona_id
    LEFT JOIN persona_departments pd ON pd.persona_id = pe.persona_id AND pd.active = true
    WHERE e.example IS NOT NULL AND e.example != ''
    GROUP BY e.example
),
examples_history_data AS (
    SELECT COALESCE(
        (
            SELECT ARRAY_AGG(
                (example, department_ids)::types.q_get_persona_detail_v4_example_history_item
                ORDER BY example
            )
            FROM examples_with_departments
        ),
        '{}'::types.q_get_persona_detail_v4_example_history_item[]
    ) as examples_history
),
permissions_data AS (
    SELECT 
        pd.department_ids,
        ud.usage_count,
        up.role as user_role,
        CASE 
            WHEN pd.department_ids IS NULL AND up.role != 'superadmin' THEN false
            WHEN ud.usage_count > 0 THEN false
            WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_edit,
        true as can_duplicate,
        CASE 
            WHEN pd.department_ids IS NULL AND up.role != 'superadmin' THEN false
            WHEN ud.usage_count > 0 THEN false
            WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_delete
    FROM persona_data pd
    CROSS JOIN usage_data ud
    CROSS JOIN user_profile up
),
-- All preset colors (hardcoded - matches detail.py)
all_preset_colors AS (
    SELECT * FROM (VALUES
        ('#ef4444', 'Red'),
        ('#f97316', 'Orange'),
        ('#f59e0b', 'Amber'),
        ('#eab308', 'Yellow'),
        ('#84cc16', 'Lime'),
        ('#22c55e', 'Green'),
        ('#10b981', 'Emerald'),
        ('#14b8a6', 'Teal'),
        ('#06b6d4', 'Cyan'),
        ('#0ea5e9', 'Sky'),
        ('#3b82f6', 'Blue'),
        ('#6366f1', 'Indigo'),
        ('#8b5cf6', 'Violet'),
        ('#a855f7', 'Purple'),
        ('#d946ef', 'Fuchsia'),
        ('#ec4899', 'Pink'),
        ('#f43f5e', 'Rose')
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
-- All suggested icons (hardcoded - matches detail.py)
all_suggested_icons AS (
    SELECT unnest(ARRAY['Brain', 'User', 'Users', 'Sparkles', 'Zap', 'Heart', 'Star', 'MessageSquare', 'Bot', 'GraduationCap']) AS icon_name
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
-- All valid icons (hardcoded - matches detail.py)
all_valid_icons AS (
    SELECT unnest(ARRAY[
        'Brain', 'User', 'Users', 'Sparkles', 'Zap', 'Heart', 'Star', 'MessageSquare', 'Bot', 'GraduationCap',
        'Lightbulb', 'Target', 'Award', 'BookOpen', 'Code', 'Cpu', 'Database', 'FileText', 'Globe',
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
    (SELECT persona_exists FROM persona_exists_check) as persona_exists,
    -- Merge draft payload over existing persona data if draft_id provided
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        pd.name
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        pd.description
    ) as description,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'department_ids' IS NOT NULL AND jsonb_typeof(payload->'department_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids'))::uuid[]
                ELSE NULL
            END
        FROM draft_payload_data),
        pd.department_ids
    ) as department_ids,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        pd.active
    ) as active,
    COALESCE(
        (SELECT payload->>'color' FROM draft_payload_data),
        pd.color
    ) as color,
    COALESCE(
        (SELECT payload->>'icon' FROM draft_payload_data),
        pd.icon
    ) as icon,
    COALESCE(
        (SELECT payload->>'instructions' FROM draft_payload_data),
        pd.instructions
    ) as instructions,
    CASE WHEN COALESCE(ud.usage_count, 0) > 0 THEN true ELSE false END as in_use,
    COALESCE(ud.usage_count, 0) as scenario_count,
    perm.can_edit,
    perm.can_duplicate,
    perm.can_delete,
    COALESCE(vdid.valid_department_ids, ARRAY[]::uuid[]) as valid_department_ids,
    COALESCE(vaid.valid_agent_ids, ARRAY[]::uuid[]) as valid_agent_ids,
    COALESCE(vpid.valid_parameter_ids, ARRAY[]::uuid[]) as valid_parameter_ids,
    COALESCE(vpiid.valid_parameter_item_ids, ARRAY[]::uuid[]) as valid_parameter_item_ids,
    COALESCE(lpid.linked_parameter_ids, ARRAY[]::uuid[]) as linked_parameter_ids,
    COALESCE(pfid.parameter_field_ids, ARRAY[]::uuid[]) as parameter_field_ids,
    COALESCE(ped.example_ids, ARRAY[]::uuid[]) as example_ids,
    up.actor_name::text as actor_name,
    -- Aggregate departments separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description)::types.q_get_persona_detail_v4_department
            ORDER BY dmd.name
        ) FROM department_mapping_data dmd),
        '{}'::types.q_get_persona_detail_v4_department[]
    ) as departments,
    -- Aggregate agents separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (amd.agent_id, amd.name, amd.description, amd.roles)::types.q_get_persona_detail_v4_agent
            ORDER BY amd.name
        ) FROM agent_mapping_data amd),
        '{}'::types.q_get_persona_detail_v4_agent[]
    ) as agents,
    -- Aggregate parameters separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (pmd.parameter_id, pmd.name, pmd.description, pmd.numerical, 
             pmd.document_parameter, pmd.persona_parameter, pmd.scenario_parameter, pmd.video_parameter)::types.q_get_persona_detail_v4_parameter
            ORDER BY pmd.name
        ) FROM parameter_mapping_data pmd),
        '{}'::types.q_get_persona_detail_v4_parameter[]
    ) as parameters,
    -- Aggregate fields separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (fmd.field_id, fmd.name, fmd.description, fmd.parameter_id, fmd.parameter_name)::types.q_get_persona_detail_v4_field
            ORDER BY fmd.name
        ) FROM field_mapping_data fmd),
        '{}'::types.q_get_persona_detail_v4_field[]
    ) as fields,
    -- Aggregate examples separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (emd.example_id, emd.name, emd.description)::types.q_get_persona_detail_v4_example
            ORDER BY emd.name
        ) FROM example_mapping_data emd),
        '{}'::types.q_get_persona_detail_v4_example[]
    ) as examples,
    COALESCE((SELECT examples_history FROM examples_history_data), '{}'::types.q_get_persona_detail_v4_example_history_item[]) as examples_history,
    -- Filtered preset colors (SQL-side filtering)
    COALESCE(
        (SELECT ARRAY_AGG((pcf.hex, pcf.name)::types.q_get_persona_detail_v4_color ORDER BY pcf.name) FROM preset_colors_filtered pcf),
        '{}'::types.q_get_persona_detail_v4_color[]
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
    ) as valid_icons
FROM persona_data pd
CROSS JOIN usage_data ud
CROSS JOIN user_profile up
CROSS JOIN permissions_data perm
CROSS JOIN valid_department_ids_data vdid
CROSS JOIN valid_agent_ids_data vaid
CROSS JOIN valid_parameter_ids_data vpid
CROSS JOIN valid_parameter_item_ids_data vpiid
CROSS JOIN linked_parameter_ids_data lpid
CROSS JOIN parameter_field_ids_data pfid
CROSS JOIN persona_examples_data ped
CROSS JOIN examples_history_data ehd
$$;