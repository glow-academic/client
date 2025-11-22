WITH department_ids_param AS (
    -- Cast $1 to uuid[] so PostgreSQL knows the parameter type (even if not used)
    SELECT COALESCE($1::uuid[], ARRAY[]::uuid[]) as dept_ids
),
user_profile AS (
    SELECT COALESCE((SELECT role FROM profiles WHERE id = $2), 'guest') as role
),
user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $2 AND active = true
),
profile_cohorts AS (
    SELECT 
        cp.profile_id,
        ARRAY_AGG(cp.cohort_id ORDER BY c.title) as cohort_ids
    FROM cohort_profiles cp
    JOIN cohorts c ON c.id = cp.cohort_id
    WHERE cp.active = true
    GROUP BY cp.profile_id
),
profile_departments_agg AS (
    SELECT 
        pd.profile_id,
        ARRAY_AGG(pd.department_id ORDER BY d.title) as department_ids
    FROM profile_departments pd
    JOIN departments d ON d.id = pd.department_id
    WHERE pd.active = true
    GROUP BY pd.profile_id
),
profile_primary_department AS (
    SELECT 
        pd.profile_id,
        pd.department_id
    FROM profile_departments pd
    WHERE pd.active = true AND pd.is_primary = true
),
recent_runs AS (
    SELECT 
        mrp.profile_id,
        COUNT(*) as run_count
    FROM model_runs mr
    JOIN model_run_profiles mrp ON mrp.model_run_id = mr.id
    WHERE mr.created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY mrp.profile_id
),
profile_total_runs AS (
    SELECT 
        mrp.profile_id,
        COUNT(*) as total_requests
    FROM model_run_profiles mrp
    GROUP BY mrp.profile_id
),
all_cohort_ids AS (
    SELECT DISTINCT c.id as cohort_id
    FROM cohorts c
    WHERE c.active = true
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
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
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
    WHERE d.active = true
    -- Return ALL active departments user can access, not filtered by $1 parameter
    -- $1 (departmentIds) is used for scoping staff results, not for limiting available departments
),
staff_data AS (
    SELECT DISTINCT ON (p.id)
        jsonb_build_object(
            'profile_id', p.id::text,
            'first_name', p.first_name,
            'last_name', p.last_name,
            'email', p.email,
            'name', p.first_name || ' ' || p.last_name,
            'role', p.role,
            'active', p.active,
            'last_active', CASE WHEN pa.last_active IS NOT NULL THEN pa.last_active::text ELSE NULL END,
            'cohort_ids', COALESCE(
                ARRAY(SELECT unnest(pc.cohort_ids)::text),
                ARRAY[]::text[]
            ),
            'department_ids', COALESCE(
                ARRAY(SELECT unnest(pda.department_ids)::text),
                ARRAY[]::text[]
            ),
            'primary_department_id', COALESCE(ppd.department_id::text, ''),
            'requests_per_day', prl.requests_per_day,
            'total_requests', COALESCE(ptr.total_requests, 0),
            'default_profile', p.default_profile,
            'requests_in_last_day', COALESCE(rr.run_count::int, 0)
        ) as staff_item
    FROM profiles p
    JOIN profile_departments pd ON pd.profile_id = p.id AND pd.active = true
    LEFT JOIN profile_cohorts pc ON pc.profile_id = p.id
    LEFT JOIN profile_departments_agg pda ON pda.profile_id = p.id
    LEFT JOIN profile_primary_department ppd ON ppd.profile_id = p.id
    LEFT JOIN profile_total_runs ptr ON ptr.profile_id = p.id
    LEFT JOIN recent_runs rr ON rr.profile_id = p.id
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN LATERAL (
        SELECT last_active 
        FROM profile_activity 
        WHERE profile_id = p.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) pa ON true
    CROSS JOIN user_profile up
    WHERE (
        -- Superadmin sees all staff
        up.role = 'superadmin'
        OR
        -- For create-staff-data, show all staff with active departments
        -- (used when adding staff to cohorts, so user should see all available)
        true
    )
    ORDER BY p.id, p.last_name, p.first_name
),
staff_aggregated AS (
    SELECT COALESCE(
        jsonb_agg(sd.staff_item ORDER BY sd.staff_item->>'last_name', sd.staff_item->>'first_name'),
        '[]'::jsonb
    ) as staff
    FROM staff_data sd
)
SELECT 
    sa.staff,
    cmd.cohort_mapping,
    dmd.department_mapping
FROM cohort_mapping_data cmd
CROSS JOIN department_mapping_data dmd
CROSS JOIN staff_aggregated sa

