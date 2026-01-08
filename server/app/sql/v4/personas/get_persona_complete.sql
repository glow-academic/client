-- Unified get persona function - handles both new (persona_id = NULL) and detail (persona_id provided)
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
        WHERE proname = 'api_get_persona_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_persona_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_persona_v4_department AS (
    department_id uuid
);

CREATE TYPE types.q_get_persona_v4_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

CREATE TYPE types.q_get_persona_v4_parameter AS (
    parameter_id uuid
);

CREATE TYPE types.q_get_persona_v4_field AS (
    field_id uuid
);

CREATE TYPE types.q_get_persona_v4_example AS (
    example text,
    idx integer
);

CREATE TYPE types.q_get_persona_v4_example_history_item AS (
    example text,
    department_ids text[]
);

CREATE TYPE types.q_get_persona_v4_color AS (
    hex text,
    name text
);

CREATE TYPE types.q_get_persona_v4_name_resource AS (
    id uuid,
    name text
);

CREATE TYPE types.q_get_persona_v4_color_resource AS (
    id uuid,
    name text,
    description text,
    hex_code text
);

CREATE TYPE types.q_get_persona_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon_id uuid
);

CREATE TYPE types.q_get_persona_v4_icon_resource AS (
    id uuid,
    name text,
    description text,
    value text
);

CREATE TYPE types.q_get_persona_v4_description_resource AS (
    id uuid,
    description text
);

CREATE TYPE types.q_get_persona_v4_instructions_resource AS (
    id uuid,
    template text
);

CREATE TYPE types.q_get_persona_v4_color_option AS (
    id uuid,
    name text,
    description text,
    hex_code text
);

CREATE TYPE types.q_get_persona_v4_icon_option AS (
    id uuid,
    name text,
    description text,
    value text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_persona_v4(
    profile_id uuid,
    persona_id uuid DEFAULT NULL,
    color_search text DEFAULT NULL,
    icon_search text DEFAULT NULL,
    color_show_selected boolean DEFAULT NULL,
    icon_show_selected boolean DEFAULT NULL,
    current_color text DEFAULT NULL,
    current_icon text DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Common fields (always returned)
    actor_name text,
    valid_department_ids uuid[],
    valid_agent_ids uuid[],
    valid_parameter_ids uuid[],
    valid_parameter_item_ids uuid[],
    departments types.q_get_persona_v4_department[],
    agents types.q_get_persona_v4_agent[],
    parameters types.q_get_persona_v4_parameter[],
    fields types.q_get_persona_v4_field[],
    color_options types.q_get_persona_v4_color_option[],
    icon_options types.q_get_persona_v4_icon_option[],
    color_suggestions uuid[],
    icon_suggestions uuid[],
    name_suggestions text[],
    description_suggestions text[],
    instructions_suggestions text[],
    -- Conditional fields (different for new vs detail)
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
    -- Detail-only fields (NULL for new)
    linked_parameter_ids uuid[],
    parameter_field_ids uuid[],
    example_ids uuid[],
    examples types.q_get_persona_v4_example[],
    examples_history types.q_get_persona_v4_example_history_item[],
    -- New-only fields (NULL for detail)
    user_role text,
    primary_department_id uuid,
    -- Resource fields (always returned)
    name_id uuid,
    description_id uuid,
    color_id uuid,
    icon_id uuid,
    instructions_id uuid,
    active_flag_id uuid,
    name_resource types.q_get_persona_v4_name_resource,
    description_resource types.q_get_persona_v4_description_resource,
    color_resource types.q_get_persona_v4_color_resource,
    icon_resource types.q_get_persona_v4_icon_resource,
    instructions_resource types.q_get_persona_v4_instructions_resource,
    flag_resource types.q_get_persona_v4_flag_resource
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
-- Conditional: Only check persona existence if persona_id provided
persona_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM personas WHERE id = (SELECT persona_id FROM params))::boolean
        END as persona_exists
),
-- Draft data is now stored in draft_* junction tables, not in payload
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload
    FROM params x
    WHERE x.draft_id IS NOT NULL
    LIMIT 1
),
user_profile AS (
    SELECT 
        p.role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Conditional: Get persona data only if persona_id provided
persona_departments_data AS (
    SELECT 
        pd.persona_id,
        ARRAY_AGG(pd.department_id ORDER BY pd.created_at) as department_ids
    FROM params x
    JOIN persona_departments pd ON pd.persona_id = x.persona_id AND pd.active = true
    WHERE x.persona_id IS NOT NULL
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
    WHERE x.persona_id IS NOT NULL
),
persona_data AS (
    SELECT 
        (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as name,
        (SELECT d.description FROM persona_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM persona_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_persona_flags AND pf.value = TRUE) as active,
        (SELECT c.hex_code FROM persona_colors pc JOIN colors c ON pc.color_id = c.id WHERE pc.persona_id = p.id LIMIT 1) as color,
        (SELECT i.value FROM persona_icons pi JOIN icons i ON pi.icon_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as icon,
        (SELECT i.template FROM persona_instructions pi JOIN instructions i ON pi.instruction_id = i.id WHERE pi.persona_id = p.id LIMIT 1) as instructions,
        COALESCE(pdd.department_ids, NULL) as department_ids
    FROM params x
    JOIN personas p ON p.id = x.persona_id
    LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
    INNER JOIN persona_department_access_check pdac ON pdac.persona_id = p.id AND pdac.has_access = true
    WHERE x.persona_id IS NOT NULL
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
-- Conditional: Usage data only for detail
usage_data AS (
    SELECT 
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN 0::bigint
            ELSE COUNT(*)::bigint
        END as usage_count
    FROM params x
    LEFT JOIN scenario_personas sp ON sp.persona_id = x.persona_id AND sp.active = true
    WHERE x.persona_id IS NOT NULL
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
    SELECT 
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE ARRAY[]::uuid[]
        END as linked_parameter_ids
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
-- Conditional: Parameter field IDs only for detail
parameter_field_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE ARRAY_AGG(pf.field_id ORDER BY pf.created_at)
        END as parameter_field_ids
    FROM params x
    LEFT JOIN persona_fields pf ON pf.persona_id = x.persona_id AND pf.active = true
    WHERE x.persona_id IS NOT NULL
),
-- Conditional: Examples only for detail
persona_examples_data AS (
    SELECT 
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE ARRAY_AGG(e.id ORDER BY pe.idx)
        END as example_ids
    FROM params x
    LEFT JOIN persona_examples pe ON pe.persona_id = x.persona_id AND pe.active = true
    LEFT JOIN examples e ON e.id = pe.example_id
    WHERE x.persona_id IS NOT NULL
),
example_mapping_data AS (
    SELECT 
        e.example,
        pe.idx
    FROM params x
    JOIN persona_examples pe ON pe.persona_id = x.persona_id AND pe.active = true
    JOIN examples e ON e.id = pe.example_id
    WHERE x.persona_id IS NOT NULL
    ORDER BY pe.idx
),
accessible_personas AS (
    SELECT DISTINCT p.id as persona_id
    FROM params x
    JOIN personas p ON true
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    CROSS JOIN user_profile up
    WHERE x.persona_id IS NOT NULL
      AND (
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
    WHERE pe.active = true AND e.example IS NOT NULL AND e.example != ''
    GROUP BY e.example
),
examples_history_data AS (
    SELECT 
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN '{}'::types.q_get_persona_v4_example_history_item[]
            ELSE COALESCE(
                (
                    SELECT ARRAY_AGG(
                        (example, department_ids)::types.q_get_persona_v4_example_history_item
                        ORDER BY example
                    )
                    FROM examples_with_departments
                ),
                '{}'::types.q_get_persona_v4_example_history_item[]
            )
        END as examples_history
),
permissions_data AS (
    SELECT 
        pd.department_ids,
        ud.usage_count,
        up.role as user_role,
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN
                -- New mode permissions
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    WHEN (SELECT department_id FROM primary_department_id_data) IS NOT NULL THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode permissions
                CASE 
                    WHEN pd.department_ids IS NULL AND up.role != 'superadmin' THEN false
                    WHEN ud.usage_count > 0 THEN false
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
                    ELSE false
                END
        END as can_edit,
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN false
            ELSE true
        END as can_duplicate,
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN false
            ELSE CASE 
                WHEN pd.department_ids IS NULL AND up.role != 'superadmin' THEN false
                WHEN ud.usage_count > 0 THEN false
                WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
                ELSE false
            END
        END as can_delete
    FROM params x
    LEFT JOIN persona_data pd ON true
    CROSS JOIN usage_data ud
    CROSS JOIN user_profile up
),
-- Color options from database
color_options_data AS (
    SELECT 
        c.id,
        c.name,
        c.description,
        c.hex_code
    FROM colors c
    CROSS JOIN params p
    WHERE 
        -- Search filter: if color_search provided, match name or hex_code
        (p.color_search IS NULL OR p.color_search = '' OR
         LOWER(c.name) LIKE '%' || LOWER(p.color_search) || '%' OR
         LOWER(c.hex_code) LIKE '%' || LOWER(p.color_search) || '%')
        -- Show selected filter: if enabled and current_color provided, only show current color
        AND (
            NOT p.color_show_selected OR
            p.current_color IS NULL OR
            UPPER(c.hex_code) = UPPER(COALESCE(p.current_color, ''))
        )
    ORDER BY c.name
),
-- Icon options from database
icon_options_data AS (
    SELECT 
        i.id,
        i.name,
        i.description,
        i.value
    FROM icons i
    CROSS JOIN params p
    WHERE 
        -- Search filter: if icon_search provided, match name or value
        (p.icon_search IS NULL OR p.icon_search = '' OR
         LOWER(i.name) LIKE '%' || LOWER(p.icon_search) || '%' OR
         LOWER(i.value) LIKE '%' || LOWER(p.icon_search) || '%')
        -- Show selected filter: if enabled and current_icon provided, only show current icon
        AND (
            NOT p.icon_show_selected OR
            p.current_icon IS NULL OR
            LOWER(i.value) = LOWER(COALESCE(p.current_icon, ''))
        )
    ORDER BY i.name
),
-- Icon suggestions based on historical usage (most frequently used icons)
icon_suggestions_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(icon_id ORDER BY usage_count DESC),
            ARRAY[]::uuid[]
        ) as icon_suggestions
    FROM (
        SELECT 
            pi.icon_id,
            COUNT(*) as usage_count
        FROM persona_icons pi
        WHERE pi.icon_id IS NOT NULL
        GROUP BY pi.icon_id
        ORDER BY usage_count DESC
        LIMIT 10
    ) icon_usage
),
-- Name suggestions based on historical usage
name_suggestions_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(name_usage.name ORDER BY name_usage.max_created_at DESC),
            ARRAY[]::text[]
        ) as name_suggestions
    FROM (
        SELECT DISTINCT
            n.name,
            MAX(pn.created_at) as max_created_at
        FROM persona_names pn
        JOIN names n ON pn.name_id = n.id
        WHERE n.name IS NOT NULL AND n.name != ''
        GROUP BY n.name
        ORDER BY MAX(pn.created_at) DESC
        LIMIT 20
    ) name_usage
),
-- Description suggestions based on historical usage
description_suggestions_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(desc_usage.description ORDER BY desc_usage.max_created_at DESC),
            ARRAY[]::text[]
        ) as description_suggestions
    FROM (
        SELECT DISTINCT
            d.description,
            MAX(pd.created_at) as max_created_at
        FROM persona_descriptions pd
        JOIN descriptions d ON pd.description_id = d.id
        WHERE d.description IS NOT NULL AND d.description != ''
        GROUP BY d.description
        ORDER BY MAX(pd.created_at) DESC
        LIMIT 20
    ) desc_usage
),
-- Instructions suggestions based on historical usage
instructions_suggestions_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(inst_usage.template ORDER BY inst_usage.max_created_at DESC),
            ARRAY[]::text[]
        ) as instructions_suggestions
    FROM (
        SELECT DISTINCT
            i.template,
            MAX(pi.created_at) as max_created_at
        FROM persona_instructions pi
        JOIN instructions i ON pi.instruction_id = i.id
        WHERE i.active = true AND i.template IS NOT NULL AND i.template != ''
        GROUP BY i.template
        ORDER BY MAX(pi.created_at) DESC
        LIMIT 20
    ) inst_usage
),
-- Resource data CTEs - query from persona_* tables or draft_* tables if draft_id provided
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT n.id FROM draft_names dn JOIN names n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pn.name_id FROM persona_names pn WHERE pn.persona_id = (SELECT persona_id FROM params) LIMIT 1)
        ) as name_id,
        (
            SELECT ROW(n.id, n.name)::types.q_get_persona_v4_name_resource 
            FROM (
                SELECT n.id, n.name, 1 as priority
                FROM draft_names dn 
                JOIN names n ON dn.names_id = n.id 
                WHERE dn.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT n.id, n.name, 2 as priority
                FROM persona_names pn 
                JOIN names n ON pn.name_id = n.id 
                WHERE pn.persona_id = (SELECT persona_id FROM params)
            ) n
            ORDER BY priority
            LIMIT 1
        ) as name_resource
    FROM params
    WHERE (SELECT draft_id FROM params) IS NOT NULL OR (SELECT persona_id FROM params) IS NOT NULL
),
description_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dd.descriptions_id FROM draft_descriptions dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pd.description_id FROM persona_descriptions pd WHERE pd.persona_id = (SELECT persona_id FROM params) LIMIT 1)
        ) as description_id,
        (SELECT ROW(d.id, d.description)::types.q_get_persona_v4_description_resource FROM draft_descriptions dd JOIN descriptions d ON dd.descriptions_id = d.id WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_description_resource,
        (SELECT ROW(d.id, d.description)::types.q_get_persona_v4_description_resource FROM persona_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.persona_id = (SELECT persona_id FROM params) LIMIT 1) as persona_description_resource
    FROM params
    WHERE (SELECT draft_id FROM params) IS NOT NULL OR (SELECT persona_id FROM params) IS NOT NULL
),
color_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dc.colors_id FROM draft_colors dc WHERE dc.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pc.color_id FROM persona_colors pc WHERE pc.persona_id = (SELECT persona_id FROM params) LIMIT 1)
        ) as color_id,
        (SELECT ROW(c.id, c.name, c.description, c.hex_code)::types.q_get_persona_v4_color_resource FROM draft_colors dc JOIN colors c ON dc.colors_id = c.id WHERE dc.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_color_resource,
        (SELECT ROW(c.id, c.name, c.description, c.hex_code)::types.q_get_persona_v4_color_resource FROM persona_colors pc JOIN colors c ON pc.color_id = c.id WHERE pc.persona_id = (SELECT persona_id FROM params) LIMIT 1) as persona_color_resource
    FROM params
    WHERE (SELECT draft_id FROM params) IS NOT NULL OR (SELECT persona_id FROM params) IS NOT NULL
),
icon_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT di.icons_id FROM draft_icons di WHERE di.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pi.icon_id FROM persona_icons pi WHERE pi.persona_id = (SELECT persona_id FROM params) LIMIT 1)
        ) as icon_id,
        (SELECT ROW(i.id, i.name, i.description, i.value)::types.q_get_persona_v4_icon_resource FROM draft_icons di JOIN icons i ON di.icons_id = i.id WHERE di.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_icon_resource,
        (SELECT ROW(i.id, i.name, i.description, i.value)::types.q_get_persona_v4_icon_resource FROM persona_icons pi JOIN icons i ON pi.icon_id = i.id WHERE pi.persona_id = (SELECT persona_id FROM params) LIMIT 1) as persona_icon_resource
    FROM params
    WHERE (SELECT draft_id FROM params) IS NOT NULL OR (SELECT persona_id FROM params) IS NOT NULL
),
instructions_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dinst.instructions_id FROM draft_instructions dinst WHERE dinst.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pinst.instruction_id FROM persona_instructions pinst WHERE pinst.persona_id = (SELECT persona_id FROM params) LIMIT 1)
        ) as instructions_id,
        (SELECT ROW(inst.id, inst.template)::types.q_get_persona_v4_instructions_resource FROM draft_instructions dinst JOIN instructions inst ON dinst.instructions_id = inst.id WHERE dinst.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_instructions_resource,
        (SELECT ROW(inst.id, inst.template)::types.q_get_persona_v4_instructions_resource FROM persona_instructions pinst JOIN instructions inst ON pinst.instruction_id = inst.id WHERE pinst.persona_id = (SELECT persona_id FROM params) LIMIT 1) as persona_instructions_resource
    FROM params
    WHERE (SELECT draft_id FROM params) IS NOT NULL OR (SELECT persona_id FROM params) IS NOT NULL
),
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id FROM draft_flags df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pf.flag_id FROM persona_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.persona_id = (SELECT persona_id FROM params) AND fl.name = 'active' AND pf.type = 'active'::type_persona_flags AND pf.value = TRUE LIMIT 1)
        ) as active_flag_id,
        (SELECT ROW(f.id, f.name, f.description, f.icon_id)::types.q_get_persona_v4_flag_resource FROM draft_flags df JOIN flags f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_flag_resource,
        (SELECT ROW(f.id, f.name, f.description, f.icon_id)::types.q_get_persona_v4_flag_resource FROM persona_flags pf JOIN flags f ON pf.flag_id = f.id JOIN flags fl ON pf.flag_id = fl.id WHERE pf.persona_id = (SELECT persona_id FROM params) AND fl.name = 'active' AND pf.type = 'active'::type_persona_flags AND pf.value = TRUE LIMIT 1) as persona_flag_resource
    FROM params
    WHERE (SELECT draft_id FROM params) IS NOT NULL OR (SELECT persona_id FROM params) IS NOT NULL
)
SELECT
    -- Common fields
    up.actor_name::text as actor_name,
    COALESCE(vdid.valid_department_ids, ARRAY[]::uuid[]) as valid_department_ids,
    COALESCE(vaid.valid_agent_ids, ARRAY[]::uuid[]) as valid_agent_ids,
    COALESCE(vpid.valid_parameter_ids, ARRAY[]::uuid[]) as valid_parameter_ids,
    COALESCE(vpiid.valid_parameter_item_ids, ARRAY[]::uuid[]) as valid_parameter_item_ids,
    -- Aggregate departments separately (only IDs)
    COALESCE(
        (SELECT ARRAY_AGG(
            ROW(dmd.department_id)::types.q_get_persona_v4_department
            ORDER BY dmd.name
        ) FROM department_mapping_data dmd),
        '{}'::types.q_get_persona_v4_department[]
    ) as departments,
    -- Aggregate agents separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (amd.agent_id, amd.name, amd.description, amd.roles)::types.q_get_persona_v4_agent
            ORDER BY amd.name
        ) FROM agent_mapping_data amd),
        '{}'::types.q_get_persona_v4_agent[]
    ) as agents,
    -- Aggregate parameters separately (only IDs)
    COALESCE(
        (SELECT ARRAY_AGG(
            ROW(pmd.parameter_id)::types.q_get_persona_v4_parameter
            ORDER BY pmd.name
        ) FROM parameter_mapping_data pmd),
        '{}'::types.q_get_persona_v4_parameter[]
    ) as parameters,
    -- Aggregate fields separately (only IDs)
    COALESCE(
        (SELECT ARRAY_AGG(
            ROW(fmd.field_id)::types.q_get_persona_v4_field
            ORDER BY fmd.name
        ) FROM field_mapping_data fmd),
        '{}'::types.q_get_persona_v4_field[]
    ) as fields,
    -- Color options from database
    COALESCE(
        (SELECT ARRAY_AGG(
            (cod.id, cod.name, cod.description, cod.hex_code)::types.q_get_persona_v4_color_option
            ORDER BY cod.name
        ) FROM color_options_data cod),
        '{}'::types.q_get_persona_v4_color_option[]
    ) as color_options,
    -- Icon options from database
    COALESCE(
        (SELECT ARRAY_AGG(
            (iod.id, iod.name, iod.description, iod.value)::types.q_get_persona_v4_icon_option
            ORDER BY iod.name
        ) FROM icon_options_data iod),
        '{}'::types.q_get_persona_v4_icon_option[]
    ) as icon_options,
    -- Color suggestions (empty for now, can be populated with AI recommendations later)
    ARRAY[]::uuid[] as color_suggestions,
    -- Icon suggestions based on historical usage
    COALESCE(
        (SELECT icon_suggestions FROM icon_suggestions_data),
        ARRAY[]::uuid[]
    ) as icon_suggestions,
    -- Name suggestions based on historical usage
    COALESCE(
        (SELECT name_suggestions FROM name_suggestions_data),
        ARRAY[]::text[]
    ) as name_suggestions,
    -- Description suggestions based on historical usage
    COALESCE(
        (SELECT description_suggestions FROM description_suggestions_data),
        ARRAY[]::text[]
    ) as description_suggestions,
    -- Instructions suggestions based on historical usage
    COALESCE(
        (SELECT instructions_suggestions FROM instructions_suggestions_data),
        ARRAY[]::text[]
    ) as instructions_suggestions,
    -- Conditional fields
    (SELECT persona_exists FROM persona_exists_check) as persona_exists,
    -- Merge draft payload over existing persona data if draft_id provided, otherwise use defaults for new or existing data
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN ''::text
            ELSE pd.name
        END
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN ''::text
            ELSE pd.description
        END
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
            WHEN (SELECT persona_id FROM params) IS NULL THEN
                CASE 
                    WHEN up.role = 'superadmin' THEN NULL::uuid[]
                    ELSE COALESCE(ARRAY[(SELECT department_id FROM primary_department_id_data)], ARRAY[]::uuid[])
                END
            ELSE pd.department_ids
        END
    ) as department_ids,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN true::boolean
            ELSE pd.active
        END
    ) as active,
    COALESCE(
        (SELECT payload->>'color' FROM draft_payload_data),
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN NULL::text
            ELSE pd.color
        END
    ) as color,
    COALESCE(
        (SELECT payload->>'icon' FROM draft_payload_data),
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN NULL::text
            ELSE pd.icon
        END
    ) as icon,
    COALESCE(
        (SELECT payload->>'instructions' FROM draft_payload_data),
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN ''::text
            ELSE pd.instructions
        END
    ) as instructions,
    CASE 
        WHEN (SELECT persona_id FROM params) IS NULL THEN false
        ELSE CASE WHEN COALESCE(ud.usage_count, 0) > 0 THEN true ELSE false END
    END as in_use,
    COALESCE(ud.usage_count, 0) as scenario_count,
    perm.can_edit,
    perm.can_duplicate,
    perm.can_delete,
    -- Detail-only fields (NULL for new)
    COALESCE(lpid.linked_parameter_ids, ARRAY[]::uuid[]) as linked_parameter_ids,
    COALESCE(pfid.parameter_field_ids, ARRAY[]::uuid[]) as parameter_field_ids,
    COALESCE(ped.example_ids, ARRAY[]::uuid[]) as example_ids,
    -- Aggregate examples separately (example text and idx) - only for detail
    CASE 
        WHEN (SELECT persona_id FROM params) IS NULL THEN '{}'::types.q_get_persona_v4_example[]
        ELSE COALESCE(
            (SELECT ARRAY_AGG(
                (emd.example, emd.idx)::types.q_get_persona_v4_example
                ORDER BY emd.idx
            ) FROM example_mapping_data emd),
            '{}'::types.q_get_persona_v4_example[]
        )
    END as examples,
    COALESCE((SELECT examples_history FROM examples_history_data), '{}'::types.q_get_persona_v4_example_history_item[]) as examples_history,
    -- New-only fields (NULL for detail)
    CASE 
        WHEN (SELECT persona_id FROM params) IS NULL THEN up.role::text
        ELSE NULL::text
    END as user_role,
    CASE 
        WHEN (SELECT persona_id FROM params) IS NULL THEN (SELECT department_id FROM primary_department_id_data)
        ELSE NULL::uuid
    END as primary_department_id,
    -- Resource IDs for form state
    (SELECT name_id FROM name_resource_data) as name_id,
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT color_id FROM color_resource_data) as color_id,
    (SELECT icon_id FROM icon_resource_data) as icon_id,
    (SELECT instructions_id FROM instructions_resource_data) as instructions_id,
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    -- Resource composite types
    nrd.name_resource,
    (SELECT desc_res FROM (SELECT drd.draft_description_resource as desc_res UNION ALL SELECT drd.persona_description_resource LIMIT 1) sub WHERE desc_res IS NOT NULL LIMIT 1) as description_resource,
    (SELECT color_res FROM (SELECT crd.draft_color_resource as color_res UNION ALL SELECT crd.persona_color_resource LIMIT 1) sub WHERE color_res IS NOT NULL LIMIT 1) as color_resource,
    (SELECT icon_res FROM (SELECT ird.draft_icon_resource as icon_res UNION ALL SELECT ird.persona_icon_resource LIMIT 1) sub WHERE icon_res IS NOT NULL LIMIT 1) as icon_resource,
    (SELECT inst_res FROM (SELECT instrd.draft_instructions_resource as inst_res UNION ALL SELECT instrd.persona_instructions_resource LIMIT 1) sub WHERE inst_res IS NOT NULL LIMIT 1) as instructions_resource,
    (SELECT flag_res FROM (SELECT frd.draft_flag_resource as flag_res UNION ALL SELECT frd.persona_flag_resource LIMIT 1) sub WHERE flag_res IS NOT NULL LIMIT 1) as flag_resource
FROM user_profile up
CROSS JOIN valid_department_ids_data vdid
CROSS JOIN valid_agent_ids_data vaid
CROSS JOIN valid_parameter_ids_data vpid
CROSS JOIN valid_parameter_item_ids_data vpiid
CROSS JOIN linked_parameter_ids_data lpid
CROSS JOIN parameter_field_ids_data pfid
CROSS JOIN persona_examples_data ped
CROSS JOIN examples_history_data ehd
CROSS JOIN permissions_data perm
CROSS JOIN usage_data ud
LEFT JOIN persona_data pd ON true
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN color_resource_data crd
CROSS JOIN icon_resource_data ird
CROSS JOIN instructions_resource_data instrd
CROSS JOIN flag_resource_data frd
CROSS JOIN icon_suggestions_data isd
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_suggestions_data dsd
CROSS JOIN instructions_suggestions_data insd
$$;
