WITH parameter_id_resolved AS (
    -- Explicitly cast $1 to UUID for consistent type handling
    SELECT $1::uuid as parameter_id
),
resolve_profile_id AS (
    -- Resolve "guest-profile-id" to actual default guest profile ID
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND first_name = 'Default' ORDER BY created_at DESC LIMIT 1)
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
        pi.parameter_id,
        COUNT(DISTINCT spi.scenario_id) as active_scenario_count
    FROM parameter_id_resolved pid
    JOIN parameter_items pi ON pi.parameter_id = pid.parameter_id
    JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id
    WHERE spi.active = true
    GROUP BY pi.parameter_id
),
parameter_item_departments_data AS (
    SELECT 
        pi.id as parameter_item_id,
        ARRAY_AGG(pid_dept.department_id::text ORDER BY pid_dept.created_at) as department_ids
    FROM parameter_id_resolved pid
    JOIN parameter_items pi ON pi.parameter_id = pid.parameter_id
    LEFT JOIN parameter_item_departments pid_dept ON pid_dept.parameter_item_id = pi.id AND pid_dept.active = true
    GROUP BY pi.id
),
parameter_departments_aggregated AS (
    SELECT 
        ARRAY_AGG(pid_dept.department_id::text ORDER BY pid_dept.department_id) as department_ids
    FROM parameter_id_resolved pid
    JOIN parameter_items pi ON pi.parameter_id = pid.parameter_id
    JOIN parameter_item_departments pid_dept ON pid_dept.parameter_item_id = pi.id AND pid_dept.active = true
),
user_has_parameter_access AS (
    -- Check if user has access to parameter via parameter item department links
    SELECT EXISTS(
        SELECT 1 FROM parameter_item_departments pid_dept
        JOIN profile_departments pd ON pd.department_id = pid_dept.department_id
        JOIN parameter_items pi ON pi.id = pid_dept.parameter_item_id
        WHERE pi.parameter_id = (SELECT parameter_id FROM parameter_id_resolved)
        AND pid_dept.active = true
        AND pd.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id)
        AND pd.active = true
    ) OR EXISTS(
        SELECT 1 FROM resolve_profile_id rpi
        JOIN profiles p ON p.id = rpi.resolved_profile_id
        WHERE p.role = 'superadmin'
    ) OR (
        -- Default parameters (no department links on any items) are accessible to all
        SELECT COUNT(*) FROM parameter_item_departments pid_dept
        JOIN parameter_items pi ON pi.id = pid_dept.parameter_item_id
        WHERE pi.parameter_id = (SELECT parameter_id FROM parameter_id_resolved)
        AND pid_dept.active = true
    ) = 0 as has_access
),
parameter_data AS (
    SELECT 
        p.name,
        p.description,
        p.numerical,
        p.active,
        p.document_parameter,
        p.practice_parameter,
        COALESCE(pda.department_ids, NULL) as department_ids,
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
parameter_items_with_usage AS (
    SELECT 
        pi.id,
        pi.name,
        pi.description,
        pi.value,
        COALESCE(COUNT(spi.scenario_id), 0) as usage_count,
        COALESCE(pidd.department_ids, NULL) as department_ids
    FROM parameter_id_resolved pid
    JOIN parameter_items pi ON pi.parameter_id = pid.parameter_id
    LEFT JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id AND spi.active = true
    LEFT JOIN parameter_item_departments_data pidd ON pidd.parameter_item_id = pi.id
    GROUP BY pi.id, pi.name, pi.description, pi.value, pidd.department_ids
),
items_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'parameter_item_id', id::text,
                'name', name,
                'description', description,
                'value', value,
                'usage_count', usage_count
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

