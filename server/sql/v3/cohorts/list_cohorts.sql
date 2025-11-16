WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
cohort_profiles_agg AS (
    SELECT 
        cp.cohort_id,
        ARRAY_AGG(cp.profile_id ORDER BY p.last_name, p.first_name) as profile_ids
    FROM cohort_profiles cp
    JOIN profiles p ON p.id = cp.profile_id
    WHERE cp.active = true
    GROUP BY cp.cohort_id
),
cohort_simulations_agg AS (
    SELECT 
        cs.cohort_id,
        ARRAY_AGG(cs.simulation_id ORDER BY s.title) as simulation_ids
    FROM cohort_simulations cs
    JOIN simulations s ON s.id = cs.simulation_id
    WHERE cs.active = true
    GROUP BY cs.cohort_id
),
cohort_usage AS (
    SELECT DISTINCT cp.cohort_id, COUNT(DISTINCT ap.attempt_id) as usage_count
    FROM cohort_profiles cp
    JOIN attempt_profiles ap ON ap.profile_id = cp.profile_id
    WHERE cp.active = true
    GROUP BY cp.cohort_id
),
cohort_departments_data AS (
    SELECT 
        cd.cohort_id,
        ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at) as department_ids
    FROM cohort_departments cd
    WHERE cd.active = true
    GROUP BY cd.cohort_id
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
user_in_cohort AS (
    SELECT cohort_id
    FROM cohort_profiles
    WHERE profile_id = $1 AND active = true
),
all_profile_ids AS (
    SELECT DISTINCT unnest(profile_ids) as profile_id
    FROM cohort_profiles_agg
),
all_simulation_ids AS (
    SELECT DISTINCT unnest(simulation_ids) as simulation_id
    FROM cohort_simulations_agg
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM cohort_departments_data
    WHERE department_ids IS NOT NULL
),
department_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.title,
                'description', COALESCE(d.description, '')
            )
        ) FILTER (WHERE d.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM all_department_ids)
        OR d.id IN (SELECT department_id FROM user_departments)
)
SELECT 
    c.id as cohort_id,
    c.title as name,
    c.description,
    c.active,
    COALESCE(cdd.department_ids, NULL) as department_ids,
    COALESCE(cp.profile_ids, ARRAY[]::uuid[]) as profile_ids,
    COALESCE(cs.simulation_ids, ARRAY[]::uuid[]) as simulation_ids,
    COALESCE(cu.usage_count, 0) as usage_count,
    COALESCE(array_length(cp.profile_ids, 1), 0) as num_members,
    CASE 
        WHEN up.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN up.role IN ('admin', 'superadmin') AND COALESCE(cu.usage_count, 0) = 0 THEN true
        ELSE false
    END as can_delete,
    true as can_duplicate,
    CASE
        WHEN uic.cohort_id IS NOT NULL THEN true
        ELSE false
    END as can_leave,
    (
        SELECT COALESCE(jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.first_name || ' ' || p.last_name,
                'description', p.alias || '@' || $2
            )
        ), '{}'::jsonb)
        FROM profiles p
        WHERE p.id IN (SELECT profile_id FROM all_profile_ids)
    ) as profile_mapping,
    (
        SELECT COALESCE(jsonb_object_agg(
            s.id::text,
            jsonb_build_object(
                'name', s.title,
                'description', COALESCE(s.description, ''),
                'time_limit', stl.time_limit_seconds,
                'department_ids', CASE 
                    WHEN sdd.department_ids IS NOT NULL THEN to_jsonb(sdd.department_ids)
                    ELSE NULL::jsonb
                END
            )
        ), '{}'::jsonb)
        FROM simulations s
        LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
        LEFT JOIN (
            SELECT 
                sd.simulation_id,
                ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
            FROM simulation_departments sd
            WHERE sd.active = true
            GROUP BY sd.simulation_id
        ) sdd ON sdd.simulation_id = s.id
        WHERE s.id IN (SELECT simulation_id FROM all_simulation_ids)
    ) as simulation_mapping,
    dmd.mapping as department_mapping
FROM cohorts c
LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
LEFT JOIN cohort_departments_data cdd ON cdd.cohort_id = c.id
LEFT JOIN cohort_profiles_agg cp ON cp.cohort_id = c.id
LEFT JOIN cohort_simulations_agg cs ON cs.cohort_id = c.id
LEFT JOIN cohort_usage cu ON cu.cohort_id = c.id
LEFT JOIN user_in_cohort uic ON uic.cohort_id = c.id
CROSS JOIN user_profile up
CROSS JOIN department_mapping_data dmd
WHERE (
        (up.role = 'instructional' AND uic.cohort_id IS NOT NULL)
        OR
        up.role != 'instructional'
    )
GROUP BY c.id, c.title, c.description, c.active, 
         cdd.department_ids, cp.profile_ids, cs.simulation_ids, cu.usage_count, up.role, uic.cohort_id, dmd.mapping
HAVING 
    COUNT(cd.cohort_id) FILTER (WHERE cd.department_id IN (SELECT department_id FROM user_departments)) > 0
    OR NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true)
ORDER BY c.title

