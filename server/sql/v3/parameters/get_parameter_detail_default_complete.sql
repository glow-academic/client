WITH user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM profile_departments pd
    WHERE pd.profile_id = $1
),
default_parameter AS (
    SELECT p.id
    FROM parameters p
    JOIN user_departments ud ON ud.department_id = p.department_id
    WHERE p.active = true
    ORDER BY p.default_parameter DESC, p.created_at DESC
    LIMIT 1
),
parameter_data AS (
    SELECT 
        p.name,
        p.description,
        p.numerical,
        p.active,
        p.document_parameter,
        p.practice_parameter
    FROM parameters p
    JOIN default_parameter dp ON p.id = dp.id
),
parameter_items_with_usage AS (
    SELECT 
        pi.id,
        pi.name,
        pi.description,
        pi.value,
        COALESCE(COUNT(spi.scenario_id), 0) as usage_count
    FROM parameter_items pi
    JOIN default_parameter dp ON pi.parameter_id = dp.id
    LEFT JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id AND spi.active = true
    GROUP BY pi.id, pi.name, pi.description, pi.value
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

