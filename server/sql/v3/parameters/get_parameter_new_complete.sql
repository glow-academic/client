-- Get default parameter detail for creation
-- Parameters: $1 = profile_id (uuid or "guest-profile-id")

WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN settings_departments sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $1::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
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
    FROM field_parameters fp
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
            JOIN field_parameters fp2 ON fp2.field_id = fd2.field_id 
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
        -- Field-level departments (for backward compatibility)
        SELECT fd.department_id as dept_id
        FROM field_parameters fp
        JOIN default_parameter dp ON fp.parameter_id = dp.id
        JOIN field_departments fd ON fd.field_id = fp.field_id AND fd.active = true
        WHERE fp.active = true
    ) combined_depts
),
parameter_data AS (
    SELECT 
        p.name,
        p.description,
        p.numerical,
        p.active,
        p.document_parameter,
        p.practice_parameter,
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
    JOIN field_parameters fp ON fp.field_id = f.id AND fp.active = true
    JOIN default_parameter dp ON fp.parameter_id = dp.id
    LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
    GROUP BY f.id
),
parameter_items_with_usage AS (
    SELECT 
        f.id,
        f.name,
        f.description,
        f.value,
        COALESCE(COUNT(sf.scenario_id), 0) as usage_count,
        COALESCE(fdd.department_ids, NULL) as department_ids
    FROM fields f
    JOIN field_parameters fp ON fp.field_id = f.id AND fp.active = true
    JOIN default_parameter dp ON fp.parameter_id = dp.id
    LEFT JOIN scenario_fields sf ON sf.field_id = f.id AND sf.active = true
    LEFT JOIN field_departments_data fdd ON fdd.parameter_item_id = f.id
    GROUP BY f.id, f.name, f.description, f.value, fdd.department_ids
),
items_json AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'parameter_item_id', id::text,
                'name', name,
                'description', description,
                'value', value,
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
    pdi.department_id as primary_department_id
FROM parameter_data p
CROSS JOIN items_json ij
CROSS JOIN valid_depts vd
LEFT JOIN primary_department_id pdi ON true

