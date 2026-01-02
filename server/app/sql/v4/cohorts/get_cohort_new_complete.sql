-- Get default cohort detail with simulations, staff, and mappings
-- Converted to function with composite types
-- Reuses detail composite types where possible

BEGIN;

-- 1) Drop functions that depend on these types first (breaks dependency on types)
-- Drop all versions of the functions using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_cohort_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_cohort_new_v4(%s)', r.sig);
    END LOOP;
END $$;
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_cohort_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_cohort_detail_v4(%s)', r.sig);
    END LOOP;
END $$;
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_cohort_search_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_cohort_search_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE (reuse detail types, only drop new ones)
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_cohort_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types (reuse detail simulation types, create new ones for staff/objects)
CREATE TYPE types.q_get_cohort_new_v4_staff_item AS (
    profile_id uuid,
    first_name text,
    last_name text,
    emails text[],
    primary_email text,
    name text,
    role text,
    initials text,
    active boolean,
    last_active timestamptz,
    cohort_ids text[],
    department_ids text[],
    primary_department_id uuid,
    requests_per_day int,
    total_requests bigint,
    requests_in_last_day int,
    can_edit boolean,
    can_delete boolean,
    can_remove boolean
);

CREATE TYPE types.q_get_cohort_new_v4_profile AS (
    profile_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_cohort_new_v4_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_cohort_new_v4_department_for_staff AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_cohort_new_v4_department AS (
    department_id uuid,
    name text,
    description text,
    simulation_ids text[],
    staff_ids text[]
);

-- 4) Recreate function (reuses detail simulation types)
CREATE OR REPLACE FUNCTION api_get_cohort_new_v4(
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    title text,
    description text,
    department_ids text[],
    active boolean,
    can_edit boolean,
    profile_ids text[],
    simulation_ids text[],
    valid_department_ids text[],
    valid_simulation_ids text[],
    valid_profile_ids text[],
    simulations types.q_get_cohort_detail_v4_simulation[],
    simulations_for_picker types.q_get_cohort_detail_v4_simulation_for_picker[],
    profiles types.q_get_cohort_new_v4_profile[],
    staff types.q_get_cohort_new_v4_staff_item[],
    cohorts types.q_get_cohort_new_v4_cohort[],
    departments_for_staff types.q_get_cohort_new_v4_department_for_staff[],
    departments types.q_get_cohort_new_v4_department[],
    primary_department_id text,
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        d.payload
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    AND d.resource_type = 'cohorts'::draft_resource_type
    LIMIT 1
),
user_departments AS (
    SELECT ARRAY_AGG(DISTINCT pd.department_id) as dept_ids
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id
),
default_cohort AS (
    SELECT c.id
    FROM params x
    JOIN cohorts c ON c.active = true
    LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
    GROUP BY c.id
    HAVING 
        COUNT(cd.cohort_id) FILTER (WHERE cd.department_id = ANY(COALESCE((SELECT dept_ids FROM user_departments), ARRAY[]::uuid[]))) > 0
        OR NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true)
    ORDER BY c.created_at DESC
    LIMIT 1
),
cohort_departments_data AS (
    SELECT 
        cd.cohort_id,
        ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at) as department_ids
    FROM default_cohort dc
    JOIN cohort_departments cd ON cd.cohort_id = dc.id AND cd.active = true
    GROUP BY cd.cohort_id
),
cohort_data AS (
    SELECT 
        COALESCE((SELECT id FROM default_cohort LIMIT 1), NULL::uuid) as id,
        COALESCE(
            (SELECT payload->>'title' FROM draft_payload_data),
            ''::text
        ) as title,
        COALESCE(
            (SELECT payload->>'description' FROM draft_payload_data),
            ''::text
        ) as description,
        COALESCE(
            (SELECT (payload->>'active')::boolean FROM draft_payload_data),
            true::boolean
        ) as active,
        COALESCE(
            CASE 
                WHEN EXISTS (SELECT 1 FROM draft_payload_data WHERE payload ? 'department_ids') 
                THEN (SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids')) FROM draft_payload_data)
                ELSE NULL
            END,
            NULL::text[]
        ) as department_ids
    FROM params x
    LEFT JOIN default_cohort dc ON true
    LEFT JOIN cohorts c ON c.id = dc.id
    LEFT JOIN cohort_departments_data cdd ON cdd.cohort_id = c.id
),
cohort_profile_ids AS (
    SELECT cp.profile_id
    FROM default_cohort dc
    JOIN cohort_profiles cp ON cp.cohort_id = dc.id AND cp.active = true
),
cohort_simulation_ids AS (
    SELECT cs.simulation_id, cs.active, cs.position
    FROM default_cohort dc
    JOIN cohort_simulations cs ON cs.cohort_id = dc.id
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
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        ) as time_limit,
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
    LEFT JOIN simulation_attempts sa ON sa.simulation_id = cs.simulation_id 
    LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = true
    LEFT JOIN cohort_profile_ids cp ON cp.profile_id = ap.profile_id
    LEFT JOIN attempt_chats ac ON ac.attempt_id = sa.id
    LEFT JOIN chats sc ON sc.id = ac.chat_id
    LEFT JOIN grades scg ON EXISTS (
        SELECT 1 FROM runs r_check
        JOIN group_runs gr_check ON gr_check.run_id = r_check.id
        JOIN groups g_check ON g_check.id = gr_check.group_id
        JOIN chat_groups cg_check ON cg_check.group_id = g_check.id
        JOIN chats c_check ON c_check.id = cg_check.chat_id
        WHERE r_check.id = scg.run_id AND c_check.id = sc.id
    )
    LEFT JOIN runs r_cohort_new ON r_cohort_new.id = scg.run_id
    LEFT JOIN LATERAL (
        SELECT DISTINCT c.id AS chat_id
        FROM runs r
        JOIN group_runs gr ON gr.run_id = r.id
        JOIN groups g ON g.id = gr.group_id
        JOIN chat_groups cg ON cg.group_id = g.id
        JOIN chats c ON c.id = cg.chat_id
        WHERE r.id = r_cohort_new.id AND c.id = sc.id
        LIMIT 1
    ) chat_lookup_cohort ON true
    GROUP BY cs.simulation_id, cs.active, cs.position, s.id, s.title, s.description
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
    SELECT 
        CASE 
            -- If draft exists and has department_ids, it's not a default cohort
            WHEN EXISTS (SELECT 1 FROM draft_payload_data WHERE payload ? 'department_ids') THEN false
            -- If no draft, check if department_ids from default cohort is NULL
            WHEN COALESCE(cd.department_ids, NULL) IS NULL THEN true
            ELSE false
        END as is_default
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
        -- For new cohorts (no draft), include all simulations accessible to user's departments
        (cid.is_default = true AND (
            COUNT(sd.simulation_id) FILTER (WHERE sd.department_id IN (SELECT id FROM valid_dept_ids)) > 0
            OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
        ))
        OR
        -- For cohorts with department links (from draft), use department filtering
        (cid.is_default = false AND (
            COUNT(sd.simulation_id) FILTER (WHERE sd.department_id IN (SELECT id FROM valid_dept_ids)) > 0
            OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
        ))
),
valid_profiles AS (
    SELECT DISTINCT p.id
    FROM params x
    JOIN profiles p ON p.active = true
    LEFT JOIN profile_departments pd ON pd.profile_id = p.id
    CROSS JOIN cohort_is_default cid
    WHERE (
        -- For default cohorts (no department links), include all profiles in the cohort
        (cid.is_default = true AND p.id IN (SELECT profile_id FROM cohort_profile_ids))
        OR
        -- For non-default cohorts, use department filtering
        (cid.is_default = false AND pd.department_id IN (SELECT id FROM valid_dept_ids))
    )
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
simulation_mapping_data AS (
    SELECT 
        s.id::text as simulation_id,
        s.title as name,
        COALESCE(s.description, '') as description,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        ) as time_limit,
        ARRAY[]::text[] as department_ids
    FROM params x
    JOIN simulations s ON s.active = true
    WHERE s.id IN (SELECT id FROM valid_simulations)
),
profile_mapping_data AS (
    SELECT 
        p.id as profile_id,
        p.first_name || ' ' || p.last_name as name,
        COALESCE((SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1), '') as description
    FROM params x
    JOIN profiles p ON p.id IN (SELECT profile_id FROM cohort_profile_ids)
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
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mr.created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY mrp.profile_id
),
profile_total_runs AS (
    SELECT 
        mrp.profile_id,
        COUNT(*) as total_requests
    FROM run_profiles mrp
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
cohort_mapping_data AS (
    SELECT 
        c.id as cohort_id,
        c.title as name,
        COALESCE(c.description, '') as description
    FROM cohorts c
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids_for_staff)
),
department_mapping_for_staff_data AS (
    SELECT 
        d.id::text as department_id,
        d.title as name,
        COALESCE(d.description, '') as description
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM all_department_ids_for_staff)
    AND d.active = true
),
user_profile_for_staff AS (
    SELECT role FROM params x JOIN profiles p ON p.id = x.profile_id
),
user_profile_for_cohort AS (
    SELECT 
        role,
        first_name || ' ' || last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
primary_department_id AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.is_primary = TRUE
    LIMIT 1
),
cohort_staff AS (
    SELECT DISTINCT ON (p.id)
        p.id as profile_id,
        p.first_name,
        p.last_name,
        ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
        p.first_name || ' ' || p.last_name as name,
        p.role,
        SUBSTRING(p.first_name FROM 1 FOR 1) || SUBSTRING(p.last_name FROM 1 FOR 1) as initials,
        p.active,
        pa.last_active as lastActive,
        prl.requests_per_day as requests_per_day,
        COALESCE(rr.run_count::int, 0) as requests_in_last_day,
        COALESCE(pc.cohort_ids, ARRAY[]::text[]) as cohort_ids,
        COALESCE(pda.department_ids, ARRAY[]::text[]) as department_ids,
        ppd.department_id as department_id,
        COALESCE(ptr.total_requests, 0) as total_requests,
        COALESCE(pacl.active_cohort_count, 0) as active_cohort_count,
        COALESCE(pacl_all.total_cohort_links, 0) as total_cohort_links,
        CASE 
            WHEN p.id = (SELECT profile_id FROM params) THEN true
            WHEN ups.role = 'superadmin'::profile_role THEN true
            WHEN ups.role = 'admin'::profile_role AND p.role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN ups.role = 'instructional'::profile_role AND p.role IN ('member'::profile_role, 'guest'::profile_role) THEN true
            WHEN ups.role = 'member'::profile_role AND p.role = 'guest'::profile_role THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN p.id = (SELECT profile_id FROM params) THEN false
            WHEN ups.role = 'superadmin'::profile_role THEN true
            WHEN COALESCE(pacl_all.total_cohort_links, 0) > 0 THEN false
            WHEN ups.role = 'admin'::profile_role AND p.role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN ups.role = 'instructional'::profile_role AND p.role IN ('member'::profile_role, 'guest'::profile_role) THEN true
            WHEN ups.role = 'member'::profile_role AND p.role = 'guest'::profile_role THEN true
            ELSE false
        END as can_delete,
        CASE 
            WHEN p.id = (SELECT profile_id FROM params) THEN false
            WHEN ups.role = 'superadmin'::profile_role THEN true
            WHEN ups.role = 'admin'::profile_role AND p.role IN ('admin'::profile_role, 'instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN ups.role = 'instructional'::profile_role AND p.role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN ups.role = 'member'::profile_role AND p.role IN ('member'::profile_role, 'guest'::profile_role) THEN true
            WHEN ups.role = 'guest'::profile_role AND p.role = 'guest'::profile_role THEN true
            ELSE false
        END as can_remove
    FROM params x
    JOIN profiles p ON true
    JOIN cohort_profile_ids cpi ON cpi.profile_id = p.id
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
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
        ups.role = 'superadmin'::profile_role OR
        (ups.role = 'admin'::profile_role AND p.role IN ('admin'::profile_role, 'instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role)) OR
        (ups.role = 'instructional'::profile_role AND p.role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role)) OR
        (ups.role = 'member'::profile_role AND p.role IN ('member'::profile_role, 'guest'::profile_role)) OR
        (ups.role = 'guest'::profile_role AND p.role = 'guest'::profile_role)
    )
    GROUP BY p.id, p.first_name, p.last_name, p.role, p.active,
             pa.last_active, prl.requests_per_day,
             pc.cohort_ids, pda.department_ids, ppd.department_id, ptr.total_requests,
             pacl.active_cohort_count, pacl_all.total_cohort_links, rr.run_count, ups.role
    ORDER BY p.id, p.last_name, p.first_name
),
department_mapping_data AS (
    SELECT 
        vd.id as department_id,
        vd.name,
        COALESCE(vd.description, '') as description,
        COALESCE(dsic.simulation_ids, ARRAY[]::text[]) as simulation_ids,
        COALESCE(dpi.staff_ids, ARRAY[]::text[]) as staff_ids
    FROM valid_departments vd
    LEFT JOIN department_simulation_ids_with_cross dsic ON dsic.department_id = vd.id
    LEFT JOIN department_profile_ids dpi ON dpi.department_id = vd.id
)
SELECT 
    cd.title,
    cd.description,
    cd.department_ids,
    cd.active,
    CASE 
        WHEN COALESCE(cd.department_ids, NULL) IS NULL AND upc.role != 'superadmin' THEN false
        WHEN upc.role IN ('admin', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    (SELECT COALESCE(array_agg(profile_id::text), ARRAY[]::text[])
     FROM cohort_profile_ids) as profile_ids,
    CASE 
        -- If draft exists and has simulation_ids, use draft
        WHEN EXISTS (SELECT 1 FROM draft_payload_data WHERE payload ? 'simulation_ids') 
        THEN (SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'simulation_ids')) FROM draft_payload_data)
        -- Otherwise, return empty array for new cohort (no draft)
        ELSE ARRAY[]::text[]
    END as simulation_ids,
    (SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
     FROM valid_dept_ids) as valid_department_ids,
    (SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
     FROM valid_simulations) as valid_simulation_ids,
    (SELECT COALESCE(array_agg(id::text), ARRAY[]::text[])
     FROM valid_profiles) as valid_profile_ids,
    (SELECT COALESCE(
        ARRAY_AGG(
            (css.simulation_id::text, css.name, css.description, css.time_limit, css.active, css.position, css.usage_count, css.success_rate, css.last_used, CASE WHEN css.usage_count = 0 THEN true ELSE false END)::types.q_get_cohort_detail_v4_simulation
            ORDER BY css.position
        ),
        '{}'::types.q_get_cohort_detail_v4_simulation[]
    )
     FROM cohort_simulation_stats css) as simulations,
    (SELECT COALESCE(
        ARRAY_AGG(
            (smd.simulation_id, smd.name, smd.description, smd.time_limit, smd.department_ids)::types.q_get_cohort_detail_v4_simulation_for_picker
        ),
        '{}'::types.q_get_cohort_detail_v4_simulation_for_picker[]
    )
     FROM simulation_mapping_data smd) as simulations_for_picker,
    (SELECT COALESCE(
        ARRAY_AGG(
            (pmd.profile_id, pmd.name, pmd.description)::types.q_get_cohort_new_v4_profile
        ),
        '{}'::types.q_get_cohort_new_v4_profile[]
    )
     FROM profile_mapping_data pmd) as profiles,
    (SELECT COALESCE(
        ARRAY_AGG(
            (cs.profile_id, cs.first_name, cs.last_name, cs.emails, cs.primary_email, cs.name, cs.role, cs.initials, cs.active, cs.lastActive, cs.cohort_ids, cs.department_ids, cs.department_id, cs.requests_per_day, cs.total_requests, cs.requests_in_last_day, cs.can_edit, cs.can_delete, cs.can_remove)::types.q_get_cohort_new_v4_staff_item
            ORDER BY cs.last_name, cs.first_name
        ),
        '{}'::types.q_get_cohort_new_v4_staff_item[]
    )
     FROM cohort_staff cs) as staff,
    (SELECT COALESCE(
        ARRAY_AGG(
            (cmd.cohort_id, cmd.name, cmd.description)::types.q_get_cohort_new_v4_cohort
        ),
        '{}'::types.q_get_cohort_new_v4_cohort[]
    )
     FROM cohort_mapping_data cmd) as cohorts,
    (SELECT COALESCE(
        ARRAY_AGG(
            (dmfsd.department_id, dmfsd.name, dmfsd.description)::types.q_get_cohort_new_v4_department_for_staff
        ),
        '{}'::types.q_get_cohort_new_v4_department_for_staff[]
    )
     FROM department_mapping_for_staff_data dmfsd) as departments_for_staff,
    (SELECT COALESCE(
        ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.simulation_ids, dmd.staff_ids)::types.q_get_cohort_new_v4_department
        ),
        '{}'::types.q_get_cohort_new_v4_department[]
    )
     FROM department_mapping_data dmd) as departments,
    (SELECT department_id FROM primary_department_id LIMIT 1) as primary_department_id,
    upc.actor_name
FROM cohort_data cd
CROSS JOIN user_profile_for_cohort upc
$$;

COMMIT;
