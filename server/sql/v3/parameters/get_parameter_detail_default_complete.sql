WITH user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM profile_departments pd
    WHERE pd.profile_id = $1 AND pd.active = true
),
parameter_item_departments_for_filter AS (
    SELECT DISTINCT
        pi.parameter_id,
        pid.department_id
    FROM parameter_items pi
    JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id
    WHERE pid.active = true
),
default_parameter AS (
    SELECT p.id
    FROM parameters p
    LEFT JOIN parameter_item_departments_for_filter pidf ON pidf.parameter_id = p.id
    WHERE p.active = true
    GROUP BY p.id
    HAVING 
        -- Include if has matching department link via parameter_items OR has no department links at all (cross-dept)
        COUNT(pidf.parameter_id) FILTER (WHERE pidf.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM parameter_item_departments pid2 
                      JOIN parameter_items pi2 ON pi2.id = pid2.parameter_item_id 
                      WHERE pi2.parameter_id = p.id AND pid2.active = true)
    ORDER BY p.created_at DESC
    LIMIT 1
),
parameter_departments_aggregated AS (
    SELECT 
        ARRAY_AGG(pid.department_id::text ORDER BY pid.department_id) as department_ids
    FROM parameter_items pi
    JOIN default_parameter dp ON pi.parameter_id = dp.id
    JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
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
parameter_item_departments_data AS (
    SELECT 
        pi.id as parameter_item_id,
        ARRAY_AGG(pid.department_id::text ORDER BY pid.created_at) as department_ids
    FROM parameter_items pi
    JOIN default_parameter dp ON pi.parameter_id = dp.id
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    GROUP BY pi.id
),
parameter_items_with_usage AS (
    SELECT 
        pi.id,
        pi.name,
        pi.description,
        pi.value,
        COALESCE(COUNT(spi.scenario_id), 0) as usage_count,
        COALESCE(pidd.department_ids, NULL) as department_ids
    FROM parameter_items pi
    JOIN default_parameter dp ON pi.parameter_id = dp.id
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
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = $1 AND d.active = true
)
SELECT 
    p.*,
    ij.items as parameter_items_json,
    vd.dept_mapping as department_mapping,
    vd.dept_ids as valid_department_ids
FROM parameter_data p
CROSS JOIN items_json ij
CROSS JOIN valid_depts vd

