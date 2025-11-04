WITH profile_data AS (
    SELECT 
        p.first_name || ' ' || p.last_name as name,
        p.alias,
        p.role,
        prl.requests_per_day as requests_per_day,
        p.active
    FROM profiles p
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    WHERE p.id = $1
),
profile_department AS (
    SELECT department_id 
    FROM profile_departments 
    WHERE profile_id = $1
    LIMIT 1
),
profile_cohorts AS (
    SELECT ARRAY_AGG(cohort_id::text ORDER BY cohort_id) as cohort_ids
    FROM cohort_profiles 
    WHERE profile_id = $1 AND active = true
),
cohort_mapping_data AS (
    SELECT COALESCE(jsonb_object_agg(
        c.id::text,
        jsonb_build_object(
            'name', c.title,
            'description', COALESCE(c.description, '')
        )
    ), '{}'::jsonb) as cohort_mapping
    FROM cohorts c
    WHERE c.id IN (
        SELECT cohort_id FROM cohort_profiles 
        WHERE profile_id = $1 AND active = true
    )
),
valid_department_ids_data AS (
    SELECT array_agg(d.id::text ORDER BY d.title) as valid_department_ids
    FROM departments d
    WHERE d.active = true
),
department_mapping_full AS (
    SELECT COALESCE(jsonb_object_agg(
        d.id::text,
        jsonb_build_object('name', d.title, 'description', COALESCE(d.description, ''))
    ), '{}'::jsonb) as department_mapping
    FROM departments d
    WHERE d.active = true
)
SELECT 
    pd.name,
    pd.alias,
    pd.role,
    pd.requests_per_day,
    pd.active,
    COALESCE(pde.department_id::text, '') as department_id,
    COALESCE(pc.cohort_ids, ARRAY[]::text[]) as cohort_ids,
    cmd.cohort_mapping,
    COALESCE(vdid.valid_department_ids, ARRAY[]::text[]) as valid_department_ids,
    dmf.department_mapping as department_mapping_full
FROM profile_data pd
CROSS JOIN cohort_mapping_data cmd
CROSS JOIN valid_department_ids_data vdid
CROSS JOIN department_mapping_full dmf
LEFT JOIN profile_department pde ON true
LEFT JOIN profile_cohorts pc ON true

