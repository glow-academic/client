-- Get default parameter detail for creation
-- Parameters: $1 = profile_id (uuid)

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        $1::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $1::uuid
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
field_departments_for_filter AS (
    SELECT DISTINCT
        fp.parameter_id,
        fd.department_id
    FROM parameter_fields fp
    JOIN field_departments fd ON fd.field_id = fp.field_id
    WHERE fp.active = true AND fd.active = true
),
default_parameter AS (
    SELECT p.id
    FROM parameters p
    LEFT JOIN field_departments_for_filter fdf ON fdf.parameter_id = p.id
    WHERE p.active = true
    GROUP BY p.id
    HAVING 
        -- Include if has matching department link via parameter_departments or field_departments OR has no department links at all (cross-dept)
        COUNT(fdf.parameter_id) FILTER (WHERE fdf.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (
            SELECT 1 FROM parameter_departments pd2 WHERE pd2.parameter_id = p.id AND pd2.active = true
        )
        AND NOT EXISTS (
            SELECT 1 FROM field_departments fd2 
            JOIN parameter_fields fp2 ON fp2.field_id = fd2.field_id 
            WHERE fp2.parameter_id = p.id AND fp2.active = true AND fd2.active = true
        )
    ORDER BY p.created_at DESC
    LIMIT 1
),
parameter_departments_aggregated AS (
    -- Get parameter-level departments (union of parameter_departments and field_departments)
    SELECT 
        ARRAY_AGG(DISTINCT dept_id::text ORDER BY dept_id::text) as department_ids
    FROM (
        -- Parameter-level departments
        SELECT pd.department_id as dept_id
        FROM parameter_departments pd
        JOIN default_parameter dp ON pd.parameter_id = dp.id
        WHERE pd.active = true
        UNION
        -- Field-level departments ()
        SELECT fd.department_id as dept_id
        FROM parameter_fields fp
        JOIN default_parameter dp ON fp.parameter_id = dp.id
        JOIN field_departments fd ON fd.field_id = fp.field_id AND fd.active = true
        WHERE fp.active = true
    ) combined_depts
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
-- Field connections JSON (empty for new parameter)
field_connections_json AS (
    SELECT '[]'::jsonb as connections
),
-- Personas filtered by user's available departments
filtered_personas AS (
    SELECT DISTINCT p.id, p.name, COALESCE(p.description, '') as description
    FROM personas p
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    CROSS JOIN user_departments ud
    WHERE p.active = true
    AND (
        -- Include if persona is in user's departments
        pd.department_id = ud.department_id
        -- Or if persona has no department restrictions (cross-department persona)
        OR NOT EXISTS (
            SELECT 1 FROM persona_departments pd2 
            WHERE pd2.persona_id = p.id AND pd2.active = true
        )
    )
),
available_personas_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            per.id::text,
            jsonb_build_object(
                'name', per.name,
                'description', per.description
            )
        ),
        '{}'::jsonb
    ) as mapping,
    array_agg(per.id::text ORDER BY per.name) as ids
    FROM filtered_personas per
),
-- Documents filtered by user's available departments
filtered_documents AS (
    SELECT DISTINCT d.id, d.name, COALESCE(d.description, '') as description
    FROM documents d
    LEFT JOIN document_departments dd ON dd.document_id = d.id AND dd.active = true
    CROSS JOIN user_departments ud
    WHERE d.active = true
    AND (
        -- Include if document is in user's departments
        dd.department_id = ud.department_id
        -- Or if document has no department restrictions (cross-department document)
        OR NOT EXISTS (
            SELECT 1 FROM document_departments dd2 
            WHERE dd2.document_id = d.id AND dd2.active = true
        )
    )
),
available_documents_mapping AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.name,
                'description', d.description
            )
        ),
        '{}'::jsonb
    ) as mapping,
    array_agg(d.id::text ORDER BY d.name) as ids
    FROM filtered_documents d
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
        COALESCE(pda.department_ids, NULL) as department_ids
    FROM parameters p
    JOIN default_parameter dp ON p.id = dp.id
    LEFT JOIN parameter_departments_aggregated pda ON true
),
field_departments_data AS (
    SELECT 
        f.id as parameter_item_id,
        ARRAY_AGG(fd.department_id::text ORDER BY fd.created_at) as department_ids
    FROM fields f
    JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
    JOIN default_parameter dp ON fp.parameter_id = dp.id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    GROUP BY f.id
),
parameter_items_with_usage AS (
    SELECT 
        f.id,
        f.name,
        f.description,
        COALESCE(COUNT(sf.scenario_id), 0) as usage_count,
        COALESCE(fdd.department_ids, NULL) as department_ids
    FROM fields f
    JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
    JOIN default_parameter dp ON fp.parameter_id = dp.id
    LEFT JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    LEFT JOIN field_departments_data fdd ON fdd.parameter_item_id = f.id
    GROUP BY f.id, f.name, f.description, fdd.department_ids
),
items_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'parameter_item_id', id::text,
                'name', name,
                'description', description,
                'usage_count', usage_count,
                'department_ids', department_ids
            )
            ORDER BY name
        ),
        '[]'::jsonb
    ) as items
    FROM parameter_items_with_usage
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
    FROM departments d
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = rpi.resolved_profile_id AND d.active = true
),
primary_department_id AS (
    SELECT department_id::text
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.is_primary = TRUE
    LIMIT 1
)
SELECT 
    p.*,
    ij.items as parameter_items_json,
    vd.dept_mapping as department_mapping,
    vd.dept_ids as valid_department_ids,
    pdi.department_id as primary_department_id,
    fmj.mapping as field_mapping,
    fmj.ids as valid_field_ids,
    fcj.connections as field_connections_json,
    apm.mapping as persona_mapping,
    apm.ids as valid_persona_ids,
    adm.mapping as document_mapping,
    adm.ids as valid_document_ids,
    ap.actor_name
FROM parameter_data p
CROSS JOIN items_json ij
CROSS JOIN valid_depts vd
LEFT JOIN primary_department_id pdi ON true
CROSS JOIN field_mapping_json fmj
CROSS JOIN field_connections_json fcj
CROSS JOIN available_personas_mapping apm
CROSS JOIN available_documents_mapping adm
CROSS JOIN actor_profile ap

