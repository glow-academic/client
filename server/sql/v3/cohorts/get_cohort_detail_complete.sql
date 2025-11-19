WITH cohort_departments_data AS (
    SELECT 
        cd.cohort_id,
        ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at) as department_ids
    FROM cohort_departments cd
    WHERE cd.cohort_id = $1 AND cd.active = true
    GROUP BY cd.cohort_id
),
cohort_data AS (
    SELECT 
        c.id,
        c.title,
        c.description,
        c.active,
        COALESCE(cdd.department_ids, NULL) as department_ids
    FROM cohorts c
    LEFT JOIN cohort_departments_data cdd ON cdd.cohort_id = c.id
    WHERE c.id = $1
),
cohort_profile_ids AS (
    SELECT cp.profile_id
    FROM cohort_profiles cp
    WHERE cp.cohort_id = $1 AND cp.active = true
),
profile_active_cohort_links AS (
    SELECT 
        profile_id,
        COUNT(*) as active_cohort_count
    FROM cohort_profiles
    WHERE active = true
    GROUP BY profile_id
),
profile_all_cohort_links AS (
    SELECT 
        profile_id,
        COUNT(*) as total_cohort_links
    FROM cohort_profiles
    GROUP BY profile_id
),
profile_cohorts AS (
    SELECT 
        cp.profile_id,
        ARRAY_AGG(cp.cohort_id::text ORDER BY c.title) as cohort_ids
    FROM cohort_profiles cp
    JOIN cohorts c ON c.id = cp.cohort_id
    WHERE cp.active = true
    GROUP BY cp.profile_id
),
profile_departments_agg AS (
    SELECT 
        pd.profile_id,
        ARRAY_AGG(pd.department_id::text ORDER BY d.title) as department_ids
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
all_cohort_ids_for_staff AS (
    SELECT DISTINCT unnest(cohort_ids)::uuid as cohort_id
    FROM profile_cohorts
),
all_department_ids_for_staff AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM profile_departments_agg
),
cohort_mapping_for_staff AS (
    SELECT COALESCE(jsonb_object_agg(
        c.id::text,
        jsonb_build_object(
            'name', c.title,
            'description', COALESCE(c.description, '')
        )
    ), '{}'::jsonb) as cohort_mapping
    FROM cohorts c
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids_for_staff)
),
department_mapping_for_staff AS (
    SELECT COALESCE(jsonb_object_agg(
        d.id::text,
        jsonb_build_object(
            'name', d.title,
            'description', COALESCE(d.description, '')
        )
    ), '{}'::jsonb) as department_mapping
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM all_department_ids_for_staff)
    AND d.active = true
),
user_profile_for_staff AS (
    SELECT role FROM profiles WHERE id = $2
),
cohort_staff AS (
    SELECT DISTINCT ON (p.id)
        p.id as profile_id,
        p.first_name,
        p.last_name,
        p.alias,
        p.first_name || ' ' || p.last_name as name,
        p.role,
        p.alias || '@' || $3 as email,
        SUBSTRING(p.first_name FROM 1 FOR 1) || SUBSTRING(p.last_name FROM 1 FOR 1) as initials,
        p.active,
        pa.last_active as lastActive,
        prl.requests_per_day as requests_per_day,
        p.default_profile,
        p.viewed_intro as intro_completed,
        p.viewed_chat as chat_completed,
        COALESCE(rr.run_count::int, 0) as requests_in_last_day,
        COALESCE(pc.cohort_ids, ARRAY[]::text[]) as cohort_ids,
        COALESCE(pda.department_ids, ARRAY[]::text[]) as department_ids,
        COALESCE(ppd.department_id::text, '') as department_id,
        COALESCE(ptr.total_requests, 0) as total_requests,
        COALESCE(pacl.active_cohort_count, 0) as active_cohort_count,
        COALESCE(pacl_all.total_cohort_links, 0) as total_cohort_links,
        CASE 
            WHEN p.id = $2 THEN true
            WHEN ups.role = 'superadmin' THEN true
            WHEN p.default_profile = true THEN false
            WHEN ups.role = 'admin' AND p.role IN ('instructional', 'ta', 'guest') THEN true
            WHEN ups.role = 'instructional' AND p.role IN ('ta', 'guest') THEN true
            WHEN ups.role = 'ta' AND p.role = 'guest' THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN p.id = $2 THEN false
            WHEN ups.role = 'superadmin' THEN true
            WHEN p.default_profile = true THEN false
            WHEN COALESCE(pacl_all.total_cohort_links, 0) > 0 THEN false
            WHEN ups.role = 'admin' AND p.role IN ('instructional', 'ta', 'guest') THEN true
            WHEN ups.role = 'instructional' AND p.role IN ('ta', 'guest') THEN true
            WHEN ups.role = 'ta' AND p.role = 'guest' THEN true
            ELSE false
        END as can_delete,
        CASE 
            WHEN p.id = $2 THEN false
            WHEN ups.role = 'superadmin' THEN true
            WHEN ups.role = 'admin' AND p.role IN ('admin', 'instructional', 'ta', 'guest') THEN true
            WHEN ups.role = 'instructional' AND p.role IN ('instructional', 'ta', 'guest') THEN true
            WHEN ups.role = 'ta' AND p.role IN ('ta', 'guest') THEN true
            WHEN ups.role = 'guest' AND p.role = 'guest' THEN true
            ELSE false
        END as can_remove
    FROM profiles p
    JOIN cohort_profile_ids cpi ON cpi.profile_id = p.id
    LEFT JOIN profile_cohorts pc ON pc.profile_id = p.id
    LEFT JOIN profile_departments_agg pda ON pda.profile_id = p.id
    LEFT JOIN profile_primary_department ppd ON ppd.profile_id = p.id
    LEFT JOIN profile_total_runs ptr ON ptr.profile_id = p.id
    LEFT JOIN profile_active_cohort_links pacl ON pacl.profile_id = p.id
    LEFT JOIN profile_all_cohort_links pacl_all ON pacl_all.profile_id = p.id
    LEFT JOIN recent_runs rr ON rr.profile_id = p.id
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN LATERAL (
        SELECT last_active 
        FROM profile_activity 
        WHERE profile_id = p.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) pa ON true
    CROSS JOIN user_profile_for_staff ups
    WHERE (
        ups.role = 'superadmin' OR
        (ups.role = 'admin' AND p.role IN ('admin', 'instructional', 'ta', 'guest')) OR
        (ups.role = 'instructional' AND p.role IN ('instructional', 'ta', 'guest')) OR
        (ups.role = 'ta' AND p.role IN ('ta', 'guest')) OR
        (ups.role = 'guest' AND p.role = 'guest')
    )
    ORDER BY p.id, p.last_name, p.first_name
),
cohort_simulation_ids AS (
    SELECT cs.simulation_id, cs.active
    FROM cohort_simulations cs
    WHERE cs.cohort_id = $1
),
cohort_simulation_stats AS (
    SELECT 
        cs.simulation_id,
        cs.active,
        s.title as name,
        COALESCE(s.description, '') as description,
        stl.time_limit_seconds as time_limit,
        COUNT(DISTINCT sa.id) as usage_count,
        COALESCE(
            ROUND(
                100.0 * SUM(CASE WHEN scg.passed = true THEN 1 ELSE 0 END)::numeric 
                / NULLIF(COUNT(scg.id), 0)
            )::int,
            0
        ) as success_rate,
        MAX(sa.created_at) as last_used
    FROM cohort_simulation_ids cs
    JOIN simulations s ON s.id = cs.simulation_id
    LEFT JOIN simulation_time_limits stl ON stl.simulation_id = s.id AND stl.active = true
    LEFT JOIN simulation_attempts sa ON sa.simulation_id = cs.simulation_id 
    LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
    LEFT JOIN cohort_profile_ids cp ON cp.profile_id = ap.profile_id
    LEFT JOIN attempt_chats ac ON ac.attempt_id = sa.id
    LEFT JOIN simulation_chats sc ON sc.id = ac.chat_id
    LEFT JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
    GROUP BY cs.simulation_id, cs.active, s.title, s.description, stl.time_limit_seconds
),
valid_departments AS (
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM departments d
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE pd.profile_id = $2 AND d.active = true
),
valid_dept_ids AS (
    SELECT id FROM valid_departments
),
valid_simulations AS (
    SELECT DISTINCT s.id
    FROM simulations s
    LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
    WHERE s.active = true
    GROUP BY s.id
    HAVING 
        COUNT(sd.simulation_id) FILTER (WHERE sd.department_id IN (SELECT id FROM valid_dept_ids)) > 0
        OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
),
valid_profiles AS (
    SELECT DISTINCT p.id
    FROM profiles p
    JOIN profile_departments pd ON pd.profile_id = p.id
    WHERE pd.department_id IN (SELECT id FROM valid_dept_ids)
        AND p.active = true
),
cross_dept_simulations AS (
    SELECT DISTINCT s.id::text as simulation_id
    FROM simulations s
    WHERE s.active = true
        AND NOT EXISTS (
            SELECT 1 FROM simulation_departments sd2 
            WHERE sd2.simulation_id = s.id AND sd2.active = true
        )
),
department_simulation_ids AS (
    SELECT 
        d.id as department_id,
        ARRAY_AGG(DISTINCT s.id::text) FILTER (WHERE s.id IS NOT NULL) as simulation_ids
    FROM valid_departments d
    LEFT JOIN simulation_departments sd ON sd.department_id = d.id AND sd.active = true
    LEFT JOIN simulations s ON s.id = sd.simulation_id AND s.active = true
    GROUP BY d.id
),
department_simulation_ids_with_cross AS (
    SELECT 
        dsi.department_id,
        COALESCE(dsi.simulation_ids, ARRAY[]::text[]) || 
        COALESCE(ARRAY(SELECT simulation_id FROM cross_dept_simulations), ARRAY[]::text[]) as simulation_ids
    FROM department_simulation_ids dsi
),
department_profile_ids AS (
    SELECT 
        d.id as department_id,
        ARRAY_AGG(DISTINCT p.id::text) FILTER (WHERE p.id IS NOT NULL) as staff_ids
    FROM valid_departments d
    LEFT JOIN profile_departments pd ON pd.department_id = d.id
    LEFT JOIN profiles p ON p.id = pd.profile_id AND p.active = true
    GROUP BY d.id
),
department_mapping_data AS (
    SELECT 
        vd.id::text as department_id,
        jsonb_build_object(
            'name', vd.name,
            'description', COALESCE(vd.description, ''),
            'simulation_ids', COALESCE(dsic.simulation_ids, ARRAY[]::text[]),
            'staff_ids', COALESCE(dpi.staff_ids, ARRAY[]::text[])
        ) as dept_data
    FROM valid_departments vd
    LEFT JOIN department_simulation_ids_with_cross dsic ON dsic.department_id = vd.id
    LEFT JOIN department_profile_ids dpi ON dpi.department_id = vd.id
)
SELECT 
    cd.title,
    cd.description,
    cd.department_ids,
    cd.active,
    (SELECT COALESCE(array_agg(profile_id::text), ARRAY[]::text[])
     FROM cohort_profile_ids) as profile_ids,
    (SELECT COALESCE(array_agg(simulation_id::text), ARRAY[]::text[])
     FROM cohort_simulation_ids
     WHERE active = true) as simulation_ids,
    (SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
     FROM valid_dept_ids) as valid_department_ids,
    (SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
     FROM valid_simulations) as valid_simulation_ids,
    (SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
     FROM valid_profiles) as valid_profile_ids,
    (SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'simulation_id', css.simulation_id::text,
            'name', css.name,
            'description', css.description,
            'time_limit', css.time_limit,
            'active', css.active,
            'usage_count', css.usage_count,
            'success_rate', css.success_rate,
            'last_used', css.last_used,
            'can_remove', CASE WHEN css.usage_count = 0 THEN true ELSE false END
        )
     ), '[]'::jsonb)
     FROM cohort_simulation_stats css
    ) as simulations_list,
    (SELECT COALESCE(jsonb_object_agg(
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
     WHERE s.id IN (SELECT id FROM valid_simulations)
    ) as simulation_mapping,
    (SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'profile_id', cs.profile_id::text,
            'first_name', cs.first_name,
            'last_name', cs.last_name,
            'alias', cs.alias,
            'name', cs.name,
            'role', cs.role,
            'email', cs.email,
            'initials', cs.initials,
            'active', cs.active,
            'lastActive', cs.lastActive,
            'cohort_ids', cs.cohort_ids,
            'department_ids', cs.department_ids,
            'primary_department_id', cs.department_id,
            'requests_per_day', cs.requests_per_day,
            'total_requests', cs.total_requests,
            'default_profile', cs.default_profile,
            'intro_completed', cs.intro_completed,
            'chat_completed', cs.chat_completed,
            'requests_in_last_day', cs.requests_in_last_day,
            'can_edit', cs.can_edit,
            'can_delete', cs.can_delete,
            'can_remove', cs.can_remove
        ) ORDER BY cs.last_name, cs.first_name
     ), '[]'::jsonb)
     FROM cohort_staff cs
    ) as staff,
    (SELECT COALESCE(jsonb_object_agg(
        p.id::text,
        jsonb_build_object(
            'name', p.first_name || ' ' || p.last_name,
            'description', p.alias || '@' || $3
        )
     ), '{}'::jsonb)
     FROM profiles p
     WHERE p.id IN (SELECT profile_id FROM cohort_profile_ids)
    ) as profile_mapping,
    (SELECT cohort_mapping FROM cohort_mapping_for_staff) as cohort_mapping_for_staff,
    (SELECT department_mapping FROM department_mapping_for_staff) as department_mapping_for_staff,
    (SELECT COALESCE(jsonb_object_agg(
        dmd.department_id,
        dmd.dept_data
     ), '{}'::jsonb)
     FROM department_mapping_data dmd
    ) as department_mapping
FROM cohort_data cd

