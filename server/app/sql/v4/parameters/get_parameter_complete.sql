-- Unified get parameter function - handles both new (parameter_id = NULL) and detail (parameter_id provided)
-- Converted to function with composite types following RETURN_STRUCTURE_GUIDELINES.md
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_parameter_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_parameter_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_parameter_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_parameter_v4_department AS (
    department_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_parameter_v4_field AS (
    field_id uuid,
    name text,
    description text,
    usage_count bigint,
    department_ids text[],
    generated boolean
);

CREATE TYPE types.q_get_parameter_v4_persona AS (
    persona_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_parameter_v4_document AS (
    document_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_parameter_v4_item AS (
    parameter_item_id uuid,
    name text,
    description text,
    "default" boolean,
    usage_count bigint,
    department_ids text[]
);

CREATE TYPE types.q_get_parameter_v4_field_connection AS (
    field_id uuid,
    "default" boolean,
    active boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_parameter_v4(
    profile_id uuid,
    parameter_id uuid DEFAULT NULL,
    field_search text DEFAULT NULL,
    field_show_selected boolean DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    parameter_exists boolean,
    can_edit boolean,
    disabled_reason text,
    group_id uuid,
    -- Basic parameter fields
    name text,
    description text,
    active boolean,
    simulation_parameter boolean,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean,
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_parameter_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_parameter_v4_department[],
    -- Multi-select resources: fields
    field_ids uuid[],
    field_resources types.q_get_parameter_v4_field[],
    show_fields boolean,
    fields_agent_id uuid,
    fields_required boolean,
    field_suggestions uuid[],
    fields types.q_get_parameter_v4_field[],
    -- Multi-select resources: personas
    persona_ids uuid[],
    persona_resources types.q_get_parameter_v4_persona[],
    show_personas boolean,
    personas_agent_id uuid,
    personas_required boolean,
    persona_suggestions uuid[],
    personas types.q_get_parameter_v4_persona[],
    -- Multi-select resources: documents
    document_ids uuid[],
    document_resources types.q_get_parameter_v4_document[],
    show_documents boolean,
    documents_agent_id uuid,
    documents_required boolean,
    document_suggestions uuid[],
    documents types.q_get_parameter_v4_document[],
    -- Parameter items (fields connected to parameter)
    parameter_items types.q_get_parameter_v4_item[],
    field_connections types.q_get_parameter_v4_field_connection[],
    -- Draft and field state
    draft_version int,
    field_ids_jsonb jsonb,
    field_active_states jsonb,
    field_default_states jsonb,
    valid_department_ids text[],
    valid_field_ids text[],
    valid_persona_ids text[],
    valid_document_ids text[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        parameter_id AS parameter_id,
        profile_id AS profile_id,
        field_search AS field_search,
        COALESCE(field_show_selected, false) AS field_show_selected,
        draft_id AS draft_id,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check parameter existence if parameter_id provided
parameter_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT parameter_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM parameter_artifact WHERE id = (SELECT parameter_id FROM params))::boolean
        END as parameter_exists
),
-- Draft data
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    
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
    LEFT JOIN drafts d ON d.id = x.draft_id
    -- Always return at least one row (use COALESCE to handle NULL draft_id case)
    WHERE TRUE
    LIMIT 1
),
user_profile AS (
    SELECT 
        p.role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Conditional: Get parameter department data only if parameter_id provided
parameter_departments_data AS (
    SELECT 
        pd.parameter_id,
        ARRAY_AGG(pd.department_id ORDER BY pd.created_at) as department_ids
    FROM params x
    JOIN parameter_departments pd ON pd.parameter_id = x.parameter_id AND pd.active = true
    WHERE x.parameter_id IS NOT NULL
    GROUP BY pd.parameter_id
),
-- Conditional: Get parameter persona/document IDs only if parameter_id provided
-- Note: parameter_personas and parameter_documents tables may not exist yet
-- Return empty arrays for now (matching existing SQL behavior)
parameter_personas_data AS (
    SELECT 
        x.parameter_id,
        ARRAY[]::uuid[] as persona_ids
    FROM params x
    WHERE x.parameter_id IS NOT NULL
    LIMIT 1
),
parameter_documents_data AS (
    SELECT 
        x.parameter_id,
        ARRAY[]::uuid[] as document_ids
    FROM params x
    WHERE x.parameter_id IS NOT NULL
    LIMIT 1
),
field_departments_for_filter AS (
    SELECT DISTINCT
        (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) as parameter_id,
        fd.department_id
    FROM fields_resource f
    JOIN field_departments fd ON fd.field_id = f.id
    WHERE EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true) AND fd.active = true AND (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) IS NOT NULL
),
-- For new mode: get default parameter
default_parameter AS (
    SELECT p.id
    FROM parameter_artifact p
    LEFT JOIN field_departments_for_filter fdf ON fdf.parameter_id = p.id
    WHERE EXISTS (SELECT 1 FROM parameter_flags pf WHERE pf.parameter_id = p.id AND pf.type = 'active'::type_parameter_flags AND pf.value = true)
    GROUP BY p.id
    HAVING 
        -- Include if has matching department link via parameter_departments or field_departments OR has no department links at all (cross-dept)
        COUNT(fdf.parameter_id) FILTER (WHERE fdf.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (
            SELECT 1 FROM parameter_departments pd2 WHERE pd2.parameter_id = p.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM field_departments fd2 
            JOIN fields_resource f2 ON f2.id = fd2.field_id 
            JOIN parameter_fields pf2 ON pf2.field_id = f2.id WHERE pf2.parameter_id = p.id AND EXISTS (SELECT 1 FROM field_flags ff2 WHERE ff2.field_id = f2.id AND ff2.type = 'active'::type_field_flags AND ff2.value = TRUE) AND fd2.active = true
        )
    ORDER BY p.created_at DESC
    LIMIT 1
),
-- Parameter departments aggregated (union of parameter_departments and field_departments)
parameter_departments_aggregated AS (
    SELECT 
        ARRAY_AGG(DISTINCT dept_id::text ORDER BY dept_id::text) as department_ids
    FROM (
        -- Parameter-level departments
        SELECT pd.department_id as dept_id
        FROM params x
        LEFT JOIN parameter_departments pd ON pd.parameter_id = COALESCE(x.parameter_id, (SELECT id FROM default_parameter LIMIT 1)) AND pd.active = true
        WHERE pd.department_id IS NOT NULL
        UNION
        -- Field-level departments
        SELECT fd.department_id as dept_id
        FROM params x
        JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = COALESCE(x.parameter_id, (SELECT id FROM default_parameter LIMIT 1)) AND EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true)
        JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    ) combined_depts
),
-- Parameter data (conditional based on mode)
parameter_data AS (
    SELECT 
        (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = COALESCE(x.parameter_id, (SELECT id FROM default_parameter LIMIT 1)) LIMIT 1),
        (SELECT d.description FROM parameter_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = COALESCE(x.parameter_id, (SELECT id FROM default_parameter LIMIT 1)) LIMIT 1),
        EXISTS (SELECT 1 FROM parameter_flags paf WHERE paf.parameter_id = COALESCE(x.parameter_id, (SELECT id FROM default_parameter LIMIT 1)) AND paf.type = 'active'::type_parameter_flags AND paf.value = TRUE) as active,
        EXISTS (SELECT 1 FROM parameter_flags paf WHERE paf.parameter_id = COALESCE(x.parameter_id, (SELECT id FROM default_parameter LIMIT 1)) AND paf.type = 'simulation_parameter'::type_parameter_flags AND paf.value = TRUE) as simulation_parameter,
        EXISTS (SELECT 1 FROM parameter_flags paf WHERE paf.parameter_id = COALESCE(x.parameter_id, (SELECT id FROM default_parameter LIMIT 1)) AND paf.type = 'document_parameter'::type_parameter_flags AND paf.value = TRUE) as document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags paf WHERE paf.parameter_id = COALESCE(x.parameter_id, (SELECT id FROM default_parameter LIMIT 1)) AND paf.type = 'persona_parameter'::type_parameter_flags AND paf.value = TRUE) as persona_parameter,
        EXISTS (SELECT 1 FROM parameter_flags paf WHERE paf.parameter_id = COALESCE(x.parameter_id, (SELECT id FROM default_parameter LIMIT 1)) AND paf.type = 'scenario_parameter'::type_parameter_flags AND paf.value = TRUE) as scenario_parameter,
        EXISTS (SELECT 1 FROM parameter_flags paf WHERE paf.parameter_id = COALESCE(x.parameter_id, (SELECT id FROM default_parameter LIMIT 1)) AND paf.type = 'video_parameter'::type_parameter_flags AND paf.value = TRUE) as video_parameter,
        COALESCE(pda.department_ids, NULL) as department_ids
    FROM params x
    LEFT JOIN parameter_departments_aggregated pda ON true
),
-- All available fields (not just connected ones)
all_fields_data AS (
    SELECT 
        f.id as field_id,
        COALESCE(ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) FILTER (WHERE fd.department_id IS NOT NULL), ARRAY[]::text[]) as department_ids
    FROM fields_resource f
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true)
    GROUP BY f.id
),
all_fields_with_usage AS (
    SELECT 
        f.id,
        (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1),
        COALESCE(COUNT(sf.scenario_id), 0) as usage_count,
        COALESCE(afd.department_ids, ARRAY[]::text[]) as department_ids,
        COALESCE(f.generated, false) as generated
    FROM fields_resource f
    LEFT JOIN all_fields_data afd ON afd.field_id = f.id
    LEFT JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    WHERE EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true)
    GROUP BY f.id, (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), afd.department_ids, f.generated
),
-- Parameter items FROM parameter_artifact (fields connected to parameter)
field_departments_data AS (
    SELECT 
        f.id as field_id,
        COALESCE(ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) FILTER (WHERE fd.department_id IS NOT NULL), ARRAY[]::text[]) as department_ids
    FROM params x
    JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = COALESCE(x.parameter_id, (SELECT id FROM default_parameter LIMIT 1)) AND EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true)
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    GROUP BY f.id
),
fields_with_usage AS (
    SELECT 
        f.id,
        (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1),
        (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1),
        false as "default",  -- Default flag no longer available after denormalization
        COALESCE(COUNT(sf.scenario_id), 0) as usage_count,
        COALESCE(fdd.department_ids, ARRAY[]::text[]) as department_ids
    FROM params x
    JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = COALESCE(x.parameter_id, (SELECT id FROM default_parameter LIMIT 1)) AND EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true)
    LEFT JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    LEFT JOIN field_departments_data fdd ON fdd.field_id = f.id
    GROUP BY f.id, (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1), (SELECT d.description FROM field_descriptions fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = f.id LIMIT 1), fdd.department_ids
),
field_connections_data AS (
    SELECT 
        f.id as field_id,
        false as "default",  -- Default flag no longer available after denormalization
        EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = TRUE) as connection_active
    FROM params x
    JOIN fields_resource f ON (SELECT pf.parameter_id FROM parameter_fields pf WHERE pf.field_id = f.id LIMIT 1) = x.parameter_id AND EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags AND ff.value = true)
    WHERE x.parameter_id IS NOT NULL
),
-- Valid departments (user's departments)
valid_depts AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM params x
    JOIN departments_resource d ON EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.id AND df.type = 'active'::type_department_flags AND df.value = true)
    JOIN profile_departments pd ON d.id = pd.department_id AND pd.profile_id = x.profile_id AND pd.active = true
),
-- Department mapping data (for multi-select resource pattern)
department_mapping_data AS (
    SELECT 
        d.department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.department_id LIMIT 1), '') as description,
        COALESCE(d.generated, false) as generated
    FROM params x
    CROSS JOIN user_profile up
    JOIN departments_resource d ON (
        -- Only include departments with active flag AND user is linked to them
        EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.department_id AND df.type = 'active'::type_department_flags AND df.value = true)
        AND
        EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.department_id AND pd.profile_id = x.profile_id AND pd.active = true)
    )
),
-- Personas filtered by parameter's departments (or user's departments for new mode)
filtered_personas AS (
    SELECT DISTINCT 
        p.id as persona_id,
        (SELECT n.name FROM persona_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM persona_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as description,
        COALESCE(p.generated, false) as generated
    FROM params x
    JOIN persona_artifact p ON EXISTS (SELECT 1 FROM persona_flags pf WHERE pf.persona_id = p.id AND pf.type = 'active'::type_persona_flags AND pf.value = true)
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    CROSS JOIN parameter_departments_aggregated pda
    WHERE (
        (pda.department_ids IS NULL OR array_length(pda.department_ids, 1) = 0)
        OR (pda.department_ids IS NOT NULL AND pd.department_id = ANY(pda.department_ids::uuid[]))
        OR NOT EXISTS (
            SELECT 1 FROM persona_departments pd2 
            WHERE pd2.persona_id = p.id AND pd2.active = true
        )
    )
),
-- Documents filtered by parameter's departments (or user's departments for new mode)
filtered_documents AS (
    SELECT DISTINCT 
        d.id as document_id,
        (SELECT n.name FROM document_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM document_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.document_id = d.id LIMIT 1), '') as description,
        COALESCE(d.generated, false) as generated
    FROM params x
    JOIN document_artifact d ON EXISTS (SELECT 1 FROM document_flags df WHERE df.document_id = d.id AND df.type = 'active'::type_document_flags AND df.value = true)
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    CROSS JOIN parameter_departments_aggregated pda
    WHERE (
        (pda.department_ids IS NULL OR array_length(pda.department_ids, 1) = 0)
        OR (pda.department_ids IS NOT NULL AND dd.department_id = ANY(pda.department_ids::uuid[]))
        OR NOT EXISTS (
            SELECT 1 FROM document_departments dd2 
            WHERE dd2.document_id = d.id AND dd2.active = true
        )
    )
),
-- Tool existence checks
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resources 
              AND t.active = true
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'fields'::resources 
              AND t.active = true
        ) as fields_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'personas'::resources 
              AND t.active = true
        ) as personas_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'documents'::resources 
              AND t.active = true
        ) as documents_has_tools
    FROM params x
),
-- UI flags (show flags for resources)
ui_flags AS (
    SELECT 
        CASE 
            WHEN (SELECT COUNT(*) FROM department_mapping_data) > 0 THEN true
            ELSE false
        END as show_departments,
        CASE 
            WHEN (SELECT COUNT(*) FROM all_fields_with_usage) > 0 THEN true
            ELSE false
        END as show_fields,
        CASE 
            WHEN (SELECT COUNT(*) FROM filtered_personas) > 0 THEN true
            ELSE false
        END as show_personas,
        CASE 
            WHEN (SELECT COUNT(*) FROM filtered_documents) > 0 THEN true
            ELSE false
        END as show_documents
    FROM params x
),
-- Missing tools check
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            CASE WHEN NOT tec.departments_has_tools AND uf.show_departments THEN 'departments' ELSE NULL END,
            CASE WHEN NOT tec.fields_has_tools AND uf.show_fields THEN 'fields' ELSE NULL END,
            CASE WHEN NOT tec.personas_has_tools AND uf.show_personas THEN 'personas' ELSE NULL END,
            CASE WHEN NOT tec.documents_has_tools AND uf.show_documents THEN 'documents' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM params x
    CROSS JOIN ui_flags uf
    CROSS JOIN tools_existence_check tec
),
-- Permissions data
permissions_data_with_tools AS (
    SELECT 
        pdd.department_ids,
        CASE 
            WHEN (SELECT parameter_id FROM params) IS NULL THEN
                -- New mode permissions
                CASE 
                    WHEN up.role = 'superadmin' THEN true
                    WHEN EXISTS (SELECT 1 FROM user_departments LIMIT 1) THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode permissions
                CASE 
                    WHEN pdd.department_ids IS NULL AND up.role != 'superadmin' THEN false
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
                    ELSE false
                END
        END as base_can_edit,
        CASE 
            WHEN (SELECT parameter_id FROM params) IS NULL THEN
                -- New mode: always editable if can_edit is true
                NULL::text
            ELSE
                -- Detail mode: compute disabled_reason
                CASE 
                    WHEN pdd.department_ids IS NULL AND up.role != 'superadmin' THEN 
                        'This is a default parameter that cannot be edited. You can view the details but cannot make changes.'::text
                    WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN 
                        NULL::text
                    ELSE 
                        'This parameter cannot be edited. You can view the details but cannot make changes.'::text
                END
        END as base_disabled_reason
    FROM params x
    LEFT JOIN parameter_departments_data pdd ON true
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
),
-- Agent selection CTEs (simplified - parameters don't have complex agent selection like personas)
departments_agent_data AS (
    SELECT NULL::uuid as agent_id
    FROM params
    LIMIT 1
),
fields_agent_data AS (
    SELECT NULL::uuid as agent_id
    FROM params
    LIMIT 1
),
personas_agent_data AS (
    SELECT NULL::uuid as agent_id
    FROM params
    LIMIT 1
),
documents_agent_data AS (
    SELECT NULL::uuid as agent_id
    FROM params
    LIMIT 1
),
-- Suggestions CTEs (UUID arrays)
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pd.department_id ORDER BY pd.created_at DESC)
             FROM (
                 SELECT DISTINCT pd.department_id, MAX(pd.created_at) as created_at
                 FROM parameter_departments pd
                 JOIN departments_resource d ON d.id = pd.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pd.department_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.id AND df.type = 'active'::type_department_flags
                         AND df.value = true
                   )
                   AND (
                       pd.active = true
                       OR
                       (
                           pd.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = d.call_id
                                 AND gr.group_id = dgd.group_id
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
    LIMIT 1
),
field_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(pf.field_id ORDER BY pf.created_at DESC)
             FROM (
                 SELECT DISTINCT pf.field_id, MAX(pf.created_at) as created_at
                 FROM parameter_fields pf
                 JOIN fields_resource f ON f.id = pf.field_id
                 CROSS JOIN draft_group_data dgd
                 WHERE pf.field_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = f.id AND ff.type = 'active'::type_field_flags
                         AND ff.value = true
                   )
                   AND (
                       -- Always include (parameter_fields junction table means it's validated/used)
                       -- OR linked to same group with generated=true
                       pf.generated = false
                       OR
                       (
                           pf.generated = true
                           AND f.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_calls mc ON mc.call_id = c.id
                               JOIN message_runs mr ON mr.message_id = mc.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = f.call_id
                                 AND gr.group_id = dgd.group_id
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
    LIMIT 1
),
persona_suggestions_data AS (
    SELECT 
        ARRAY[]::uuid[] as persona_suggestions
    FROM params
    LIMIT 1
),
document_suggestions_data AS (
    SELECT 
        ARRAY[]::uuid[] as document_suggestions
    FROM params
    LIMIT 1
),
-- Resource IDs data (selected IDs for parameter)
department_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT parameter_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pd.department_id ORDER BY pd.created_at)
                 FROM parameter_departments pd
                 WHERE pd.parameter_id = (SELECT parameter_id FROM params)
                   AND pd.active = true),
                ARRAY[]::uuid[]
            )
        END as department_ids
    FROM params
    LIMIT 1
),
field_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT parameter_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pf.field_id ORDER BY pf.created_at)
                 FROM parameter_fields pf
                 WHERE pf.parameter_id = (SELECT parameter_id FROM params)
                   AND EXISTS (SELECT 1 FROM field_flags ff WHERE ff.field_id = pf.field_id AND ff.type = 'active'::type_field_flags AND ff.value = true)),
                ARRAY[]::uuid[]
            )
        END as field_ids
    FROM params
    LIMIT 1
),
persona_ids_data AS (
    SELECT 
        ARRAY[]::uuid[] as persona_ids
    FROM params
    LIMIT 1
),
document_ids_data AS (
    SELECT 
        ARRAY[]::uuid[] as document_ids
    FROM params
    LIMIT 1
)
SELECT
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    (SELECT parameter_exists FROM parameter_exists_check) as parameter_exists,
    perm_final.can_edit,
    perm_final.disabled_reason,
    dgd.group_id,
    -- Basic parameter fields (merged with draft payload)
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        pd.name::text
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        pd.description::text
    ) as description,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        pd.active::boolean
    ) as active,
    COALESCE(
        (SELECT (payload->>'simulation_parameter')::boolean FROM draft_payload_data),
        (SELECT (payload->>'simulationParameter')::boolean FROM draft_payload_data),
        pd.simulation_parameter::boolean
    ) as simulation_parameter,
    COALESCE(
        (SELECT (payload->>'document_parameter')::boolean FROM draft_payload_data),
        (SELECT (payload->>'documentParameter')::boolean FROM draft_payload_data),
        pd.document_parameter::boolean
    ) as document_parameter,
    COALESCE(
        (SELECT (payload->>'persona_parameter')::boolean FROM draft_payload_data),
        (SELECT (payload->>'personaParameter')::boolean FROM draft_payload_data),
        pd.persona_parameter::boolean
    ) as persona_parameter,
    COALESCE(
        (SELECT (payload->>'scenario_parameter')::boolean FROM draft_payload_data),
        (SELECT (payload->>'scenarioParameter')::boolean FROM draft_payload_data),
        pd.scenario_parameter::boolean
    ) as scenario_parameter,
    COALESCE(
        (SELECT (payload->>'video_parameter')::boolean FROM draft_payload_data),
        (SELECT (payload->>'videoParameter')::boolean FROM draft_payload_data),
        pd.video_parameter::boolean
    ) as video_parameter,
    -- Multi-select resources: departments
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'department_ids' IS NOT NULL AND jsonb_typeof(payload->'department_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids'))::uuid[]
                WHEN payload->'departmentIds' IS NOT NULL AND jsonb_typeof(payload->'departmentIds') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'departmentIds'))::uuid[]
                ELSE NULL
            END
        FROM draft_payload_data),
        CASE 
            WHEN (SELECT parameter_id FROM params) IS NULL THEN
                ARRAY[]::uuid[]
            ELSE did_dept.department_ids
        END
    ) as department_ids,
    -- Department resources (selected departments filtered by department_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_parameter_v4_department
            ORDER BY dmd.name
        )
        FROM department_mapping_data dmd
        WHERE dmd.department_id = ANY(
            COALESCE(
                (SELECT 
                    CASE 
                        WHEN payload->'department_ids' IS NOT NULL AND jsonb_typeof(payload->'department_ids') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids'))::uuid[]
                        WHEN payload->'departmentIds' IS NOT NULL AND jsonb_typeof(payload->'departmentIds') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'departmentIds'))::uuid[]
                        ELSE NULL
                    END
                FROM draft_payload_data),
                CASE 
                    WHEN (SELECT parameter_id FROM params) IS NULL THEN
                        ARRAY[]::uuid[]
                    ELSE did_dept.department_ids
                END
            )
        )),
        '{}'::types.q_get_parameter_v4_department[]
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
    COALESCE((SELECT department_suggestions FROM department_suggestions_data), ARRAY[]::uuid[]) as department_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_parameter_v4_department
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM department_mapping_data) dmd),
        '{}'::types.q_get_parameter_v4_department[]
    ) as departments,
    -- Multi-select resources: fields
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'field_ids' IS NOT NULL AND jsonb_typeof(payload->'field_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'field_ids'))::uuid[]
                WHEN payload->'fieldIds' IS NOT NULL AND jsonb_typeof(payload->'fieldIds') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'fieldIds'))::uuid[]
                ELSE NULL
            END
        FROM draft_payload_data),
        fid.field_ids
    ) as field_ids,
    -- Field resources (selected fields filtered by field_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (afwu.id, afwu.name, afwu.description, afwu.usage_count, afwu.department_ids, afwu.generated)::types.q_get_parameter_v4_field
            ORDER BY afwu.name
        )
        FROM all_fields_with_usage afwu
        WHERE afwu.id = ANY(
            COALESCE(
                (SELECT 
                    CASE 
                        WHEN payload->'field_ids' IS NOT NULL AND jsonb_typeof(payload->'field_ids') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'field_ids'))::uuid[]
                        WHEN payload->'fieldIds' IS NOT NULL AND jsonb_typeof(payload->'fieldIds') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'fieldIds'))::uuid[]
                        ELSE NULL
                    END
                FROM draft_payload_data),
                fid.field_ids
            )
        )),
        '{}'::types.q_get_parameter_v4_field[]
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
    COALESCE((SELECT field_suggestions FROM field_suggestions_data), ARRAY[]::uuid[]) as field_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (afwu.id, afwu.name, afwu.description, afwu.usage_count, afwu.department_ids, afwu.generated)::types.q_get_parameter_v4_field
            ORDER BY afwu.name
        ) FROM (
            SELECT DISTINCT afwu.id, afwu.name, afwu.description, afwu.usage_count, afwu.department_ids, afwu.generated
            FROM all_fields_with_usage afwu
            CROSS JOIN params p
            WHERE 
                afwu.id IS NOT NULL
                -- Search filter: if field_search provided, match name or description
                AND (p.field_search IS NULL OR p.field_search = '' OR
                 LOWER(afwu.name) LIKE '%' || LOWER(p.field_search) || '%' OR
                 LOWER(afwu.description) LIKE '%' || LOWER(p.field_search) || '%')
                -- Show selected filter: if enabled, only show selected fields
                AND (
                    NOT p.field_show_selected OR
                    afwu.id = ANY(
                        COALESCE(
                            (SELECT 
                                CASE 
                                    WHEN payload->'field_ids' IS NOT NULL AND jsonb_typeof(payload->'field_ids') = 'array' THEN
                                        ARRAY(SELECT jsonb_array_elements_text(payload->'field_ids'))::uuid[]
                                    WHEN payload->'fieldIds' IS NOT NULL AND jsonb_typeof(payload->'fieldIds') = 'array' THEN
                                        ARRAY(SELECT jsonb_array_elements_text(payload->'fieldIds'))::uuid[]
                                    ELSE NULL
                                END
                            FROM draft_payload_data),
                            fid.field_ids
                        )
                    )
                )
        ) afwu),
        '{}'::types.q_get_parameter_v4_field[]
    ) as fields,
    -- Multi-select resources: personas
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'persona_ids' IS NOT NULL AND jsonb_typeof(payload->'persona_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'persona_ids'))::uuid[]
                WHEN payload->'personaIds' IS NOT NULL AND jsonb_typeof(payload->'personaIds') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'personaIds'))::uuid[]
                ELSE NULL
            END
        FROM draft_payload_data),
        pid.persona_ids
    ) as persona_ids,
    -- Persona resources (selected personas filtered by persona_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (fp.persona_id, fp.name, fp.description, fp.generated)::types.q_get_parameter_v4_persona
            ORDER BY fp.name
        )
        FROM filtered_personas fp
        WHERE fp.persona_id = ANY(
            COALESCE(
                (SELECT 
                    CASE 
                        WHEN payload->'persona_ids' IS NOT NULL AND jsonb_typeof(payload->'persona_ids') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'persona_ids'))::uuid[]
                        WHEN payload->'personaIds' IS NOT NULL AND jsonb_typeof(payload->'personaIds') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'personaIds'))::uuid[]
                        ELSE NULL
                    END
                FROM draft_payload_data),
                pid.persona_ids
            )
        )),
        '{}'::types.q_get_parameter_v4_persona[]
    ) as persona_resources,
    CASE 
        WHEN NOT tec.personas_has_tools AND uf.show_personas THEN false
        ELSE uf.show_personas
    END as show_personas,
    (SELECT agent_id FROM personas_agent_data) as personas_agent_id,
    CASE 
        WHEN uf.show_personas THEN true
        ELSE false
    END as personas_required,
    COALESCE((SELECT persona_suggestions FROM persona_suggestions_data), ARRAY[]::uuid[]) as persona_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (fp.persona_id, fp.name, fp.description, fp.generated)::types.q_get_parameter_v4_persona
            ORDER BY fp.name
        ) FROM (SELECT DISTINCT persona_id, name, description, generated FROM filtered_personas) fp),
        '{}'::types.q_get_parameter_v4_persona[]
    ) as personas,
    -- Multi-select resources: documents
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'document_ids' IS NOT NULL AND jsonb_typeof(payload->'document_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'document_ids'))::uuid[]
                WHEN payload->'documentIds' IS NOT NULL AND jsonb_typeof(payload->'documentIds') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'documentIds'))::uuid[]
                ELSE NULL
            END
        FROM draft_payload_data),
        did_doc.document_ids
    ) as document_ids,
    -- Document resources (selected documents filtered by document_ids)
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.document_id, fd.name, fd.description, fd.generated)::types.q_get_parameter_v4_document
            ORDER BY fd.name
        )
        FROM filtered_documents fd
        WHERE fd.document_id = ANY(
            COALESCE(
                (SELECT 
                    CASE 
                        WHEN payload->'document_ids' IS NOT NULL AND jsonb_typeof(payload->'document_ids') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'document_ids'))::uuid[]
                        WHEN payload->'documentIds' IS NOT NULL AND jsonb_typeof(payload->'documentIds') = 'array' THEN
                            ARRAY(SELECT jsonb_array_elements_text(payload->'documentIds'))::uuid[]
                        ELSE NULL
                    END
                FROM draft_payload_data),
                did_doc.document_ids
            )
        )),
        '{}'::types.q_get_parameter_v4_document[]
    ) as document_resources,
    CASE 
        WHEN NOT tec.documents_has_tools AND uf.show_documents THEN false
        ELSE uf.show_documents
    END as show_documents,
    (SELECT agent_id FROM documents_agent_data) as documents_agent_id,
    CASE 
        WHEN uf.show_documents THEN true
        ELSE false
    END as documents_required,
    COALESCE((SELECT document_suggestions FROM document_suggestions_data), ARRAY[]::uuid[]) as document_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.document_id, fd.name, fd.description, fd.generated)::types.q_get_parameter_v4_document
            ORDER BY fd.name
        ) FROM (SELECT DISTINCT document_id, name, description, generated FROM filtered_documents) fd),
        '{}'::types.q_get_parameter_v4_document[]
    ) as documents,
    -- Parameter items (fields connected to parameter)
    COALESCE(
        (SELECT ARRAY_AGG(
            (fwu.id, fwu.name, fwu.description, fwu."default", fwu.usage_count, fwu.department_ids)::types.q_get_parameter_v4_item
            ORDER BY fwu.name
        ) FROM fields_with_usage fwu),
        '{}'::types.q_get_parameter_v4_item[]
    ) as parameter_items,
    -- Field connections
    COALESCE(
        (SELECT ARRAY_AGG(
            (fcd.field_id, fcd."default", fcd.connection_active)::types.q_get_parameter_v4_field_connection
            ORDER BY fcd.field_id
        ) FROM field_connections_data fcd),
        '{}'::types.q_get_parameter_v4_field_connection[]
    ) as field_connections,
    -- Draft and field state
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version,
    COALESCE(
        (SELECT payload->'fieldIds' FROM draft_payload_data),
        (SELECT payload->'field_ids' FROM draft_payload_data),
        (SELECT jsonb_agg(fcd.field_id::text ORDER BY fcd.field_id) FROM field_connections_data fcd),
        '[]'::jsonb
    ) as field_ids_jsonb,
    COALESCE(
        (SELECT payload->'fieldActiveStates' FROM draft_payload_data),
        (SELECT payload->'field_active_states' FROM draft_payload_data),
        (SELECT jsonb_object_agg(fcd.field_id::text, fcd.connection_active) FROM field_connections_data fcd),
        '{}'::jsonb
    ) as field_active_states,
    COALESCE(
        (SELECT payload->'fieldDefaultStates' FROM draft_payload_data),
        (SELECT payload->'field_default_states' FROM draft_payload_data),
        (SELECT jsonb_object_agg(fcd.field_id::text, fcd."default") FROM field_connections_data fcd),
        '{}'::jsonb
    ) as field_default_states,
    -- Valid IDs arrays
    COALESCE(
        (SELECT ARRAY_AGG(vd.department_id::text ORDER BY vd.department_id)
         FROM valid_depts vd),
        ARRAY[]::text[]
    ) as valid_department_ids,
    COALESCE(
        (SELECT ARRAY_AGG(afwu.id::text ORDER BY afwu.id)
         FROM all_fields_with_usage afwu),
        ARRAY[]::text[]
    ) as valid_field_ids,
    COALESCE(
        (SELECT ARRAY_AGG(fp.persona_id::text ORDER BY fp.persona_id)
         FROM filtered_personas fp),
        ARRAY[]::text[]
    ) as valid_persona_ids,
    COALESCE(
        (SELECT ARRAY_AGG(fd.document_id::text ORDER BY fd.document_id)
         FROM filtered_documents fd),
        ARRAY[]::text[]
    ) as valid_document_ids
FROM user_profile up
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
LEFT JOIN parameter_departments_data pdd ON true
CROSS JOIN draft_group_data dgd
CROSS JOIN parameter_data pd
CROSS JOIN department_ids_data did_dept
CROSS JOIN field_ids_data fid
CROSS JOIN persona_ids_data pid
CROSS JOIN document_ids_data did_doc
$$;
