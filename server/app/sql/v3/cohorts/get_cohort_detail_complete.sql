-- Get cohort detail with simulations and mappings
-- Converted to function with composite types

BEGIN;

-- 1) Drop functions that depend on these types first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_get_cohort_new_v3(uuid);
DROP FUNCTION IF EXISTS api_get_cohort_detail_v3(uuid, uuid);
DROP FUNCTION IF EXISTS api_get_cohort_search_v3(uuid, uuid, text, uuid[], int);

-- 2) Drop types WITHOUT CASCADE
DROP TYPE IF EXISTS types.q_get_cohort_detail_v3_simulation;
DROP TYPE IF EXISTS types.q_get_cohort_detail_v3_simulation_for_picker;
DROP TYPE IF EXISTS types.q_get_cohort_detail_v3_department;

-- 3) Recreate types
CREATE TYPE types.q_get_cohort_detail_v3_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    time_limit bigint,
    active boolean,
    position int,
    usage_count bigint,
    success_rate int,
    last_used timestamptz,
    can_remove boolean
);

CREATE TYPE types.q_get_cohort_detail_v3_simulation_for_picker AS (
    simulation_id uuid,
    name text,
    description text,
    time_limit bigint,
    department_ids text[]
);

CREATE TYPE types.q_get_cohort_detail_v3_department AS (
    department_id uuid,
    name text,
    description text,
    simulation_ids text[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_cohort_detail_v3(
    cohort_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    cohort_exists boolean,
    title text,
    description text,
    department_ids text[],
    active boolean,
    updated_at timestamptz,
    can_edit boolean,
    profile_ids text[],
    simulation_ids text[],
    valid_department_ids text[],
    valid_simulation_ids text[],
    simulations types.q_get_cohort_detail_v3_simulation[],
    simulations_for_picker types.q_get_cohort_detail_v3_simulation_for_picker[],
    departments types.q_get_cohort_detail_v3_department[],
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        cohort_id AS cohort_id,
        profile_id AS profile_id
),
cohort_exists_check AS (
    -- Check if cohort exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM cohorts WHERE id = (SELECT cohort_id FROM params)
    )::boolean as cohort_exists
),
user_profile AS (
    SELECT role FROM params x JOIN profiles p ON p.id = x.profile_id
),
cohort_departments_data AS (
    SELECT 
        cd.cohort_id,
        ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at) as department_ids
    FROM params x
    JOIN cohort_departments cd ON cd.cohort_id = x.cohort_id AND cd.active = true
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
                AND cd.department_id IN (SELECT department_id FROM params x JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM cohort_departments cd2 
                WHERE cd2.cohort_id = c.id 
                AND cd2.active = true
            ) THEN true  -- Cross-department resource
            ELSE false
        END as has_access
    FROM params x
    JOIN cohorts c ON c.id = x.cohort_id
    CROSS JOIN user_profile up
),
cohort_data AS (
    SELECT 
        c.id,
        c.title,
        c.description,
        c.active,
        c.updated_at,
        COALESCE(cdd.department_ids, NULL) as department_ids
    FROM params x
    JOIN cohorts c ON c.id = x.cohort_id
    LEFT JOIN cohort_departments_data cdd ON cdd.cohort_id = c.id
    INNER JOIN cohort_department_access_check cdac ON cdac.cohort_id = c.id AND cdac.has_access = true
),
cohort_profile_ids AS (
    SELECT cp.profile_id
    FROM params x
    JOIN cohort_profiles cp ON cp.cohort_id = x.cohort_id AND cp.active = true
),
cohort_simulation_ids AS (
    SELECT cs.simulation_id, cs.active, cs.position
    FROM params x
    JOIN cohort_simulations cs ON cs.cohort_id = x.cohort_id
),
cohort_attempts AS (
    SELECT DISTINCT sa.id as attempt_id, sa.simulation_id, sa.created_at
    FROM params x
    JOIN simulation_attempts sa ON true
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
        JOIN chat_groups cg ON cg.chat_id = c.id
        JOIN groups g ON g.id = cg.group_id
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
            JOIN chat_groups cg_check ON cg_check.group_id = g_check.id
            JOIN chats c_check ON c_check.id = cg_check.chat_id
            WHERE r_check.id = scg.run_id
        )
    GROUP BY cs.simulation_id, cs.active, cs.position, s.title, s.description
),
valid_departments AS (
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM params x
    JOIN departments d ON true
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE pd.profile_id = x.profile_id AND d.active = true
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
    FROM params x
    JOIN simulations s ON s.active = true
    LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
    CROSS JOIN cohort_is_default cid
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
simulation_mapping_data AS (
    SELECT 
        s.id as simulation_id,
        s.title as name,
        COALESCE(s.description, '') as description,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        ) as time_limit,
        COALESCE(sdd.department_ids, ARRAY[]::text[]) as department_ids
    FROM params x
    JOIN simulations s ON true
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
),
department_mapping_data AS (
    SELECT 
        vd.id as department_id,
        vd.name,
        COALESCE(vd.description, '') as description,
        COALESCE(dsic.simulation_ids, ARRAY[]::text[]) as simulation_ids
    FROM valid_departments vd
    LEFT JOIN department_simulation_ids_with_cross dsic ON dsic.department_id = vd.id
),
user_profile_for_cohort AS (
    SELECT 
        role,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
)
SELECT 
    -- Cohort existence check (always returned)
    cec.cohort_exists::boolean as cohort_exists,
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
    (SELECT COALESCE(
        ARRAY_AGG(
            (css.simulation_id, css.name, css.description, css.time_limit, css.active, css.position, css.usage_count, css.success_rate, css.last_used, CASE WHEN css.usage_count = 0 THEN true ELSE false END)::types.q_get_cohort_detail_v3_simulation
            ORDER BY css.position
        ),
        '{}'::types.q_get_cohort_detail_v3_simulation[]
    )
     FROM cohort_simulation_stats css) as simulations,
    (SELECT COALESCE(
        ARRAY_AGG(
            (smd.simulation_id, smd.name, smd.description, smd.time_limit, smd.department_ids)::types.q_get_cohort_detail_v3_simulation_for_picker
        ),
        '{}'::types.q_get_cohort_detail_v3_simulation_for_picker[]
    )
     FROM simulation_mapping_data smd) as simulations_for_picker,
    (SELECT COALESCE(
        ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.simulation_ids)::types.q_get_cohort_detail_v3_department
        ),
        '{}'::types.q_get_cohort_detail_v3_department[]
    )
     FROM department_mapping_data dmd) as departments,
    upc.actor_name
FROM cohort_exists_check cec
CROSS JOIN user_profile_for_cohort upc
LEFT JOIN cohort_data cd ON true
$$;

COMMIT;
