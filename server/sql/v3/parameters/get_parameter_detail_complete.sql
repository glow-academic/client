WITH parameter_id_resolved AS (
    -- Explicitly cast $1 to UUID for consistent type handling
    SELECT $1::uuid as parameter_id
),
resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $2::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    -- Resolve "guest-profile-id" to actual default guest profile ID
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
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
        -- Field-level departments (for backward compatibility)
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
linked_persona_ids AS (
    SELECT 
        ARRAY_AGG(pp.persona_id::text ORDER BY pp.created_at) as persona_ids
    FROM parameter_id_resolved pid
    JOIN parameter_personas pp ON pp.parameter_id = pid.parameter_id AND pp.active = true
),
linked_document_ids AS (
    SELECT 
        ARRAY_AGG(pd.document_id::text ORDER BY pd.created_at) as document_ids
    FROM parameter_id_resolved pid
    JOIN parameter_documents pd ON pd.parameter_id = pid.parameter_id AND pd.active = true
),
linked_scenario_ids AS (
    SELECT 
        ARRAY_AGG(sp.scenario_id::text ORDER BY sp.created_at) as scenario_ids
    FROM parameter_id_resolved pid
    JOIN scenario_parameters sp ON sp.parameter_id = pid.parameter_id AND sp.active = true
),
linked_video_ids AS (
    SELECT 
        ARRAY_AGG(vp.video_id::text ORDER BY vp.created_at) as video_ids
    FROM parameter_id_resolved pid
    JOIN video_parameters vp ON vp.parameter_id = pid.parameter_id AND vp.active = true
),
parameter_data AS (
    SELECT 
        p.name,
        p.description,
        p.active,
        p.practice_parameter,
        COALESCE(pda.department_ids, NULL) as department_ids,
        COALESCE(lpi.persona_ids, ARRAY[]::text[]) as persona_ids,
        COALESCE(ldi.document_ids, ARRAY[]::text[]) as document_ids,
        COALESCE(lsi.scenario_ids, ARRAY[]::text[]) as scenario_ids,
        COALESCE(lvi.video_ids, ARRAY[]::text[]) as video_ids,
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
    LEFT JOIN linked_persona_ids lpi ON true
    LEFT JOIN linked_document_ids ldi ON true
    LEFT JOIN linked_scenario_ids lsi ON true
    LEFT JOIN linked_video_ids lvi ON true
    CROSS JOIN user_profile up
),
fields_with_usage AS (
    SELECT 
        f.id,
        f.name,
        f.description,
        pf.default,
        COALESCE(COUNT(sf.scenario_id), 0) as usage_count,
        COALESCE(fdd.department_ids, NULL) as department_ids
    FROM parameter_id_resolved pid
    JOIN parameter_fields pf ON pf.parameter_id = pid.parameter_id AND pf.active = true
    JOIN fields f ON f.id = pf.field_id AND f.active = true
    LEFT JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    LEFT JOIN field_departments_data fdd ON fdd.field_id = f.id
    GROUP BY f.id, f.name, f.description, pf.default, fdd.department_ids
),
items_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'parameter_item_id', id::text,
                'name', name,
                'description', description,
                'default', default,
                'usage_count', usage_count,
                'department_ids', department_ids
            )
            ORDER BY name
        ),
        '[]'::jsonb
    ) as items
    FROM fields_with_usage
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
    vd.dept_ids as valid_department_ids
FROM parameter_data p
CROSS JOIN items_json ij
CROSS JOIN valid_depts vd
CROSS JOIN user_has_parameter_access uhpa
WHERE uhpa.has_access = true

