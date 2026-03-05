-- Get cohorts list with permissions and relationships
-- Resource-first: only touches cohort_artifact + cohort's own junctions + resource tables
-- No cross-entity artifact tables (simulation_artifact, profile_artifact, etc.)
-- Removed: view_cohort_edit_state, all scenario/persona CTEs, simulation_scenarios_junction
-- Uses: cohorts_resource.simulation_ids (migration 357), cohorts_resource.profile_ids (migration 500)
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_list_cohorts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_cohorts_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_list_cohorts_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types (profile/simulation/department mapping types removed — hydrated in Python)
CREATE TYPE types.q_list_cohorts_v4_cohort AS (
    cohort_id uuid,
    name text,
    description text,
    is_inactive boolean,
    department_ids text[],
    profile_ids text[],
    simulation_ids text[],
    usage_count bigint,
    num_members int,
    is_member boolean,
    generated boolean,
    mcp boolean,
    updated_at timestamptz
);

CREATE TYPE types.q_list_cohorts_v4_option AS (
    value text,
    label text,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_cohorts_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    filter_simulation_ids uuid[] DEFAULT NULL,
    filter_profile_ids uuid[] DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    simulation_search text DEFAULT NULL,
    profile_search text DEFAULT NULL,
    department_search text DEFAULT NULL,
    page_size int DEFAULT 12,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    cohorts types.q_list_cohorts_v4_cohort[],
    simulation_options types.q_list_cohorts_v4_option[],
    profile_options types.q_list_cohorts_v4_option[],
    department_options types.q_list_cohorts_v4_option[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- User context: actor_name comes from get_profile_context_internal() in Python
user_profile AS (
    SELECT COALESCE(r.role, 'member'::profile_type) as role,
           ''::text as actor_name
    FROM profile_roles_junction prj
    JOIN roles_resource r ON prj.role_id = r.id
    WHERE prj.profile_id = (SELECT profile_id FROM params)
    LIMIT 1
),
-- Bridge: cohort_artifact.id -> cohorts_resource.id
cohort_resource_bridge AS (
    SELECT ccj.cohort_id, ccj.cohorts_id as resource_id
    FROM cohort_cohorts_junction ccj
),
-- User's own profile resource (for is_member check)
user_profile_resource AS (
    SELECT pr.id as resource_id
    FROM profile_profiles_junction ppj
    JOIN profiles_resource pr ON pr.id = ppj.profiles_id
    WHERE ppj.profile_id = (SELECT profile_id FROM params)
    LIMIT 1
),
-- Department IDs per cohort (cohort's own junction)
cohort_departments_data AS (
    SELECT
        cd.cohort_id,
        ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at) as department_ids
    FROM cohort_departments_junction cd
    WHERE cd.active = true
    GROUP BY cd.cohort_id
),
-- Usage count: count of attempts linked to this cohort via home/practice connections
cohort_usage AS (
    SELECT
        crb.cohort_id,
        COUNT(DISTINCT a.id)::bigint as usage_count
    FROM cohort_resource_bridge crb
    LEFT JOIN home_cohorts_connection hcc ON hcc.cohorts_id = crb.resource_id AND hcc.active = true
    LEFT JOIN attempt_home_entry ahe ON ahe.home_id = hcc.home_id AND ahe.active = true
    LEFT JOIN practice_cohorts_connection pcc ON pcc.cohorts_id = crb.resource_id AND pcc.active = true
    LEFT JOIN attempt_practice_entry ape ON ape.practice_id = pcc.practice_id AND ape.active = true
    LEFT JOIN attempt_entry a ON (a.id = ahe.attempt_id OR a.id = ape.attempt_id) AND a.active = true
    GROUP BY crb.cohort_id
),
-- Profiles per cohort via denormalized cohorts_resource.profile_ids
cohort_profiles_agg AS (
    SELECT
        crb.cohort_id,
        ARRAY_AGG(pr.id ORDER BY pr.name) as profile_ids
    FROM cohort_resource_bridge crb
    JOIN cohorts_resource cr ON cr.id = crb.resource_id
    JOIN profiles_resource pr ON pr.id = ANY(cr.profile_ids)
    GROUP BY crb.cohort_id
),
cohort_profiles_role_filtered AS (
    SELECT
        crb.cohort_id,
        ARRAY_AGG(pr.id) FILTER (
            WHERE
                (up.role = 'superadmin'::profile_type) OR
                (up.role = 'admin'::profile_type AND pr.role IN ('admin', 'instructional', 'member', 'guest')) OR
                (up.role = 'instructional'::profile_type AND pr.role IN ('instructional', 'member', 'guest')) OR
                (up.role = 'member'::profile_type AND pr.role IN ('member', 'guest')) OR
                (up.role = 'guest'::profile_type AND pr.role = 'guest')
        ) as profile_ids
    FROM cohort_resource_bridge crb
    JOIN cohorts_resource cr ON cr.id = crb.resource_id
    JOIN profiles_resource pr ON pr.id = ANY(cr.profile_ids)
    CROSS JOIN user_profile up
    GROUP BY crb.cohort_id
),
-- Simulation IDs per cohort via denormalized cohorts_resource.simulation_ids
cohort_simulations_agg AS (
    SELECT
        crb.cohort_id,
        cr.simulation_ids
    FROM cohort_resource_bridge crb
    JOIN cohorts_resource cr ON cr.id = crb.resource_id
    WHERE cr.simulation_ids IS NOT NULL AND array_length(cr.simulation_ids, 1) > 0
),
-- Main cohort data — permissions computed in Python
cohorts_data AS (
    SELECT
        c.id as cohort_id,
        (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM cohort_descriptions_junction cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1), '') as description,
        NOT EXISTS (SELECT 1 FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.type = 'cohort_active' AND f.value = TRUE) as is_inactive,
        c.updated_at,
        cdd.department_ids as department_ids,
        COALESCE(cp.profile_ids, ARRAY[]::uuid[]) as profile_ids,
        COALESCE(csa.simulation_ids::uuid[], ARRAY[]::uuid[]) as simulation_ids,
        COALESCE(cu.usage_count, 0) as usage_count,
        COALESCE(array_length(cprf.profile_ids, 1), 0) as num_members,
        -- is_member: needed for Python compute_can_leave (check if user's profile_id is in cohort's profile_ids)
        CASE
            WHEN upr.resource_id IS NOT NULL AND cr_res.profile_ids IS NOT NULL AND upr.resource_id = ANY(cr_res.profile_ids) THEN true
            ELSE false
        END as is_member,
        c.generated,
        c.mcp
    FROM params x
    JOIN cohort_artifact c ON true
    LEFT JOIN cohort_resource_bridge crb ON crb.cohort_id = c.id
    LEFT JOIN cohort_departments_junction cd ON cd.cohort_id = c.id AND cd.active = true
    LEFT JOIN cohort_departments_data cdd ON cdd.cohort_id = c.id
    LEFT JOIN cohort_usage cu ON cu.cohort_id = c.id
    LEFT JOIN cohort_profiles_agg cp ON cp.cohort_id = c.id
    LEFT JOIN cohort_profiles_role_filtered cprf ON cprf.cohort_id = c.id
    LEFT JOIN cohort_simulations_agg csa ON csa.cohort_id = c.id
    LEFT JOIN user_profile_resource upr ON true
    LEFT JOIN cohorts_resource cr_res ON cr_res.id = crb.resource_id
    CROSS JOIN user_profile up
    WHERE (
        (up.role = 'instructional'::profile_type AND upr.resource_id IS NOT NULL AND cr_res.profile_ids IS NOT NULL AND upr.resource_id = ANY(cr_res.profile_ids))
        OR
        up.role != 'instructional'
    )
    GROUP BY c.id, (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1), (SELECT d.description FROM cohort_descriptions_junction cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1), EXISTS (SELECT 1 FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.type = 'cohort_active' AND f.value = TRUE), c.updated_at,
             cdd.department_ids, cp.profile_ids, cprf.profile_ids, csa.simulation_ids, cu.usage_count, up.role, upr.resource_id, cr_res.profile_ids, crb.resource_id, c.generated, c.mcp
    HAVING
        COUNT(cd.cohort_id) FILTER (WHERE cd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM cohort_departments_junction cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true)
),
-- Server-side filtering
filtered_cohorts AS (
    SELECT cd.*
    FROM cohorts_data cd
    WHERE (search IS NULL OR LOWER(cd.name) LIKE '%' || LOWER(search) || '%' OR LOWER(cd.description) LIKE '%' || LOWER(search) || '%')
      AND (filter_simulation_ids IS NULL OR cd.simulation_ids && filter_simulation_ids)
      AND (filter_profile_ids IS NULL OR cd.profile_ids && filter_profile_ids)
      AND (filter_department_ids IS NULL OR cd.department_ids && filter_department_ids::text[])
),
filtered_count AS (
    SELECT COUNT(*)::bigint as total FROM filtered_cohorts
),
paginated_cohorts AS (
    SELECT * FROM filtered_cohorts
    ORDER BY updated_at DESC NULLS LAST
    LIMIT page_size OFFSET page_offset
),
-- Profile/simulation/department mapping removed — hydrated in Python via cached *_internal() functions
-- Options derived from ALL cohorts_data (unfiltered) for filter dropdowns
all_simulation_ids_options AS (
    SELECT DISTINCT unnest(simulation_ids) as simulation_id
    FROM cohorts_data
    WHERE simulation_ids IS NOT NULL AND simulation_ids != ARRAY[]::uuid[]
),
all_profile_ids_options AS (
    SELECT DISTINCT unnest(profile_ids) as profile_id
    FROM cohorts_data
    WHERE profile_ids IS NOT NULL AND profile_ids != ARRAY[]::uuid[]
),
all_department_ids_options AS (
    SELECT DISTINCT unnest(department_ids) as department_id
    FROM cohorts_data
    WHERE department_ids IS NOT NULL
)
SELECT
    -- Aggregate cohorts (from paginated set)
    COALESCE(
        (SELECT ARRAY_AGG(
            (cd.cohort_id, cd.name, cd.description, cd.is_inactive, cd.department_ids,
             ARRAY(SELECT unnest(cd.profile_ids)::text),
             ARRAY(SELECT unnest(cd.simulation_ids)::text),
             cd.usage_count, cd.num_members, cd.is_member, cd.generated, cd.mcp,
             cd.updated_at)::types.q_list_cohorts_v4_cohort
            ORDER BY cd.updated_at DESC NULLS LAST
        ) FROM paginated_cohorts cd),
        '{}'::types.q_list_cohorts_v4_cohort[]
    ) as cohorts,
    -- Simulation options (from ALL cohorts, filtered by search term) — resource-level IDs
    COALESCE(
        (SELECT ARRAY_AGG(
            (sr.id::text, COALESCE(sr.name, ''), (SELECT COUNT(*) FROM cohorts_data cd WHERE sr.id = ANY(cd.simulation_ids)))::types.q_list_cohorts_v4_option
            ORDER BY sr.name
        )
         FROM simulations_resource sr
         WHERE sr.id IN (SELECT simulation_id FROM all_simulation_ids_options)
           AND (simulation_search IS NULL OR LOWER(sr.name) LIKE '%' || LOWER(simulation_search) || '%')),
        '{}'::types.q_list_cohorts_v4_option[]
    ) as simulation_options,
    -- Profile options (from ALL cohorts, filtered by search term) — now resource-level IDs
    COALESCE(
        (SELECT ARRAY_AGG(
            (pr.id::text, COALESCE(pr.name, ''), (SELECT COUNT(*) FROM cohorts_data cd WHERE pr.id = ANY(cd.profile_ids)))::types.q_list_cohorts_v4_option
            ORDER BY pr.name
        )
         FROM profiles_resource pr
         WHERE pr.id IN (SELECT profile_id FROM all_profile_ids_options)
           AND (profile_search IS NULL OR LOWER(pr.name) LIKE '%' || LOWER(profile_search) || '%')),
        '{}'::types.q_list_cohorts_v4_option[]
    ) as profile_options,
    -- Department options (from user's departments with cohort links, filtered by search term)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dr.id::text, COALESCE(dr.name, ''), (SELECT COUNT(*) FROM cohorts_data cd WHERE dr.id::text = ANY(cd.department_ids)))::types.q_list_cohorts_v4_option
            ORDER BY dr.name
        )
         FROM departments_resource dr
         WHERE dr.id IN (SELECT department_id FROM user_departments)
           AND dr.id::text IN (SELECT department_id FROM all_department_ids_options)
           AND (department_search IS NULL OR LOWER(dr.name) LIKE '%' || LOWER(department_search) || '%')),
        '{}'::types.q_list_cohorts_v4_option[]
    ) as department_options,
    (SELECT total FROM filtered_count) as total_count
$$;

