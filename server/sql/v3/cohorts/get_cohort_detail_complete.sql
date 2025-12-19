WITH user_profile AS (
    SELECT role FROM profiles WHERE id = $2
),
cohort_departments_data AS (
    SELECT 
        cd.cohort_id,
        ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at) as department_ids
    FROM cohort_departments cd
    WHERE cd.cohort_id = $1 AND cd.active = true
    GROUP BY cd.cohort_id
),
cohort_department_access_check AS (
    SELECT 
        c.id as cohort_id,
        CASE 
            WHEN up.role = 'superadmin' THEN true
            WHEN EXISTS (
                SELECT 1 FROM cohort_departments cd 
                WHERE cd.cohort_id = c.id 
                AND cd.active = true 
                AND cd.department_id IN (SELECT department_id FROM profile_departments pd WHERE pd.profile_id = $2 AND pd.active = true)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM cohort_departments cd2 
                WHERE cd2.cohort_id = c.id 
                AND cd2.active = true
            ) THEN true  -- Cross-department resource
            ELSE false
        END as has_access
    FROM cohorts c
    CROSS JOIN user_profile up
    WHERE c.id = $1
),
cohort_data AS (
    SELECT 
        c.id,
        c.title,
        c.description,
        c.active,
        c.updated_at,
        COALESCE(cdd.department_ids, NULL) as department_ids
    FROM cohorts c
    LEFT JOIN cohort_departments_data cdd ON cdd.cohort_id = c.id
    INNER JOIN cohort_department_access_check cdac ON cdac.cohort_id = c.id AND cdac.has_access = true
    WHERE c.id = $1
),
cohort_profile_ids AS (
    SELECT cp.profile_id
    FROM cohort_profiles cp
    WHERE cp.cohort_id = $1 AND cp.active = true
),
cohort_simulation_ids AS (
    SELECT cs.simulation_id, cs.active, cs.position
    FROM cohort_simulations cs
    WHERE cs.cohort_id = $1
),
cohort_attempts AS (
    SELECT DISTINCT sa.id as attempt_id, sa.simulation_id, sa.created_at
    FROM simulation_attempts sa
    JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
    WHERE ap.profile_id IN (SELECT profile_id FROM cohort_profile_ids)
),
cohort_simulation_stats AS (
    SELECT 
        cs.simulation_id,
        cs.active,
        cs.position,
        s.title as name,
        COALESCE(s.description, '') as description,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = cs.simulation_id AND stl.active = true AND ss.active = true),
            0
        ) as time_limit,
        COUNT(DISTINCT ca.attempt_id) as usage_count,
        COALESCE(
            ROUND(
                100.0 * SUM(CASE WHEN scg.passed = true THEN 1 ELSE 0 END)::numeric 
                / NULLIF(COUNT(scg.id), 0)
            )::int,
            0
        ) as success_rate,
        MAX(ca.created_at) as last_used
    FROM cohort_simulation_ids cs
    JOIN simulations s ON s.id = cs.simulation_id
    LEFT JOIN cohort_attempts ca ON ca.simulation_id = cs.simulation_id
    LEFT JOIN attempt_chats ac ON ac.attempt_id = ca.attempt_id
    LEFT JOIN chats sc ON sc.id = ac.chat_id
    LEFT JOIN LATERAL (
        SELECT DISTINCT sc.id AS chat_id, r2.id AS run_id
        FROM chats c
        JOIN groups g ON g.id = c.group_id
        JOIN group_runs gr ON gr.group_id = g.id
        JOIN runs r2 ON r2.id = gr.run_id
        WHERE c.id = sc.id
        LIMIT 1
    ) chat_run_lookup ON true
    LEFT JOIN runs r ON r.id = chat_run_lookup.run_id
    LEFT JOIN grades scg ON scg.run_id = r.id 
        AND EXISTS (
            SELECT 1 FROM runs r_check
            JOIN group_runs gr_check ON gr_check.run_id = r_check.id
            JOIN groups g_check ON g_check.id = gr_check.group_id
            JOIN chats c_check ON c_check.group_id = g_check.id
            WHERE r_check.id = scg.run_id
        )
    GROUP BY cs.simulation_id, cs.active, cs.position, s.title, s.description
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
cohort_is_default AS (
    SELECT COALESCE(cd.department_ids, NULL) IS NULL as is_default
    FROM cohort_data cd
),
valid_simulations AS (
    SELECT DISTINCT s.id
    FROM simulations s
    LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
    CROSS JOIN cohort_is_default cid
    WHERE s.active = true
    GROUP BY s.id, cid.is_default
    HAVING 
        -- For default cohorts (no department links), include all simulations in the cohort
        (cid.is_default = true AND s.id IN (SELECT simulation_id FROM cohort_simulation_ids))
        OR
        -- For non-default cohorts, use department filtering
        (cid.is_default = false AND (
            COUNT(sd.simulation_id) FILTER (WHERE sd.department_id IN (SELECT id FROM valid_dept_ids)) > 0
            OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
        ))
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
department_mapping_data AS (
    SELECT 
        vd.id::text as department_id,
        jsonb_build_object(
            'name', vd.name,
            'description', COALESCE(vd.description, ''),
            'simulation_ids', COALESCE(dsic.simulation_ids, ARRAY[]::text[])
        ) as dept_data
    FROM valid_departments vd
    LEFT JOIN department_simulation_ids_with_cross dsic ON dsic.department_id = vd.id
),
user_profile_for_cohort AS (
    SELECT 
        role,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM profiles p
    WHERE p.id = $2
)
SELECT 
    cd.title,
    cd.description,
    cd.department_ids,
    cd.active,
    cd.updated_at,
    CASE 
        WHEN COALESCE(cd.department_ids, NULL) IS NULL AND upc.role != 'superadmin' THEN false
        WHEN upc.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    (SELECT COALESCE(array_agg(profile_id::text), ARRAY[]::text[])
     FROM cohort_profile_ids) as profile_ids,
    (SELECT COALESCE(array_agg(simulation_id::text ORDER BY position), ARRAY[]::text[])
     FROM cohort_simulation_ids
     WHERE active = true) as simulation_ids,
    (SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
     FROM valid_dept_ids) as valid_department_ids,
    (SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
     FROM valid_simulations) as valid_simulation_ids,
    (SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'simulation_id', css.simulation_id::text,
            'name', css.name,
            'description', css.description,
            'time_limit', css.time_limit,
            'active', css.active,
            'position', css.position,
            'usage_count', css.usage_count,
            'success_rate', css.success_rate,
            'last_used', css.last_used,
            'can_remove', CASE WHEN css.usage_count = 0 THEN true ELSE false END
        ) ORDER BY css.position
     ), '[]'::jsonb)
     FROM cohort_simulation_stats css
    ) as simulations_list,
    (SELECT COALESCE(jsonb_object_agg(
        s.id::text,
        jsonb_build_object(
            'name', s.title,
            'description', COALESCE(s.description, ''),
            'time_limit', COALESCE(
                (SELECT SUM(stl.time_limit_seconds)
                 FROM scenario_time_limits stl
                 JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
                 WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
                0
            ),
            'department_ids', CASE 
                WHEN sdd.department_ids IS NOT NULL THEN to_jsonb(sdd.department_ids)
                ELSE NULL::jsonb
            END
        )
     ), '{}'::jsonb)
     FROM simulations s
     LEFT JOIN (
         SELECT 
             sd.simulation_id,
             ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
         FROM simulation_departments sd
         WHERE sd.active = true
         GROUP BY sd.simulation_id
     ) sdd ON sdd.simulation_id = s.id
     CROSS JOIN cohort_is_default cid
     WHERE 
         -- For default cohorts, include all simulations in the cohort
         (cid.is_default = true AND s.id IN (SELECT simulation_id FROM cohort_simulation_ids))
         OR
         -- For non-default cohorts, use valid_simulations filtering
         (cid.is_default = false AND s.id IN (SELECT id FROM valid_simulations))
    ) as simulation_mapping,
    (SELECT COALESCE(jsonb_object_agg(
        dmd.department_id,
        dmd.dept_data
     ), '{}'::jsonb)
     FROM department_mapping_data dmd
    ) as department_mapping,
    upc.actor_name
FROM cohort_data cd
CROSS JOIN user_profile_for_cohort upc
