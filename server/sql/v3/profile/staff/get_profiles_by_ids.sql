WITH profile_departments_agg AS (
    SELECT 
        profile_id,
        ARRAY_AGG(DISTINCT department_id::text) as department_ids
    FROM profile_departments
    WHERE profile_id = ANY($1)
    GROUP BY profile_id
),
all_department_ids AS (
    SELECT DISTINCT department_id
    FROM profile_departments
    WHERE profile_id = ANY($1)
),
department_mapping_data AS (
    SELECT COALESCE(jsonb_object_agg(
        d.id::text,
        jsonb_build_object(
            'name', d.title,
            'description', COALESCE(d.description, '')
        )
    ), '{}'::jsonb) as department_mapping
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM all_department_ids)
),
valid_department_ids_data AS (
    SELECT array_agg(d.id::text ORDER BY d.title) as valid_department_ids
    FROM departments d
    WHERE d.active = true
),
department_mapping_full_data AS (
    SELECT COALESCE(jsonb_object_agg(
        d.id::text,
        jsonb_build_object('name', d.title, 'description', COALESCE(d.description, ''))
    ), '{}'::jsonb) as department_mapping_full
    FROM departments d
    WHERE d.active = true
)
SELECT 
    p.id,
    p.role,
    prl.requests_per_day as requests_per_day,
    COALESCE(pda.department_ids, ARRAY[]::text[]) as department_ids,
    dmd.department_mapping,
    COALESCE(vdid.valid_department_ids, ARRAY[]::text[]) as valid_department_ids,
    dmfd.department_mapping_full
FROM profiles p
LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
LEFT JOIN profile_departments_agg pda ON pda.profile_id = p.id
CROSS JOIN department_mapping_data dmd
CROSS JOIN valid_department_ids_data vdid
CROSS JOIN department_mapping_full_data dmfd
WHERE p.id = ANY($1)

