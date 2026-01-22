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
    department_id uuid,
    name text,
    description text,
    generated boolean
);


CREATE TYPE types.q_get_persona_v4_field AS (
    field_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_persona_v4_example AS (
    id uuid,
    example text,
    idx integer,
    generated boolean
);


CREATE TYPE types.q_get_persona_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_persona_v4_color_resource AS (
    id uuid,
    name text,
    description text,
    hex_code text,
    generated boolean
);

CREATE TYPE types.q_get_persona_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon_id uuid,
    generated boolean
);

CREATE TYPE types.q_get_persona_v4_icon_resource AS (
    id uuid,
    name text,
    description text,
    value text,
    generated boolean
);

CREATE TYPE types.q_get_persona_v4_description_resource AS (
    id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_persona_v4_instructions_resource AS (
    id uuid,
    template text,
    generated boolean
);

CREATE TYPE types.q_get_persona_v4_color_option AS (
    id uuid,
    name text,
    description text,
    hex_code text,
    generated boolean
);

CREATE TYPE types.q_get_persona_v4_icon_option AS (
    id uuid,
    name text,
    description text,
    value text,
    generated boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_persona_v4(
    profile_id uuid,
    persona_id uuid DEFAULT NULL,
    color_search text DEFAULT NULL,
    icon_search text DEFAULT NULL,
    color_show_selected boolean DEFAULT NULL,
    icon_show_selected boolean DEFAULT NULL,
    descriptions_search text DEFAULT NULL,
    instructions_search text DEFAULT NULL,
    field_search text DEFAULT NULL,
    field_show_selected boolean DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 4)
    actor_name text,
    persona_exists boolean,
    can_edit boolean,
    disabled_reason text,
    draft_version int,
    -- Group ID for linking resources
    group_id uuid,
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_persona_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_persona_v4_name_resource[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_persona_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_persona_v4_description_resource[],
    -- Single-select resources: color
    color_id uuid,
    color_resource types.q_get_persona_v4_color_resource,
    show_color boolean,
    color_agent_id uuid,
    color_required boolean,
    color_suggestions uuid[],
    colors types.q_get_persona_v4_color_option[],
    -- Single-select resources: icon
    icon_id uuid,
    icon_resource types.q_get_persona_v4_icon_resource,
    show_icon boolean,
    icon_agent_id uuid,
    icon_required boolean,
    icon_suggestions uuid[],
    icons types.q_get_persona_v4_icon_option[],
    -- Single-select resources: instructions
    instructions_id uuid,
    instructions_resource types.q_get_persona_v4_instructions_resource,
    show_instructions boolean,
    instructions_agent_id uuid,
    instructions_required boolean,
    instructions_suggestions uuid[],
    instructions types.q_get_persona_v4_instructions_resource[],
    -- Single-select resources: flag
    active_flag_id uuid,
    flag_resource types.q_get_persona_v4_flag_resource,
    show_flag boolean,
    flag_agent_id uuid,
    flag_required boolean,
    flags types.q_get_persona_v4_flag_resource[],
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_persona_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_persona_v4_department[],
    -- Multi-select resources: fields
    field_ids uuid[],
    field_resources types.q_get_persona_v4_field[],
    show_fields boolean,
    fields_agent_id uuid,
    fields_required boolean,
    field_suggestions uuid[],
    fields types.q_get_persona_v4_field[],
    -- Multi-select resources: examples
    example_ids uuid[],
    example_resources types.q_get_persona_v4_example[],
    show_examples boolean,
    examples_agent_id uuid,
    examples_required boolean,
    example_suggestions uuid[],
    examples types.q_get_persona_v4_example[],
    -- Multi-resource combination agent IDs
    basic_agent_id uuid,
    content_agent_id uuid,
    general_agent_id uuid
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
        descriptions_search AS descriptions_search,
        instructions_search AS instructions_search,
        field_search AS field_search,
        COALESCE(field_show_selected, false) AS field_show_selected,
        draft_id AS draft_id,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check persona existence if persona_id provided
persona_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM persona_artifact WHERE id = (SELECT persona_id FROM params))::boolean
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
-- Get group_id from draft (should always exist after migration, but handle NULL case)
draft_group_data AS (
    SELECT 
        COALESCE(
            d.group_id,
            (SELECT id FROM groups ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params x
    LEFT JOIN drafts_entry d ON d.id = x.draft_id
    -- Always return at least one row (use COALESCE to handle NULL draft_id case)
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
    SELECT 
        (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Conditional: Get persona department data only if persona_id provided
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
    JOIN personas_resource p ON p.id = x.persona_id
    CROSS JOIN user_profile up
    WHERE x.persona_id IS NOT NULL
),
department_mapping_data AS (
    SELECT
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.department_id LIMIT 1), '') as description,
        COALESCE(d.generated, false) as generated
    FROM params x
    CROSS JOIN user_profile up
    JOIN departments_resource d ON (
        -- Only include departments with active flag AND user is linked to them
        EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
        AND
        EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
    )
),
primary_department_id_data AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.is_primary = TRUE
    LIMIT 1
),
-- Active departments for user (departments with active flag that user is linked to)
active_departments_data AS (
    SELECT ARRAY_AGG(DISTINCT d.id) as department_ids
    FROM params x
    JOIN departments_resource d ON EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
    WHERE EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
),
-- Field suggestions: linked to personas with active=true OR same group with generated=true
-- NOTE: Must be defined before field_mapping_data and valid_fields_data which reference it
field_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pf.field_id ORDER BY pf.created_at DESC)
             FROM (
                 SELECT DISTINCT pf.field_id, MAX(pf.created_at) as created_at
                FROM persona_fields pf
                JOIN fields_resource f ON f.id = pf.field_id
                CROSS JOIN draft_group_data dgd
                WHERE pf.field_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f.field_id AND fl.name = 'field_active' AND ff.value = true)
                   AND (
                       -- Option 1: Linked to personas with active=true
                       pf.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           pf.generated = true
                           AND f.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN messages m ON m.id = c.message_id
                               JOIN runs r ON r.id = m.run_id
                               WHERE c.id = f.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY pf.field_id
                 ORDER BY MAX(pf.created_at) DESC
                 LIMIT 20
             ) pf),
            ARRAY[]::uuid[]
        ) as field_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Simplified parameter_mapping_data - only used for field_mapping_data
parameter_mapping_data AS (
    SELECT 
        p.id as parameter_id,
        (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM parameter_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1), '') as description,
        false as numerical,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'document_parameter' AND pf.value = TRUE) as document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'persona_parameter' AND pf.value = TRUE) as persona_parameter,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'scenario_parameter' AND pf.value = TRUE) as scenario_parameter,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'video_parameter' AND pf.value = TRUE) as video_parameter
    FROM parameter_artifact p
    WHERE EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND pf.value = true) 
      AND EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'persona_parameter' AND pf.value = true)
),
field_mapping_data AS (
    SELECT 
        f.id as field_id,
        (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.field_id LIMIT 1),
        COALESCE((SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.field_id LIMIT 1), '') as description,
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_resource_id = f.id LIMIT 1),
        (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = pmd.parameter_id LIMIT 1) as parameter_name,
        COALESCE(f.generated, false) as generated,
        -- Add sort priority: suggested fields first (1), then others (2)
        CASE 
            WHEN f.id = ANY(fsd_for_map.field_suggestions) THEN 1
            ELSE 2
        END as sort_priority
    FROM parameter_mapping_data pmd
    CROSS JOIN field_suggestions_data fsd_for_map
    JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_resource_id = f.id LIMIT 1) = pmd.parameter_id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource fl ON ff.flag_id = fl.id WHERE ff.field_id = f.field_id AND fl.name = 'field_active' AND ff.value = true)
    JOIN parameters_resource p ON p.id = (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_resource_id = f.id LIMIT 1)
    WHERE EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.parameter_id = p.id AND f.name = 'parameter_active' AND pf.value = true)
),
-- Valid fields data for new personas (based on departments, similar to documents endpoint)
valid_fields_data AS (
    SELECT DISTINCT
        f.id as field_id,
        (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.field_id LIMIT 1),
        COALESCE((SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.field_id LIMIT 1), '') as description,
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_resource_id = f.id LIMIT 1) as parameter_id,
        (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_resource_id = f.id LIMIT 1) LIMIT 1) as parameter_name,
        COALESCE(f.generated, false) as generated,
        -- Add sort priority: suggested fields first (1), then others (2)
        CASE 
            WHEN f.id = ANY(fsd_for_sort.field_suggestions) THEN 1
            ELSE 2
        END as sort_priority
    FROM params x
    CROSS JOIN user_profile up
    CROSS JOIN field_suggestions_data fsd_for_sort
    LEFT JOIN parameter_fields pf_pf ON pf_pf.parameter_id IN (
        SELECT p.id FROM parameter_artifact p 
        WHERE EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'parameter_active' AND pf.value = TRUE)
          AND EXISTS (SELECT 1 FROM parameter_flags pf2 JOIN flags_resource fl2 ON pf2.flag_id = fl2.id WHERE pf2.parameter_id = p.id AND fl2.name = 'persona_parameter' AND pf2.value = TRUE)
    )
    LEFT JOIN fields_resource f ON f.id = pf_pf.field_resource_id AND EXISTS (SELECT 1 FROM field_flags ff JOIN flags_resource fl3 ON ff.flag_id = fl3.id WHERE ff.field_id = f.field_id AND fl3.name = 'field_active' AND ff.value = true)
    LEFT JOIN field_departments fd ON fd.field_id = f.field_id AND fd.active = true
    WHERE x.persona_id IS NULL
      AND f.id IS NOT NULL  -- Filter out NULL fields
      AND (
        -- If user has no departments (superadmin), include only cross-department fields
        (NOT EXISTS (SELECT 1 FROM user_departments) AND up.role = 'superadmin'::profile_role
         AND NOT EXISTS (
             SELECT 1 FROM field_departments fd2 
             WHERE fd2.field_id = f.field_id 
                 AND fd2.active = true
         ))
        OR
        -- If user has departments, include fields from those departments OR cross-department fields
        (EXISTS (SELECT 1 FROM user_departments)
         AND (
             -- Field is in a department the user has access to
             EXISTS (
                 SELECT 1 FROM field_departments fd2
                 WHERE fd2.field_id = f.field_id
                   AND fd2.active = true
                   AND fd2.department_id IN (SELECT department_id FROM user_departments)
             )
             OR
             -- Field is cross-department (not in any department)
             NOT EXISTS (
                 SELECT 1 FROM field_departments fd2 
                 WHERE fd2.field_id = f.field_id 
                 AND fd2.active = true
             )
         ))
      )
),
ui_flags AS (
    SELECT 
        -- Single-select resource flags (based on whether options exist)
        true as show_name,  -- Always show name picker
        true as show_description,  -- Always show description picker
        -- show_color and show_icon will be computed later using colors_data and icons_data
        true as show_color,  -- Will be updated in SELECT to check colors array
        true as show_icon,  -- Will be updated in SELECT to check icons array
        true as show_instructions,  -- Always show instructions picker
        true as show_flag,  -- Flag is a boolean toggle that should be shown
        -- Multi-select resource flags (based on business logic)
        CASE 
            WHEN (SELECT COUNT(*) FROM department_mapping_data) > 0 THEN true
            ELSE false
        END as show_departments,
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN
                -- For new personas, check valid_fields_data
                CASE 
                    WHEN (SELECT COUNT(*) FROM valid_fields_data) > 0 THEN true
                    ELSE false
                END
            ELSE
                -- For existing personas, check field_mapping_data
                CASE 
                    WHEN (SELECT COUNT(*) FROM field_mapping_data) > 0 THEN true
                    ELSE false
                END
        END as show_fields
        -- show_examples will be computed in SELECT clause
    FROM params x
    CROSS JOIN user_profile up
),
-- Field IDs (selected field IDs for persona)
field_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pf.field_id ORDER BY pf.created_at)
                 FROM persona_fields pf
                 WHERE pf.persona_id = (SELECT persona_id FROM params)
                   AND pf.active = true),
                ARRAY[]::uuid[]
            )
        END as field_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Example IDs (selected example IDs for persona)
persona_examples_data AS (
    SELECT 
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(e.id ORDER BY pe.idx)
                 FROM persona_examples pe
                 JOIN examples_resource e ON e.id = pe.example_id
                 WHERE pe.persona_id = (SELECT persona_id FROM params)
                   AND pe.active = true),
                ARRAY[]::uuid[]
            )
        END as example_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Example mapping (for examples array - persona-scoped, includes id)
example_mapping_data AS (
    SELECT 
        e.id,
        e.example,
        pe.idx,
        COALESCE(e.generated, false) as generated
    FROM params x
    LEFT JOIN persona_examples pe ON pe.persona_id = x.persona_id AND pe.active = true
    LEFT JOIN examples_resource e ON e.id = pe.example_id
    WHERE x.persona_id IS NOT NULL AND e.example IS NOT NULL
    ORDER BY pe.idx
),
accessible_personas AS (
    SELECT DISTINCT p.id as persona_id
    FROM params x
    JOIN personas_resource p ON true
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    CROSS JOIN user_profile up
    WHERE x.persona_id IS NOT NULL
      AND (
        up.role = 'superadmin'::profile_role
        OR pd.department_id IN (SELECT department_id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
      )
),
-- Example suggestions: linked to personas with active=true OR same group with generated=true
example_suggestions_data AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(pe.example_id ORDER BY pe.created_at DESC)
                FROM (
                    SELECT DISTINCT pe.example_id, MAX(pe.created_at) as created_at
                    FROM persona_examples pe
                    JOIN examples_resource e ON e.id = pe.example_id
                    JOIN accessible_personas ap ON ap.persona_id = pe.persona_id
                    CROSS JOIN draft_group_data dgd
                    WHERE pe.example_id IS NOT NULL
                      AND e.example IS NOT NULL
                      AND e.example != ''
                      AND (
                          -- Option 1: Linked to personas with active=true
                          pe.active = true
                          OR
                          -- Option 2: Linked to same group with generated=true
                          (
                              pe.generated = true
                              AND e.generated = true
                              AND EXISTS (
                                  SELECT 1 FROM calls c
                                  JOIN messages m ON m.id = c.message_id
                                  JOIN runs r ON r.id = m.run_id
                                  WHERE c.id = e.call_id
                                    AND r.group_id = dgd.group_id
                              )
                          )
                      )
                    GROUP BY pe.example_id
                    ORDER BY MAX(pe.created_at) DESC
                    LIMIT 20
                ) pe
            ),
            ARRAY[]::uuid[]
        ) as example_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Resource data CTEs - query from persona_* tables or draft_* tables if draft_id provided
-- NOTE: These must be defined BEFORE they are referenced in other CTEs (e.g., colors_data references color_resource_data)
color_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dc.colors_id FROM colors_draft dc WHERE dc.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pc.color_id FROM persona_colors pc WHERE pc.persona_id = (SELECT persona_id FROM params) LIMIT 1)
        ) as color_id,
        (SELECT ROW(c.id, c.name, c.description, c.hex_code, COALESCE(c.generated, false))::types.q_get_persona_v4_color_resource FROM colors_draft dc JOIN colors_resource c ON dc.colors_id = c.id WHERE dc.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_color_resource,
        (SELECT ROW(c.id, c.name, c.description, c.hex_code, COALESCE(c.generated, false))::types.q_get_persona_v4_color_resource FROM persona_colors pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = (SELECT persona_id FROM params) LIMIT 1) as persona_color_resource
    FROM params
),
-- Color suggestions: linked to personas OR same group with generated=true
-- NOTE: Must be defined before colors_data which references it
color_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pc.color_id ORDER BY pc.created_at DESC)
             FROM (
                 SELECT DISTINCT pc.color_id, MAX(pc.created_at) as created_at
                 FROM persona_colors pc
                 JOIN colors_resource c ON c.id = pc.color_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pc.color_id IS NOT NULL
                   AND (
                       -- Option 1: Linked to personas (persona_colors junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       pc.generated = false
                       OR
                       (
                           pc.generated = true
                           AND c.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c2
                               JOIN messages m ON m.id = c2.message_id
                               JOIN runs r ON r.id = m.run_id
                               WHERE c2.id = c.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY pc.color_id
                 ORDER BY MAX(pc.created_at) DESC
                 LIMIT 20
             ) pc),
            ARRAY[]::uuid[]
        ) as color_suggestions
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
        -- Always include selected color_id if it exists
        c.id = (SELECT color_id FROM color_resource_data)
        OR (
            -- Search filter: if color_search provided, match name or hex_code
            (p.color_search IS NULL OR p.color_search = '' OR
             LOWER(c.name) LIKE '%' || LOWER(p.color_search) || '%' OR
             LOWER(c.hex_code) LIKE '%' || LOWER(p.color_search) || '%')
            -- Show selected filter: if enabled, only show selected color from draft/persona
            AND (
                NOT p.color_show_selected OR
                c.id = (SELECT color_id FROM color_resource_data)
            )
        )
      )
    ORDER BY sort_priority, c.name
    LIMIT 30  -- Multiple of 3 for nice grid layout
),
colors_agg AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (c.id, c.name, c.description, c.hex_code, c.generated)::types.q_get_persona_v4_color_option
                ORDER BY c.sort_priority, c.name
            ),
            '{}'::types.q_get_persona_v4_color_option[]
        ) AS colors,
        COUNT(*)::int AS colors_count
    FROM colors_data c
),
-- Resource data CTEs - query from persona_* tables or draft_* tables if draft_id provided
-- NOTE: These must be defined BEFORE they are referenced in other CTEs (e.g., descriptions_data references description_resource_data, flags_data references flag_resource_data)
description_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dd.descriptions_id FROM descriptions_draft dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pd.description_id FROM persona_descriptions pd WHERE pd.persona_id = (SELECT persona_id FROM params) LIMIT 1)
        ) as description_id,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_persona_v4_description_resource FROM descriptions_draft dd JOIN descriptions_resource d ON dd.descriptions_id = d.id WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_description_resource,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_persona_v4_description_resource FROM persona_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = (SELECT persona_id FROM params) LIMIT 1) as persona_description_resource
    FROM params
),
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id FROM flags_draft df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pf.flag_id FROM persona_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = (SELECT persona_id FROM params) AND f.name = 'persona_active' AND pf.value = TRUE LIMIT 1)
        ) as active_flag_id,
        (SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_persona_v4_flag_resource FROM flags_draft df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_flag_resource,
        (SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_persona_v4_flag_resource FROM persona_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.persona_id = (SELECT persona_id FROM params) AND f.name = 'persona_active' AND pf.value = TRUE LIMIT 1) as persona_flag_resource
    FROM params
),
icon_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT di.icons_id FROM icons_draft di WHERE di.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pi.icon_id FROM persona_icons pi WHERE pi.persona_id = (SELECT persona_id FROM params) LIMIT 1)
        ) as icon_id,
        (SELECT ROW(i.id, i.name, i.description, i.value, COALESCE(i.generated, false))::types.q_get_persona_v4_icon_resource FROM icons_draft di JOIN icons_resource i ON di.icons_id = i.id WHERE di.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_icon_resource,
        (SELECT ROW(i.id, i.name, i.description, i.value, COALESCE(i.generated, false))::types.q_get_persona_v4_icon_resource FROM persona_icons pi JOIN icons_resource i ON pi.icon_id = i.id WHERE pi.persona_id = (SELECT persona_id FROM params) LIMIT 1) as persona_icon_resource
    FROM params
),
-- Icon suggestions: linked to personas OR same group with generated=true
-- NOTE: Must be defined before icons_data which references it
icon_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pi.icon_id ORDER BY pi.created_at DESC)
             FROM (
                 SELECT DISTINCT pi.icon_id, MAX(pi.created_at) as created_at
                 FROM persona_icons pi
                 JOIN icons_resource i ON i.id = pi.icon_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pi.icon_id IS NOT NULL
                   AND (
                       -- Option 1: Linked to personas (persona_icons junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       pi.generated = false
                       OR
                       (
                           pi.generated = true
                           AND i.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN messages m ON m.id = c.message_id
                               JOIN runs r ON r.id = m.run_id
                               WHERE c.id = i.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY pi.icon_id
                 ORDER BY MAX(pi.created_at) DESC
                 LIMIT 20
             ) pi),
            ARRAY[]::uuid[]
        ) as icon_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Icons (all available icon options)
icons_data AS (
    SELECT DISTINCT
        i.id,
        i.name,
        i.description,
        i.value,
        COALESCE(i.generated, false) as generated,
        -- Add sort priority: suggested icons first (1), then others (2)
        CASE 
            WHEN i.id = ANY(isd.icon_suggestions) THEN 1
            ELSE 2
        END as sort_priority
    FROM icons_resource i
    CROSS JOIN params p
    CROSS JOIN icon_suggestions_data isd
    WHERE i.active = true
      AND (
        -- Always include selected icon_id if it exists
        i.id = (SELECT icon_id FROM icon_resource_data)
        OR (
            -- Search filter: if icon_search provided, match name or value
            (p.icon_search IS NULL OR p.icon_search = '' OR
             LOWER(i.name) LIKE '%' || LOWER(p.icon_search) || '%' OR
             LOWER(i.value) LIKE '%' || LOWER(p.icon_search) || '%')
            -- Show selected filter: if enabled, only show selected icon from draft/persona
            AND (
                NOT p.icon_show_selected OR
                i.id = (SELECT icon_id FROM icon_resource_data)
            )
        )
      )
    ORDER BY sort_priority, i.name
    LIMIT 189  -- Multiple of 3 for nice grid layout (63 rows x 3 columns)
),
icons_agg AS (
    SELECT
        COALESCE(
            ARRAY_AGG(
                (i.id, i.name, i.description, i.value, i.generated)::types.q_get_persona_v4_icon_option
                ORDER BY i.sort_priority, i.name
            ),
            '{}'::types.q_get_persona_v4_icon_option[]
        ) AS icons,
        COUNT(*)::int AS icons_count
    FROM icons_data i
),
-- Resource data CTEs - query from persona_* tables or draft_* tables if draft_id provided
-- NOTE: instructions_resource_data is defined here (before instructions_data) to avoid forward reference
instructions_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dinst.instructions_id FROM instructions_draft dinst WHERE dinst.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pinst.instruction_id FROM persona_instructions pinst WHERE pinst.persona_id = (SELECT persona_id FROM params) LIMIT 1)
        ) as instructions_id,
        (SELECT ROW(inst.id, inst.template, COALESCE(inst.generated, false))::types.q_get_persona_v4_instructions_resource FROM instructions_draft dinst JOIN instructions_resource inst ON dinst.instructions_id = inst.id WHERE dinst.draft_id = (SELECT draft_id FROM params) LIMIT 1) as instructions_draft_resource,
        (SELECT ROW(inst.id, inst.template, COALESCE(inst.generated, false))::types.q_get_persona_v4_instructions_resource FROM persona_instructions pinst JOIN instructions_resource inst ON pinst.instruction_id = inst.id WHERE pinst.persona_id = (SELECT persona_id FROM params) LIMIT 1) as persona_instructions_resource
    FROM params
),
-- Flags (all available flag options for persona artifact)
flags_data AS (
    SELECT DISTINCT
        f.id,
        f.name,
        f.description,
        f.icon_id,
        COALESCE(f.generated, false) as generated
    FROM flags_resource f
    JOIN artifact_flags_relation aft ON f.type = aft.flag_type
    CROSS JOIN params p
    WHERE 
        aft.artifact = 'persona'::artifacts
        AND (
            -- Always include selected active_flag_id if it exists
            f.id = (SELECT active_flag_id FROM flag_resource_data)
            OR (SELECT active_flag_id FROM flag_resource_data) IS NULL
        )
    ORDER BY f.name
),
-- Descriptions: linked to personas with active=true OR same group with generated=true
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
                -- Option 1: Linked to personas (persona_descriptions junction table means it's used)
                EXISTS (
                    SELECT 1 FROM persona_descriptions pd
                    WHERE pd.description_id = d.id
                )
                OR
                -- Option 2: Linked to same group with generated=true
                (
                    d.generated = true
                    AND EXISTS (
                        SELECT 1 FROM calls c
                        JOIN messages m ON m.id = c.message_id
                        JOIN runs r ON r.id = m.run_id
                        WHERE c.id = d.call_id
                          AND r.group_id = dgd.group_id
                    )
                )
            )
            -- Search filter: if descriptions_search provided, match description text
            AND (p.descriptions_search IS NULL OR p.descriptions_search = '' OR
                 LOWER(d.description) LIKE '%' || LOWER(p.descriptions_search) || '%')
            AND d.description IS NOT NULL
            AND d.description != ''
        )
    ORDER BY d.description
),
-- Instructions: linked to personas with active=true OR same group with generated=true
instructions_data AS (
    SELECT DISTINCT
        i.id,
        i.template,
        COALESCE(i.generated, false) as generated
    FROM instructions_resource i
    CROSS JOIN params p
    CROSS JOIN draft_group_data dgd
    WHERE 
        i.active = true
        AND (
            -- Always include selected instructions_id if it exists
            i.id = (SELECT instructions_id FROM instructions_resource_data)
            OR (
                (
                    -- Option 1: Linked to personas (persona_instructions junction table means it's used)
                    EXISTS (
                        SELECT 1 FROM persona_instructions pi
                        WHERE pi.instruction_id = i.id
                    )
                    OR
                    -- Option 2: Linked to same group with generated=true
                    (
                        i.generated = true
                        AND EXISTS (
                            SELECT 1 FROM calls c
                            JOIN messages m ON m.id = c.message_id
                            JOIN runs r ON r.id = m.run_id
                            WHERE c.id = i.call_id
                              AND r.group_id = dgd.group_id
                        )
                    )
                )
                -- Search filter: if instructions_search provided, match template text
                AND (p.instructions_search IS NULL OR p.instructions_search = '' OR
                     LOWER(i.template) LIKE '%' || LOWER(p.instructions_search) || '%')
                AND i.template IS NOT NULL
                AND i.template != ''
            )
        )
    ORDER BY i.template
),
-- Fields (all available field options, filtered by search and show_selected)
-- Note: Filtering happens in SELECT statement using valid_fields_data and field_mapping_data
-- NOTE: color_suggestions_data and icon_suggestions_data moved earlier (before colors_data and icons_data)
-- Name suggestions: linked to personas OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pn.name_id ORDER BY pn.created_at DESC)
             FROM (
                 SELECT DISTINCT pn.name_id, MAX(pn.created_at) as created_at
                 FROM persona_names pn
                 JOIN names_resource n ON n.id = pn.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pn.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to personas (persona_names junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       pn.generated = false
                       OR
                       (
                           pn.generated = true
                           AND n.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN messages m ON m.id = c.message_id
                               JOIN runs r ON r.id = m.run_id
                               WHERE c.id = n.call_id
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
-- Description suggestions: linked to personas OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pd.description_id ORDER BY pd.created_at DESC)
             FROM (
                 SELECT DISTINCT pd.description_id, MAX(pd.created_at) as created_at
                 FROM persona_descriptions pd
                 JOIN descriptions_resource d ON d.id = pd.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pd.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       -- Option 1: Linked to personas (persona_descriptions junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       pd.generated = false
                       OR
                       (
                           pd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN messages m ON m.id = c.message_id
                               JOIN runs r ON r.id = m.run_id
                               WHERE c.id = d.call_id
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
-- Instructions suggestions: linked to personas OR same group with generated=true
instructions_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pi.instruction_id ORDER BY pi.created_at DESC)
             FROM (
                 SELECT DISTINCT pi.instruction_id, MAX(pi.created_at) as created_at
                 FROM persona_instructions pi
                 JOIN instructions_resource i ON i.id = pi.instruction_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pi.instruction_id IS NOT NULL
                   AND i.active = true
                   AND i.template IS NOT NULL
                   AND i.template != ''
                   AND (
                       -- Option 1: Linked to personas (persona_instructions junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       pi.generated = false
                       OR
                       (
                           pi.generated = true
                           AND i.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN messages m ON m.id = c.message_id
                               JOIN runs r ON r.id = m.run_id
                               WHERE c.id = i.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY pi.instruction_id
                 ORDER BY MAX(pi.created_at) DESC
                 LIMIT 20
             ) pi),
            ARRAY[]::uuid[]
        ) as instructions_suggestions
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
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_persona_v4_name_resource
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_persona_v4_name_resource[]
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
                    (d.id, d.description, COALESCE(d.generated, false))::types.q_get_persona_v4_description_resource
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_persona_v4_description_resource[]
        ) as descriptions
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
instructions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (i.id, i.template, COALESCE(i.generated, false))::types.q_get_persona_v4_instructions_resource
                    ORDER BY array_position(insd.instructions_suggestions, i.id)
                )
                FROM instructions_suggestions_data insd
                CROSS JOIN LATERAL unnest(insd.instructions_suggestions) AS suggestion_id
                JOIN instructions_resource i ON i.id = suggestion_id
                WHERE i.active = true AND i.template IS NOT NULL AND i.template != ''
            ),
            ARRAY[]::types.q_get_persona_v4_instructions_resource[]
        ) as instructions
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
-- Resource data CTEs - query from persona_* tables or draft_* tables if draft_id provided
-- NOTE: color_resource_data is defined earlier (before colors_data) to avoid forward reference
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT n.id FROM names_draft dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT pn.name_id FROM persona_names pn WHERE pn.persona_id = (SELECT persona_id FROM params) LIMIT 1)
        ) as name_id,
        (
            SELECT ROW(n.id, n.name, n.generated)::types.q_get_persona_v4_name_resource 
            FROM (
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 1 as priority
                FROM names_draft dn 
                JOIN names_resource n ON dn.names_id = n.id 
                WHERE dn.draft_id = (SELECT draft_id FROM params)
                UNION ALL
                SELECT n.id, n.name, COALESCE(n.generated, false) as generated, 2 as priority
                FROM persona_names pn 
                JOIN names_resource n ON pn.name_id = n.id 
                WHERE pn.persona_id = (SELECT persona_id FROM params)
            ) n
            ORDER BY priority
            LIMIT 1
        ) as name_resource
    FROM params
),
-- Department suggestions: linked to personas with active=true OR same group with generated=true
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pd.department_id ORDER BY pd.created_at DESC)
             FROM (
                 SELECT DISTINCT pd.department_id, MAX(pd.created_at) as created_at
                 FROM persona_departments pd
                 JOIN departments_resource d ON d.id = pd.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pd.department_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'department_active' AND df.value = true)
                   AND (
                       -- Option 1: Linked to personas with active=true
                       pd.active = true
                       OR
                       -- Option 2: Linked to same group with generated=true
                       (
                           pd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN messages m ON m.id = c.message_id
                               JOIN runs r ON r.id = m.run_id
                               WHERE c.id = d.call_id
                                 AND r.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY pd.department_id
                 ORDER BY MAX(pd.created_at) DESC
                 LIMIT 20
             ) pd),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Agent selection helper CTEs (shared across all agent selections)
persona_department_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN persona_departments pd ON pd.persona_id = p.persona_id AND pd.active = true
    WHERE p.persona_id IS NOT NULL
    LIMIT 1
),
profile_primary_department_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
    WHERE p.persona_id IS NULL
    LIMIT 1
),
selected_department_for_agents AS (
    SELECT 
        COALESCE(
            (SELECT department_id FROM persona_department_for_agents),
            (SELECT department_id FROM profile_primary_department_for_agents)
        ) as department_id
),
user_departments_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.active = true
),
-- Agent tool coverage for persona artifact (used to prefer exact specialists)
agent_artifact_tool_counts AS (
    SELECT 
        a.id as agent_id,
        COUNT(DISTINCT CASE WHEN ar.resource IS NOT NULL THEN rt.resource::text END) as matched_artifact_count,
        COUNT(DISTINCT CASE WHEN ar.resource IS NULL THEN rt.resource::text END) as extra_outside_count
    FROM agent_artifact a
    LEFT JOIN agent_tools at ON at.agent_id = a.id AND at.active = true
    LEFT JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (
        SELECT 1 FROM tool_flags tf
        JOIN flags_resource f ON tf.flag_id = f.id
        WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true
    )
    LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
    LEFT JOIN artifact_resources_relation ar ON ar.resource = rt.resource AND ar.artifact = 'persona'::artifacts
    GROUP BY a.id
),
-- Agent selection for 'names' resource
name_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools_relation rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'persona'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'names'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
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
                         SELECT 1 FROM agent_departments ad
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
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools_relation rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'persona'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'descriptions'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
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
                         SELECT 1 FROM agent_departments ad
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
-- Agent selection for 'colors' resource
color_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools_relation rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'persona'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'colors'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
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
                         SELECT 1 FROM agent_departments ad
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
-- Agent selection for 'icons' resource
icon_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools_relation rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'persona'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'icons'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
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
                         SELECT 1 FROM agent_departments ad
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
-- Agent selection for 'instructions' resource
instructions_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools_relation rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'persona'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'instructions'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
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
                         SELECT 1 FROM agent_departments ad
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
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools_relation rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'persona'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'flags'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = a.id
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
                         SELECT 1 FROM agent_departments ad
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
-- Agent selection for 'departments' resource
departments_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools_relation rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'persona'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'departments'::resources
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
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
-- Agent selection for 'fields' resource
fields_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools_relation rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'persona'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'fields'::resources
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
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
-- Agent selection for 'examples' resource
examples_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools_relation rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'persona'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
            JOIN resource_tools_relation rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'examples'::resources
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
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
-- Agent selection for 'basic' multi-resource combination (names + descriptions + flags + departments)
basic_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools_relation rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'persona'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
    ),
    agent_tool_resources AS (
        SELECT 
            ea.agent_id,
            COALESCE(
                ARRAY_AGG(DISTINCT rt.resource::text) FILTER (WHERE rt.resource IS NOT NULL),
                ARRAY[]::text[]
            ) as tool_resources,
            ea.updated_at
        FROM eligible_agents ea
        LEFT JOIN agent_tools at ON at.agent_id = ea.agent_id AND at.active = true
        LEFT JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
        GROUP BY ea.agent_id, ea.updated_at
    ),
    agent_scores AS (
        SELECT 
            atr.agent_id,
            atr.tool_resources,
            ARRAY_LENGTH(
                ARRAY(
                    SELECT unnest(atr.tool_resources)
                    EXCEPT
                    SELECT unnest(ARRAY['names', 'descriptions', 'flags', 'departments']::text[])
                ),
                1
            ) as unmatched_count,
            atr.updated_at
        FROM agent_tool_resources atr
        WHERE ARRAY['names', 'descriptions', 'flags', 'departments']::text[] <@ atr.tool_resources
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = atr.agent_id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ascores.agent_id,
            ascores.unmatched_count,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ascores.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ascores.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM agent_scores ascores
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ascores.agent_id
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
-- Agent selection for 'content' multi-resource combination (instructions + examples)
content_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools_relation rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'persona'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
    ),
    agent_tool_resources AS (
        SELECT 
            ea.agent_id,
            COALESCE(
                ARRAY_AGG(DISTINCT rt.resource::text) FILTER (WHERE rt.resource IS NOT NULL),
                ARRAY[]::text[]
            ) as tool_resources,
            ea.updated_at
        FROM eligible_agents ea
        LEFT JOIN agent_tools at ON at.agent_id = ea.agent_id AND at.active = true
        LEFT JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
        GROUP BY ea.agent_id, ea.updated_at
    ),
    agent_scores AS (
        SELECT 
            atr.agent_id,
            atr.tool_resources,
            ARRAY_LENGTH(
                ARRAY(
                    SELECT unnest(atr.tool_resources)
                    EXCEPT
                    SELECT unnest(ARRAY['instructions', 'examples']::text[])
                ),
                1
            ) as unmatched_count,
            atr.updated_at
        FROM agent_tool_resources atr
        WHERE ARRAY['instructions', 'examples']::text[] <@ atr.tool_resources
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = atr.agent_id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ascores.agent_id,
            ascores.unmatched_count,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ascores.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ascores.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM agent_scores ascores
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ascores.agent_id
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
-- Agent selection for 'general' - agent with ALL persona tools (names, descriptions, colors, icons, instructions, flags, fields, departments, examples)
general_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools_relation rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources_relation ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'persona'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
    ),
    agent_tool_resources AS (
        SELECT 
            ea.agent_id,
            COALESCE(
                ARRAY_AGG(DISTINCT rt.resource::text) FILTER (WHERE rt.resource IS NOT NULL),
                ARRAY[]::text[]
            ) as tool_resources,
            ea.updated_at
        FROM eligible_agents ea
        LEFT JOIN agent_tools at ON at.agent_id = ea.agent_id AND at.active = true
        LEFT JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
        GROUP BY ea.agent_id, ea.updated_at
    ),
    agent_scores AS (
        SELECT 
            atr.agent_id,
            atr.tool_resources,
            ARRAY_LENGTH(
                ARRAY(
                    SELECT unnest(atr.tool_resources)
                    EXCEPT
                    SELECT unnest(ARRAY['names', 'descriptions', 'colors', 'icons', 'instructions', 'flags', 'fields', 'departments', 'examples']::text[])
                ),
                1
            ) as unmatched_count,
            atr.updated_at
        FROM agent_tool_resources atr
        WHERE ARRAY['names', 'descriptions', 'colors', 'icons', 'instructions', 'flags', 'fields', 'departments', 'examples']::text[] <@ atr.tool_resources
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (SELECT 1 FROM agent_flags af_mcp JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id WHERE af_mcp.agent_id = atr.agent_id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ascores.agent_id,
            ascores.unmatched_count,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ascores.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ascores.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM agent_scores ascores
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ascores.agent_id
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
-- Check for missing tools on required resources (after all agent selection CTEs and ui_flags)
-- IMPORTANT: We check for TOOLS existence (not agents). Tools are required, agents are optional.
-- If no tools exist for a resource, we error. If tools exist but no agent exists, that's fine (manual entry).
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'names'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'colors'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as colors_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'icons'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as icons_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'instructions'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as instructions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'fields'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as fields_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools_relation rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'examples'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
        ) as examples_has_tools
    FROM params x
),
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            -- Check if tools exist (not agents). Error only if NO tools exist.
            CASE WHEN NOT tec.names_has_tools THEN 'name' ELSE NULL END,
            CASE WHEN NOT tec.colors_has_tools THEN 'color' ELSE NULL END,
            CASE WHEN NOT tec.icons_has_tools THEN 'icon' ELSE NULL END,
            CASE WHEN NOT tec.instructions_has_tools THEN 'instructions' ELSE NULL END,
            CASE WHEN NOT tec.departments_has_tools AND uf.show_departments THEN 'departments' ELSE NULL END,
            CASE WHEN NOT tec.fields_has_tools AND uf.show_fields THEN 'fields' ELSE NULL END,
            CASE WHEN NOT tec.examples_has_tools AND (SELECT COUNT(*) FROM example_mapping_data) > 0 THEN 'examples' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM params x
    CROSS JOIN ui_flags uf
    CROSS JOIN tools_existence_check tec
),
permissions_data_with_tools AS (
    SELECT 
        pdd.department_ids,
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
                    WHEN pdd.department_ids IS NULL AND up.role != 'superadmin' THEN false
                    WHEN EXISTS (SELECT 1 FROM scenario_personas sp WHERE sp.persona_id = (SELECT persona_id FROM params) AND sp.active = true) THEN false
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
                    ELSE false
                END
        END as base_can_edit,
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN
                -- New mode: always editable if can_edit is true
                NULL::text
            ELSE
                -- Detail mode: compute disabled_reason
                CASE 
                    WHEN pdd.department_ids IS NULL AND up.role != 'superadmin' THEN 
                        'This is a default persona that cannot be edited. You can view the details but cannot make changes.'::text
                    WHEN EXISTS (SELECT 1 FROM scenario_personas sp WHERE sp.persona_id = (SELECT persona_id FROM params) AND sp.active = true) THEN 
                        'This persona is currently in use by scenarios and cannot be edited. You can view the details but cannot make changes.'::text
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN 
                        NULL::text
                    ELSE 
                        'This persona cannot be edited. You can view the details but cannot make changes.'::text
                END
        END as base_disabled_reason
    FROM params x
    LEFT JOIN persona_departments_data pdd ON true
    CROSS JOIN user_profile up
),
permissions_final AS (
    SELECT 
        pd.department_ids,
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
    -- Required fields (first 4)
    up.actor_name::text as actor_name,
    (SELECT persona_exists FROM persona_exists_check) as persona_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    -- Group ID for linking resources
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
    COALESCE((SELECT names FROM names_suggestions_objects), ARRAY[]::types.q_get_persona_v4_name_resource[]) as names,
    -- Single-select resources: description
    (SELECT description_id FROM description_resource_data) as description_id,
    (SELECT desc_res FROM (SELECT drd.draft_description_resource as desc_res UNION ALL SELECT drd.persona_description_resource LIMIT 1) sub WHERE desc_res IS NOT NULL LIMIT 1) as description_resource,
    uf.show_description,
    (SELECT agent_id FROM description_agent_data) as description_agent_id,
    false as description_required,
    COALESCE((SELECT description_suggestions FROM description_suggestions_data), ARRAY[]::uuid[]) as description_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.id, dd.description, dd.generated)::types.q_get_persona_v4_description_resource
            ORDER BY dd.description
        ) FROM (SELECT DISTINCT id, description, generated FROM descriptions_data) dd),
        COALESCE((SELECT descriptions FROM descriptions_suggestions_objects), ARRAY[]::types.q_get_persona_v4_description_resource[])
    ) as descriptions,
    -- Single-select resources: color
    (SELECT color_id FROM color_resource_data) as color_id,
    (SELECT color_res FROM (SELECT crd.draft_color_resource as color_res UNION ALL SELECT crd.persona_color_resource LIMIT 1) sub WHERE color_res IS NOT NULL LIMIT 1) as color_resource,
    CASE 
        WHEN NOT tec.colors_has_tools THEN false
        WHEN cag.colors_count > 0 THEN true
        ELSE false
    END as show_color,
    (SELECT agent_id FROM color_agent_data) as color_agent_id,
    true as color_required,
    COALESCE((SELECT color_suggestions FROM color_suggestions_data), ARRAY[]::uuid[]) as color_suggestions,
    cag.colors as colors,
    -- Single-select resources: icon
    (SELECT icon_id FROM icon_resource_data) as icon_id,
    (SELECT icon_res FROM (SELECT ird.draft_icon_resource as icon_res UNION ALL SELECT ird.persona_icon_resource LIMIT 1) sub WHERE icon_res IS NOT NULL LIMIT 1) as icon_resource,
    CASE 
        WHEN NOT tec.icons_has_tools THEN false
        WHEN (SELECT COUNT(*) FROM icons_data) > 0 THEN true
        ELSE false
    END as show_icon,
    (SELECT agent_id FROM icon_agent_data) as icon_agent_id,
    true as icon_required,
    COALESCE((SELECT icon_suggestions FROM icon_suggestions_data), ARRAY[]::uuid[]) as icon_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (iod.id, iod.name, iod.description, iod.value, iod.generated)::types.q_get_persona_v4_icon_option
            ORDER BY iod.sort_priority, iod.name
        ) FROM (SELECT DISTINCT id, name, description, value, generated, sort_priority FROM icons_data) iod),
        '{}'::types.q_get_persona_v4_icon_option[]
    ) as icons,
    -- Single-select resources: instructions
    (SELECT instructions_id FROM instructions_resource_data) as instructions_id,
    (SELECT inst_res FROM (SELECT instrd.instructions_draft_resource as inst_res UNION ALL SELECT instrd.persona_instructions_resource LIMIT 1) sub WHERE inst_res IS NOT NULL LIMIT 1) as instructions_resource,
    CASE 
        WHEN NOT tec.instructions_has_tools THEN false
        ELSE uf.show_instructions
    END as show_instructions,
    (SELECT agent_id FROM instructions_agent_data) as instructions_agent_id,
    true as instructions_required,
    COALESCE((SELECT instructions_suggestions FROM instructions_suggestions_data), ARRAY[]::uuid[]) as instructions_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (id.id, id.template, id.generated)::types.q_get_persona_v4_instructions_resource
            ORDER BY id.template
        ) FROM (SELECT DISTINCT id, template, generated FROM instructions_data) id),
        COALESCE((SELECT instructions FROM instructions_suggestions_objects), ARRAY[]::types.q_get_persona_v4_instructions_resource[])
    ) as instructions,
    -- Single-select resources: flag
    (SELECT active_flag_id FROM flag_resource_data) as active_flag_id,
    (SELECT flag_res FROM (SELECT frd.draft_flag_resource as flag_res UNION ALL SELECT frd.persona_flag_resource LIMIT 1) sub WHERE flag_res IS NOT NULL LIMIT 1) as flag_resource,
    uf.show_flag,
    (SELECT agent_id FROM flag_agent_data) as flag_agent_id,
    false as flag_required,
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.id, fd.name, fd.description, fd.icon_id, fd.generated)::types.q_get_persona_v4_flag_resource
            ORDER BY fd.name
        ) FROM (SELECT DISTINCT id, name, description, icon_id, generated FROM flags_data) fd),
        '{}'::types.q_get_persona_v4_flag_resource[]
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
            WHEN (SELECT persona_id FROM params) IS NULL THEN
                -- For new personas, leave department_ids empty (no auto-selection)
                ARRAY[]::uuid[]
            ELSE pdd.department_ids
        END
    ) as department_ids,
    -- Department resources (selected departments filtered by department_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_persona_v4_department
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
                    WHEN (SELECT persona_id FROM params) IS NULL THEN
                        -- For new personas, leave department_ids empty (no auto-selection)
                        ARRAY[]::uuid[]
                    ELSE pdd.department_ids
                END
            )
        )),
        '{}'::types.q_get_persona_v4_department[]
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
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_persona_v4_department
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM department_mapping_data) dmd),
        '{}'::types.q_get_persona_v4_department[]
    ) as departments,
    -- Multi-select resources: fields
    fid.field_ids,
    -- Field resources (selected fields filtered by field_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (fmd.field_id, fmd.name, fmd.description, fmd.generated)::types.q_get_persona_v4_field
            ORDER BY fmd.sort_priority, fmd.name
        )
        FROM (SELECT DISTINCT field_id, name, description, generated, sort_priority FROM field_mapping_data WHERE field_id = ANY(fid.field_ids)) fmd),
        '{}'::types.q_get_persona_v4_field[]
    ) as field_resources,
    CASE 
        WHEN NOT tec.fields_has_tools AND uf.show_fields THEN false
        ELSE uf.show_fields
    END as show_fields,
    (SELECT agent_id FROM fields_agent_data) as fields_agent_id,
    CASE 
        WHEN uf.show_fields THEN true
        ELSE false
    END as fields_required,
    fsd.field_suggestions,
    COALESCE(
        CASE 
            WHEN (SELECT persona_id FROM params) IS NULL THEN
                -- For new personas, use valid_fields_data with search/filter
                (SELECT ARRAY_AGG(
                    (vfd.field_id, vfd.name, vfd.description, vfd.generated)::types.q_get_persona_v4_field
                    ORDER BY vfd.sort_priority, vfd.name
                ) FROM (
                    SELECT DISTINCT vfd.field_id, vfd.name, vfd.description, vfd.generated, vfd.sort_priority
                    FROM valid_fields_data vfd
                    CROSS JOIN params p
                    WHERE 
                        vfd.field_id IS NOT NULL
                        -- Search filter: if field_search provided, match name or description
                        AND (p.field_search IS NULL OR p.field_search = '' OR
                         LOWER(vfd.name) LIKE '%' || LOWER(p.field_search) || '%' OR
                         LOWER(vfd.description) LIKE '%' || LOWER(p.field_search) || '%')
                        -- Show selected filter: if enabled, only show selected fields
                        AND (
                            NOT p.field_show_selected OR
                            vfd.field_id IN (
                                SELECT jsonb_array_elements_text(payload->'field_ids')::uuid
                                FROM draft_payload_data
                                WHERE payload->'field_ids' IS NOT NULL
                            )
                        )
                ) vfd)
            ELSE
                -- For existing personas, use field_mapping_data with search/filter
                (SELECT ARRAY_AGG(
                    (fmd.field_id, fmd.name, fmd.description, fmd.generated)::types.q_get_persona_v4_field
                    ORDER BY fmd.sort_priority, fmd.name
                ) FROM (
                    SELECT DISTINCT fmd.field_id, fmd.name, fmd.description, fmd.generated, fmd.sort_priority
                    FROM field_mapping_data fmd
                    CROSS JOIN params p
                    WHERE 
                        fmd.field_id IS NOT NULL
                        -- Search filter: if field_search provided, match name or description
                        AND (p.field_search IS NULL OR p.field_search = '' OR
                         LOWER(fmd.name) LIKE '%' || LOWER(p.field_search) || '%' OR
                         LOWER(fmd.description) LIKE '%' || LOWER(p.field_search) || '%')
                        -- Show selected filter: if enabled, only show selected fields
                        AND (
                            NOT p.field_show_selected OR
                            fmd.field_id IN (
                                SELECT pf.field_id
                                FROM persona_fields pf
                                WHERE pf.persona_id = (SELECT persona_id FROM params)
                                  AND pf.field_id IS NOT NULL
                            )
                        )
                ) fmd)
        END,
        '{}'::types.q_get_persona_v4_field[]
    ) as fields,
    -- Multi-select resources: examples
    ped.example_ids,
    -- Example resources (selected examples - same as examples array)
    COALESCE(
        (SELECT ARRAY_AGG(
            (emd.id, emd.example, emd.idx, emd.generated)::types.q_get_persona_v4_example
            ORDER BY emd.idx
        )
        FROM (SELECT DISTINCT id, example, idx, generated FROM example_mapping_data) emd),
        '{}'::types.q_get_persona_v4_example[]
    ) as example_resources,
    CASE 
        WHEN NOT tec.examples_has_tools THEN false
        ELSE true
    END as show_examples,
    (SELECT agent_id FROM examples_agent_data) as examples_agent_id,
    CASE 
        WHEN (SELECT COUNT(*) FROM example_mapping_data) > 0 THEN true
        ELSE false
    END as examples_required,
    COALESCE(esd.example_suggestions, ARRAY[]::uuid[]) as example_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (emd.id, emd.example, emd.idx, emd.generated)::types.q_get_persona_v4_example
            ORDER BY emd.idx
        ) FROM example_mapping_data emd),
        '{}'::types.q_get_persona_v4_example[]
    ) as examples,
    -- Multi-resource combination agent IDs
    (SELECT agent_id FROM basic_agent_data) as basic_agent_id,
    (SELECT agent_id FROM content_agent_data) as content_agent_id,
    (SELECT agent_id FROM general_agent_data) as general_agent_id
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
LEFT JOIN persona_departments_data pdd ON true
CROSS JOIN active_departments_data add
CROSS JOIN draft_group_data dgd
CROSS JOIN draft_version_data dvd
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN color_resource_data crd
CROSS JOIN icon_resource_data ird
CROSS JOIN instructions_resource_data instrd
CROSS JOIN flag_resource_data frd
CROSS JOIN color_suggestions_data csd
CROSS JOIN icon_suggestions_data isd
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_suggestions_data dsd
CROSS JOIN instructions_suggestions_data insd
CROSS JOIN names_suggestions_objects nso
CROSS JOIN descriptions_suggestions_objects dso
CROSS JOIN instructions_suggestions_objects iso
CROSS JOIN colors_agg cag
CROSS JOIN icons_agg iag
CROSS JOIN department_suggestions_data dsd_dept
CROSS JOIN field_ids_data fid
CROSS JOIN field_suggestions_data fsd
CROSS JOIN persona_examples_data ped
CROSS JOIN example_suggestions_data esd
$$;
