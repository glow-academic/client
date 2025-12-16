WITH parameter_id_resolved AS (
    -- Explicitly cast $1 to UUID for consistent type handling
    SELECT $1::uuid as parameter_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT 
        up.id,
        up.role
    FROM resolve_profile_id rpi
    JOIN profiles up ON up.id = rpi.resolved_profile_id
),
parameter_active_scenario_links AS (
    SELECT 
        pf.parameter_id,
        COUNT(DISTINCT sf.scenario_id) as active_scenario_count
    FROM parameter_id_resolved pid
    JOIN parameter_fields pf ON pf.parameter_id = pid.parameter_id AND pf.active = true
    JOIN scenario_fields sf ON sf.field_id = pf.field_id AND sf.active = true
    GROUP BY pf.parameter_id
),
field_departments_data AS (
    SELECT 
        f.id as field_id,
        ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) as department_ids
    FROM parameter_id_resolved pid
    JOIN parameter_fields pf ON pf.parameter_id = pid.parameter_id AND pf.active = true
    JOIN fields f ON f.id = pf.field_id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    GROUP BY f.id
),
parameter_departments_aggregated AS (
    -- Get department IDs from both parameter-level and field-level departments
    SELECT 
        ARRAY_AGG(DISTINCT dept_id::text ORDER BY dept_id::text) as department_ids
    FROM (
        -- Parameter-level departments
        SELECT pd.department_id as dept_id
        FROM parameter_id_resolved pid
        JOIN parameter_departments pd ON pd.parameter_id = pid.parameter_id AND pd.active = true
        UNION
        -- Field-level departments ()
        SELECT fd.department_id as dept_id
        FROM parameter_id_resolved pid
        JOIN parameter_fields pf ON pf.parameter_id = pid.parameter_id AND pf.active = true
        JOIN field_departments fd ON fd.field_id = pf.field_id AND fd.active = true
    ) combined_depts
),
user_has_parameter_access AS (
    -- Check if user has access to parameter via parameter_departments or field_departments
    SELECT EXISTS(
        -- Check parameter-level departments
        SELECT 1 FROM parameter_departments pd
        JOIN profile_departments pdp ON pdp.department_id = pd.department_id
        WHERE pd.parameter_id = (SELECT parameter_id FROM parameter_id_resolved)
        AND pd.active = true
        AND pdp.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
        AND pdp.active = true
    ) OR EXISTS(
        -- Check field-level departments
        SELECT 1 FROM field_departments fd
        JOIN profile_departments pd ON pd.department_id = fd.department_id
        JOIN parameter_fields pf ON pf.field_id = fd.field_id
        WHERE pf.parameter_id = (SELECT parameter_id FROM parameter_id_resolved)
        AND pf.active = true
        AND fd.active = true
        AND pd.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
        AND pd.active = true
    ) OR EXISTS(
        SELECT 1 FROM resolve_profile_id rpi
        JOIN profiles p ON p.id = rpi.resolved_profile_id
        WHERE p.role = 'superadmin'
    ) OR (
        -- Default parameters (no department links at parameter or field level) are accessible to all
        (SELECT COUNT(*) FROM parameter_departments pd
         WHERE pd.parameter_id = (SELECT parameter_id FROM parameter_id_resolved)
         AND pd.active = true) = 0
        AND (SELECT COUNT(*) FROM field_departments fd
             JOIN parameter_fields pf ON pf.field_id = fd.field_id
             WHERE pf.parameter_id = (SELECT parameter_id FROM parameter_id_resolved)
             AND pf.active = true
             AND fd.active = true) = 0
    ) as has_access
),
parameter_data AS (
    SELECT 
        p.name,
        p.description,
        p.active,
        p.simulation_parameter,
        p.document_parameter,
        p.persona_parameter,
        p.scenario_parameter,
        p.video_parameter,
        COALESCE(pda.department_ids, NULL) as department_ids,
        ARRAY[]::text[] as persona_ids,
        ARRAY[]::text[] as document_ids,
        CASE 
            WHEN COALESCE(pasl.active_scenario_count, 0) > 0 THEN false
            -- Default parameters (no department_ids) are read-only for non-superadmin
            WHEN (COALESCE(pda.department_ids, NULL) IS NULL OR array_length(pda.department_ids, 1) = 0) AND up.role != 'superadmin' THEN false
            WHEN up.role = 'superadmin' THEN true
            WHEN up.role IN ('admin', 'instructional') THEN true
            ELSE false
        END as can_edit
    FROM parameter_id_resolved pid
    JOIN parameters p ON p.id = pid.parameter_id
    LEFT JOIN parameter_departments_aggregated pda ON true
    LEFT JOIN parameter_active_scenario_links pasl ON pasl.parameter_id = p.id
    CROSS JOIN user_profile up
),
-- All available fields (not just connected ones)
all_fields_data AS (
    SELECT 
        f.id as field_id,
        ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) as department_ids
    FROM fields f
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    WHERE f.active = true
    GROUP BY f.id
),
all_fields_with_usage AS (
    SELECT 
        f.id,
        f.name,
        f.description,
        COALESCE(COUNT(sf.scenario_id), 0) as usage_count,
        COALESCE(afd.department_ids, NULL) as department_ids
    FROM fields f
    LEFT JOIN all_fields_data afd ON afd.field_id = f.id
    LEFT JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    WHERE f.active = true
    GROUP BY f.id, f.name, f.description, afd.department_ids
),
-- Field connections (junction table data)
field_connections_data AS (
    SELECT 
        pf.field_id,
        pf."default",
        pf.active as connection_active
    FROM parameter_id_resolved pid
    JOIN parameter_fields pf ON pf.parameter_id = pid.parameter_id AND pf.active = true
),
-- Field connections JSON ( with parameter_items)
fields_with_usage AS (
    SELECT 
        f.id,
        f.name,
        f.description,
        COALESCE(fcd."default", false) as "default",
        COALESCE(COUNT(sf.scenario_id), 0) as usage_count,
        COALESCE(fdd.department_ids, NULL) as department_ids
    FROM parameter_id_resolved pid
    JOIN parameter_fields pf ON pf.parameter_id = pid.parameter_id AND pf.active = true
    JOIN fields f ON f.id = pf.field_id AND f.active = true
    LEFT JOIN field_connections_data fcd ON fcd.field_id = f.id
    LEFT JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    LEFT JOIN field_departments_data fdd ON fdd.field_id = f.id
    GROUP BY f.id, f.name, f.description, fcd."default", fdd.department_ids
),
items_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'parameter_item_id', id::text,
                'name', name,
                'description', description,
                'default', "default",
                'usage_count', usage_count,
                'department_ids', department_ids
            )
            ORDER BY name
        ),
        '[]'::jsonb
    ) as items
    FROM fields_with_usage
),
-- Field mapping (all available fields)
field_mapping_json AS (
    SELECT COALESCE(
        jsonb_object_agg(
            id::text,
            jsonb_build_object(
                'name', name,
                'description', description,
                'usage_count', usage_count,
                'department_ids', department_ids
            )
        ),
        '{}'::jsonb
    ) as mapping,
    array_agg(id::text ORDER BY name) as ids
    FROM all_fields_with_usage
),
-- Field connections JSON (with default and active flags)
field_connections_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'field_id', fcd.field_id::text,
                'default', fcd."default",
                'active', fcd.connection_active
            )
            ORDER BY fcd.field_id
        ),
        '[]'::jsonb
    ) as connections
    FROM field_connections_data fcd
),
-- Personas filtered by parameter's selected departments
parameter_department_ids AS (
    SELECT 
        dept_id as department_id
    FROM parameter_departments_aggregated pda
    CROSS JOIN LATERAL unnest(
        CASE 
            WHEN pda.department_ids IS NOT NULL AND array_length(pda.department_ids, 1) > 0
            THEN pda.department_ids::uuid[]
            ELSE ARRAY[]::uuid[]
        END
    ) AS dept_id
),
filtered_personas AS (
    SELECT DISTINCT p.id, p.name, COALESCE(p.description, '') as description
    FROM personas p
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    CROSS JOIN parameter_departments_aggregated pda
    WHERE p.active = true
    AND (
        -- Include if parameter has no departments (cross-department)
        (pda.department_ids IS NULL OR array_length(pda.department_ids, 1) = 0)
        -- Or if persona is in parameter's departments
        OR (pda.department_ids IS NOT NULL AND pd.department_id = ANY(pda.department_ids::uuid[]))
        -- Or if persona has no department restrictions (cross-department persona)
        OR NOT EXISTS (
            SELECT 1 FROM persona_departments pd2 
            WHERE pd2.persona_id = p.id AND pd2.active = true
        )
    )
),
persona_mapping_json AS (
    SELECT COALESCE(
        jsonb_object_agg(
            id::text,
            jsonb_build_object(
                'name', name,
                'description', description
            )
        ),
        '{}'::jsonb
    ) as mapping,
    array_agg(id::text ORDER BY name) as ids
    FROM filtered_personas
),
-- Documents filtered by parameter's selected departments
filtered_documents AS (
    SELECT DISTINCT d.id, d.name, COALESCE(d.description, '') as description
    FROM documents d
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    CROSS JOIN parameter_departments_aggregated pda
    WHERE d.active = true
    AND (
        -- Include if parameter has no departments (cross-department)
        (pda.department_ids IS NULL OR array_length(pda.department_ids, 1) = 0)
        -- Or if document is in parameter's departments
        OR (pda.department_ids IS NOT NULL AND dd.department_id = ANY(pda.department_ids::uuid[]))
        -- Or if document has no department restrictions (cross-department document)
        OR NOT EXISTS (
            SELECT 1 FROM document_departments dd2 
            WHERE dd2.document_id = d.id AND dd2.active = true
        )
    )
),
document_mapping_json AS (
    SELECT COALESCE(
        jsonb_object_agg(
            id::text,
            jsonb_build_object(
                'name', name,
                'description', description
            )
        ),
        '{}'::jsonb
    ) as mapping,
    array_agg(id::text ORDER BY name) as ids
    FROM filtered_documents
),
valid_depts AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                d.id::text,
                jsonb_build_object(
                    'name', d.title,
                    'description', COALESCE(d.description, '')
                )
            ),
            '{}'::jsonb
        ) as dept_mapping,
        array_agg(d.id::text ORDER BY d.title) as dept_ids
    FROM resolve_profile_id rpi
    JOIN departments d ON d.active = true
    JOIN profile_departments pd ON d.id = pd.department_id AND pd.profile_id = rpi.resolved_profile_id AND pd.active = true
)
SELECT 
    p.*,
    ij.items as parameter_items_json,
    vd.dept_mapping as department_mapping,
    vd.dept_ids as valid_department_ids,
    fmj.mapping as field_mapping,
    fmj.ids as valid_field_ids,
    fcj.connections as field_connections_json,
    pmj.mapping as persona_mapping,
    pmj.ids as valid_persona_ids,
    dmj.mapping as document_mapping,
    dmj.ids as valid_document_ids
FROM parameter_data p
CROSS JOIN items_json ij
CROSS JOIN valid_depts vd
CROSS JOIN field_mapping_json fmj
CROSS JOIN field_connections_json fcj
CROSS JOIN persona_mapping_json pmj
CROSS JOIN document_mapping_json dmj
CROSS JOIN user_has_parameter_access uhpa
WHERE uhpa.has_access = true

