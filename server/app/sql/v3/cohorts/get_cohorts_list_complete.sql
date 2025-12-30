-- Get cohorts list with permissions and relationships
-- Converted to function with composite types

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_list_cohorts_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_cohorts_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_list_cohorts_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_cohorts_v3_cohort AS (
    cohort_id uuid,
    name text,
    description text,
    active boolean,
    department_ids text[],
    profile_ids text[],
    simulation_ids text[],
    usage_count bigint,
    num_members int,
    can_edit boolean,
    can_delete boolean,
    can_duplicate boolean,
    can_leave boolean,
    updated_at timestamptz
);

CREATE TYPE types.q_list_cohorts_v3_profile AS (
    profile_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_cohorts_v3_simulation AS (
    simulation_id uuid,
    name text,
    description text,
    time_limit bigint,
    department_ids text[],
    scenario_ids text[]
);

CREATE TYPE types.q_list_cohorts_v3_scenario AS (
    scenario_id uuid,
    name text,
    description text,
    active boolean,
    persona_ids text[],
    persona_mapping jsonb  -- Keep as JSONB for nested structure (Option A from plan)
);

CREATE TYPE types.q_list_cohorts_v3_department AS (
    department_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_cohorts_v3(
    profile_id uuid
)
RETURNS TABLE (
    actor_name text,
    cohorts types.q_list_cohorts_v3_cohort[],
    profiles types.q_list_cohorts_v3_profile[],
    simulations types.q_list_cohorts_v3_simulation[],
    scenarios types.q_list_cohorts_v3_scenario[],
    simulation_scenario_mapping jsonb,  -- Keep as JSONB for dict structure
    departments types.q_list_cohorts_v3_department[]
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
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
user_profile AS (
    SELECT 
        role,
        first_name || ' ' || last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
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
cohort_profiles_role_filtered AS (
    SELECT 
        cp.cohort_id,
        ARRAY_AGG(cp.profile_id) FILTER (
            WHERE 
                (up.role = profile_role.superadmin) OR
                (up.role = profile_role.admin AND p.role IN (profile_role.admin, profile_role.instructional, profile_role.member, profile_role.guest)) OR
                (up.role = profile_role.instructional AND p.role IN (profile_role.instructional, profile_role.member, profile_role.guest)) OR
                (up.role = profile_role.member AND p.role IN (profile_role.member, profile_role.guest)) OR
                (up.role = profile_role.guest AND p.role = profile_role.guest)
        ) as profile_ids
    FROM cohort_profiles cp
    JOIN profiles p ON p.id = cp.profile_id
    CROSS JOIN user_profile up
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
user_in_cohort AS (
    SELECT cohort_id
    FROM params x
    JOIN cohort_profiles cp ON cp.profile_id = x.profile_id AND cp.active = true
),
all_profile_ids AS (
    SELECT DISTINCT unnest(profile_ids) as profile_id
    FROM cohort_profiles_agg
),
all_simulation_ids AS (
    SELECT DISTINCT unnest(simulation_ids) as simulation_id
    FROM cohort_simulations_agg
),
simulation_scenarios_agg AS (
    SELECT 
        ss.simulation_id,
        ARRAY_AGG(ss.scenario_id ORDER BY sc.name) as scenario_ids
    FROM simulation_scenarios ss
    JOIN scenarios sc ON sc.id = ss.scenario_id
    WHERE ss.simulation_id IN (SELECT simulation_id FROM all_simulation_ids)
      AND ss.active = true
    GROUP BY ss.simulation_id
),
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM simulation_scenarios_agg
),
scenario_personas_agg AS (
    SELECT 
        sp.scenario_id,
        ARRAY_AGG(sp.persona_id::text ORDER BY sp.persona_id) as persona_ids
    FROM scenario_personas sp
    WHERE sp.scenario_id IN (SELECT scenario_id FROM all_scenario_ids)
      AND sp.active = true
    GROUP BY sp.scenario_id
),
all_persona_ids AS (
    SELECT DISTINCT unnest(persona_ids)::uuid as persona_id
    FROM scenario_personas_agg
    WHERE persona_ids IS NOT NULL
),
persona_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name,
                'description', COALESCE(p.description, ''),
                'color', p.color,
                'icon', p.icon,
                'image_model', false
            )
        ) FILTER (WHERE p.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_persona_ids api
    LEFT JOIN personas p ON p.id = api.persona_id
),
scenario_mapping_data AS (
    SELECT 
        s.id::text as scenario_id,
        s.name,
        COALESCE(ps.problem_statement, '') as description,
        s.active,
        COALESCE(spa.persona_ids, ARRAY[]::text[]) as persona_ids,
        pm.mapping as persona_mapping
    FROM all_scenario_ids asi
    LEFT JOIN scenarios s ON s.id = asi.scenario_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    LEFT JOIN scenario_personas_agg spa ON spa.scenario_id = s.id
    LEFT JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
    CROSS JOIN persona_mapping_data pm
    WHERE s.id IS NOT NULL AND st.parent_id IS NOT NULL
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM cohort_departments_data
    WHERE department_ids IS NOT NULL
    UNION
    SELECT department_id FROM user_departments
),
department_mapping_data AS (
    SELECT 
        d.id as department_id,
        d.title as name,
        COALESCE(d.description, '') as description
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM all_department_ids)
),
cohorts_data AS (
    SELECT 
        c.id as cohort_id,
        c.title as name,
        c.description,
        c.active,
        c.updated_at,
        COALESCE(cdd.department_ids, NULL) as department_ids,
        COALESCE(cp.profile_ids, ARRAY[]::uuid[]) as profile_ids,
        COALESCE(cs.simulation_ids, ARRAY[]::uuid[]) as simulation_ids,
        COALESCE(cu.usage_count, 0) as usage_count,
        COALESCE(array_length(cprf.profile_ids, 1), 0) as num_members,
        CASE 
            WHEN COALESCE(cdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN (profile_role.admin, profile_role.superadmin) THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN COALESCE(cdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role IN (profile_role.admin, profile_role.superadmin) AND COALESCE(cu.usage_count, 0) = 0 THEN true
            ELSE false
        END as can_delete,
        true as can_duplicate,
        CASE
            WHEN uic.cohort_id IS NOT NULL THEN true
            ELSE false
        END as can_leave
    FROM params x
    JOIN cohorts c ON true
    LEFT JOIN cohort_departments cd ON cd.cohort_id = c.id AND cd.active = true
    LEFT JOIN cohort_departments_data cdd ON cdd.cohort_id = c.id
    LEFT JOIN cohort_profiles_agg cp ON cp.cohort_id = c.id
    LEFT JOIN cohort_profiles_role_filtered cprf ON cprf.cohort_id = c.id
    LEFT JOIN cohort_simulations_agg cs ON cs.cohort_id = c.id
    LEFT JOIN cohort_usage cu ON cu.cohort_id = c.id
    LEFT JOIN user_in_cohort uic ON uic.cohort_id = c.id
    CROSS JOIN user_profile up
    WHERE (
        (up.role = profile_role.instructional AND uic.cohort_id IS NOT NULL)
        OR
        up.role != 'instructional'
    )
    GROUP BY c.id, c.title, c.description, c.active, c.updated_at,
             cdd.department_ids, cp.profile_ids, cprf.profile_ids, cs.simulation_ids, cu.usage_count, up.role, uic.cohort_id
    HAVING 
        COUNT(cd.cohort_id) FILTER (WHERE cd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM cohort_departments cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true)
),
profile_mapping_data AS (
    SELECT 
        p.id as profile_id,
        p.first_name || ' ' || p.last_name as name,
        COALESCE((SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1), '') as description
    FROM profiles p
    WHERE p.id IN (SELECT profile_id FROM all_profile_ids)
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
        COALESCE(sdd.department_ids, ARRAY[]::text[]) as department_ids,
        COALESCE(ssa.scenario_ids, ARRAY[]::uuid[])::text[] as scenario_ids
    FROM simulations s
    LEFT JOIN (
        SELECT 
            sd.simulation_id,
            ARRAY_AGG(sd.department_id::text ORDER BY sd.created_at) as department_ids
        FROM simulation_departments sd
        WHERE sd.active = true
        GROUP BY sd.simulation_id
    ) sdd ON sdd.simulation_id = s.id
    LEFT JOIN simulation_scenarios_agg ssa ON ssa.simulation_id = s.id
    WHERE s.id IN (SELECT simulation_id FROM all_simulation_ids)
),
simulation_scenario_mapping_data AS (
    SELECT 
        ssa.simulation_id::text,
        ssa.scenario_ids::text[]
    FROM simulation_scenarios_agg ssa
),
-- Build facet options with disambiguation
profile_options_data AS (
    SELECT 
        pid.profile_id,
        pmd.name,
        CASE 
            WHEN (SELECT COUNT(*) FROM profile_mapping_data pmd2 WHERE pmd2.name = pmd.name) > 1 
            THEN pmd.name || ' (' || SUBSTRING(pid.profile_id::text FROM LENGTH(pid.profile_id::text) - 7) || ')'
            ELSE pmd.name
        END as label
    FROM all_profile_ids pid
    JOIN profile_mapping_data pmd ON pmd.profile_id = pid.profile_id
),
simulation_options_data AS (
    SELECT 
        sid.simulation_id,
        smd.name,
        CASE 
            WHEN (SELECT COUNT(*) FROM simulation_mapping_data smd2 WHERE smd2.name = smd.name) > 1 
            THEN smd.name || ' (' || SUBSTRING(sid.simulation_id::text FROM LENGTH(sid.simulation_id::text) - 7) || ')'
            ELSE smd.name
        END as label
    FROM all_simulation_ids sid
    JOIN simulation_mapping_data smd ON smd.simulation_id = sid.simulation_id
),
department_options_data AS (
    SELECT 
        did.department_id,
        dmd.name as label
    FROM all_department_ids did
    JOIN department_mapping_data dmd ON dmd.department_id = did.department_id
    WHERE did.department_id IN (SELECT department_id FROM user_departments)
)
SELECT 
    up.actor_name,
    -- Aggregate cohorts separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (cd.cohort_id, cd.name, cd.description, cd.active, cd.department_ids, 
             ARRAY(SELECT unnest(cd.profile_ids)::text), 
             ARRAY(SELECT unnest(cd.simulation_ids)::text),
             cd.usage_count, cd.num_members, cd.can_edit, cd.can_delete, cd.can_duplicate, cd.can_leave, cd.updated_at)::types.q_list_cohorts_v3_cohort
            ORDER BY cd.updated_at DESC NULLS LAST
        ) FROM cohorts_data cd),
        '{}'::types.q_list_cohorts_v3_cohort[]
    ) as cohorts,
    -- Aggregate profiles separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (pmd.profile_id, pmd.name, pmd.description)::types.q_list_cohorts_v3_profile
            ORDER BY pmd.name
        ) FROM profile_mapping_data pmd),
        '{}'::types.q_list_cohorts_v3_profile[]
    ) as profiles,
    -- Aggregate simulations separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (smd.simulation_id, smd.name, smd.description, smd.time_limit, smd.department_ids, smd.scenario_ids)::types.q_list_cohorts_v3_simulation
            ORDER BY smd.name
        ) FROM simulation_mapping_data smd),
        '{}'::types.q_list_cohorts_v3_simulation[]
    ) as simulations,
    -- Aggregate scenarios separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (smd2.scenario_id, smd2.name, smd2.description, smd2.active, smd2.persona_ids, smd2.persona_mapping)::types.q_list_cohorts_v3_scenario
            ORDER BY smd2.name
        ) FROM scenario_mapping_data smd2),
        '{}'::types.q_list_cohorts_v3_scenario[]
    ) as scenarios,
    -- Aggregate simulation_scenario_mapping separately
    COALESCE(
        (SELECT jsonb_object_agg(
            ssmd.simulation_id,
            ssmd.scenario_ids
        ) FROM simulation_scenario_mapping_data ssmd),
        '{}'::jsonb
    ) as simulation_scenario_mapping,
    -- Aggregate departments separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description)::types.q_list_cohorts_v3_department
            ORDER BY dmd.name
        ) FROM department_mapping_data dmd),
        '{}'::types.q_list_cohorts_v3_department[]
    ) as departments
FROM user_profile up
$$;

COMMIT;

