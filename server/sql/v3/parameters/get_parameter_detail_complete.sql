WITH parameter_item_departments_data AS (
    SELECT 
        pi.id as parameter_item_id,
        ARRAY_AGG(pid.department_id::text ORDER BY pid.created_at) as department_ids
    FROM parameter_items pi
    LEFT JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE pi.parameter_id = $1
    GROUP BY pi.id
),
parameter_departments_aggregated AS (
    SELECT 
        ARRAY_AGG(pid.department_id::text ORDER BY pid.department_id) as department_ids
    FROM parameter_items pi
    JOIN parameter_item_departments pid ON pid.parameter_item_id = pi.id AND pid.active = true
    WHERE pi.parameter_id = $1
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
    LEFT JOIN parameter_departments_aggregated pda ON true
    WHERE p.id = $1
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
    LEFT JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id AND spi.active = true
    LEFT JOIN parameter_item_departments_data pidd ON pidd.parameter_item_id = pi.id
    WHERE pi.parameter_id = $1
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
    FROM departments d
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = $2 AND d.active = true
)
SELECT 
    p.*,
    ij.items as parameter_items_json,
    vd.dept_mapping as department_mapping,
    vd.dept_ids as valid_department_ids
FROM parameter_data p
CROSS JOIN items_json ij
CROSS JOIN valid_depts vd

