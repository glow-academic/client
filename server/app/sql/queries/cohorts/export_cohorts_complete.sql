-- Export cohorts with full resource IDs and values for round-trip CSV
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_export_cohorts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_export_cohorts_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_export_cohorts_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_export_cohorts_v4_row AS (
    cohort_id uuid,
    -- Single-select: ID + value
    names_id uuid,
    name text,
    descriptions_id uuid,
    description text,
    -- Flag
    is_inactive boolean,
    -- Multi-select: ID arrays + value arrays
    department_ids uuid[],
    departments text[],
    simulation_ids uuid[],
    simulations text[],
    simulation_position_ids uuid[],
    simulation_positions text[],
    simulation_availability_ids uuid[],
    simulation_availability text[],
    profile_ids uuid[],
    profiles text[],
    profile_persona_ids uuid[],
    profile_personas text[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_export_cohorts_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    filter_simulation_ids uuid[] DEFAULT NULL,
    filter_profile_ids uuid[] DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    rows types.q_export_cohorts_v4_row[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT pd.departments_id as department_id
    FROM params x
    JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
user_profile AS (
    SELECT COALESCE(r.role, 'member'::profile_type) as role
    FROM profile_roles_junction prj
    JOIN roles_resource r ON prj.roles_id = r.id
    WHERE prj.profile_id = (SELECT profile_id FROM params)
    LIMIT 1
),
-- Bridge: cohort_artifact.id -> cohorts_resource.id
cohort_resource_bridge AS (
    SELECT ccj.cohort_id, ccj.cohorts_id as resources_id
    FROM cohort_cohorts_junction ccj
),
-- User's own profile resource (for instructional visibility)
user_profile_resource AS (
    SELECT pr.id as resources_id
    FROM profile_profiles_junction ppj
    JOIN profiles_resource pr ON pr.id = ppj.profile_id
    WHERE ppj.profile_id = (SELECT profile_id FROM params)
    LIMIT 1
),
-- Department data
cohort_departments_data AS (
    SELECT
        cd.cohort_id,
        ARRAY_AGG(cd.departments_id ORDER BY cd.created_at) as department_ids,
        ARRAY_AGG(dr.name ORDER BY cd.created_at) as department_names
    FROM cohort_departments_junction cd
    JOIN departments_resource dr ON dr.id = cd.departments_id
    WHERE cd.active = true
    GROUP BY cd.cohort_id
),
-- Simulation data (via junction)
cohort_simulations_data AS (
    SELECT
        csj.cohort_id,
        ARRAY_AGG(csj.simulations_id ORDER BY csj.created_at) as simulation_ids,
        ARRAY_AGG(sr.name ORDER BY csj.created_at) as simulation_names
    FROM cohort_simulations_junction csj
    JOIN simulations_resource sr ON sr.id = csj.simulations_id
    WHERE csj.active = true
    GROUP BY csj.cohort_id
),
-- Simulation position data
cohort_sim_positions_data AS (
    SELECT
        cspj.cohort_id,
        ARRAY_AGG(cspj.simulation_positions_id ORDER BY cspj.created_at) as position_ids,
        ARRAY_AGG(spr.value::text ORDER BY cspj.created_at) as position_values
    FROM cohort_simulation_positions_junction cspj
    JOIN simulation_positions_resource spr ON spr.id = cspj.simulation_positions_id
    WHERE cspj.active = true
    GROUP BY cspj.cohort_id
),
-- Simulation availability data (type:time format)
cohort_sim_availability_data AS (
    SELECT
        csaj.cohort_id,
        ARRAY_AGG(csaj.simulation_availability_id ORDER BY sar.time) as availability_ids,
        ARRAY_AGG(sar.type::text || ':' || sar.time::text ORDER BY sar.time) as availability_values
    FROM cohort_simulation_availability_junction csaj
    JOIN simulation_availability_resource sar ON sar.id = csaj.simulation_availability_id
    WHERE csaj.active = true
    GROUP BY csaj.cohort_id
),
-- Profile data (via junction)
cohort_profiles_data AS (
    SELECT
        cpj.cohort_id,
        ARRAY_AGG(cpj.profiles_id ORDER BY cpj.created_at) as profile_ids,
        ARRAY_AGG(pr.name ORDER BY cpj.created_at) as profile_names
    FROM cohort_profiles_junction cpj
    JOIN profiles_resource pr ON pr.id = cpj.profiles_id
    WHERE cpj.active = true
    GROUP BY cpj.cohort_id
),
-- Profile persona data (profile_name + persona_name)
cohort_profile_personas_data AS (
    SELECT
        cppj.cohort_id,
        ARRAY_AGG(cppj.profile_personas_id ORDER BY cppj.created_at) as profile_persona_ids,
        ARRAY_AGG(COALESCE(pr.name, '') || ' → ' || COALESCE(
            (SELECT n.name FROM persona_names_junction pnj JOIN names_resource n ON pnj.names_id = n.id WHERE pnj.persona_id = ppr.persona_id LIMIT 1),
            ''
        ) ORDER BY cppj.created_at) as profile_persona_names
    FROM cohort_profile_personas_junction cppj
    JOIN profile_personas_resource ppr ON ppr.id = cppj.profile_personas_id
    JOIN profiles_resource pr ON pr.id = ppr.profile_id
    WHERE cppj.active = true
    GROUP BY cppj.cohort_id
),
-- Main cohort data
cohort_data AS (
    SELECT
        c.id as cohort_id,
        -- Name
        (SELECT cn.names_id FROM cohort_names_junction cn WHERE cn.cohort_id = c.id LIMIT 1) as names_id,
        (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.names_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as name,
        -- Description
        (SELECT cd.descriptions_id FROM cohort_descriptions_junction cd WHERE cd.cohort_id = c.id LIMIT 1) as descriptions_id,
        (SELECT d.description FROM cohort_descriptions_junction cd JOIN descriptions_resource d ON cd.descriptions_id = d.id WHERE cd.cohort_id = c.id LIMIT 1) as description,
        -- Flag
        NOT EXISTS (SELECT 1 FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flags_id = f.id WHERE cf.cohort_id = c.id AND f.type = 'cohort_active' AND f.value = TRUE) as is_inactive,
        -- Multi-select
        cdd.department_ids,
        cdd.department_names as departments,
        csd.simulation_ids,
        csd.simulation_names as simulations,
        cspd.position_ids as simulation_position_ids,
        cspd.position_values as simulation_positions,
        csad.availability_ids as simulation_availability_ids,
        csad.availability_values as simulation_availability,
        cpd.profile_ids,
        cpd.profile_names as profiles,
        cppd.profile_persona_ids,
        cppd.profile_persona_names as profile_personas,
        -- For filtering
        c.updated_at,
        (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.names_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as name_for_search,
        (SELECT d.description FROM cohort_descriptions_junction cd JOIN descriptions_resource d ON cd.descriptions_id = d.id WHERE cd.cohort_id = c.id LIMIT 1) as description_for_search
    FROM cohort_artifact c
    LEFT JOIN cohort_resource_bridge crb ON crb.cohort_id = c.id
    LEFT JOIN cohorts_resource cr_res ON cr_res.id = crb.resources_id
    LEFT JOIN cohort_departments_data cdd ON cdd.cohort_id = c.id
    LEFT JOIN cohort_simulations_data csd ON csd.cohort_id = c.id
    LEFT JOIN cohort_sim_positions_data cspd ON cspd.cohort_id = c.id
    LEFT JOIN cohort_sim_availability_data csad ON csad.cohort_id = c.id
    LEFT JOIN cohort_profiles_data cpd ON cpd.cohort_id = c.id
    LEFT JOIN cohort_profile_personas_data cppd ON cppd.cohort_id = c.id
    LEFT JOIN cohort_departments_junction cdj ON cdj.cohort_id = c.id AND cdj.active = true AND cdj.departments_id IN (SELECT department_id FROM user_departments)
    LEFT JOIN user_profile_resource upr ON true
    CROSS JOIN user_profile up
    WHERE (
        (up.role = 'instructional'::profile_type AND upr.resources_id IS NOT NULL AND cr_res.profile_ids IS NOT NULL AND upr.resources_id = ANY(cr_res.profile_ids))
        OR
        up.role != 'instructional'
    )
    GROUP BY c.id, c.updated_at,
        cdd.department_ids, cdd.department_names,
        csd.simulation_ids, csd.simulation_names,
        cspd.position_ids, cspd.position_values,
        csad.availability_ids, csad.availability_values,
        cpd.profile_ids, cpd.profile_names,
        cppd.profile_persona_ids, cppd.profile_persona_names,
        up.role, upr.resources_id, cr_res.profile_ids, crb.resources_id
    HAVING
        COUNT(cdj.cohort_id) > 0
        OR NOT EXISTS (SELECT 1 FROM cohort_departments_junction cd2 WHERE cd2.cohort_id = c.id AND cd2.active = true)
),
-- Apply filters
filtered_cohorts AS (
    SELECT cd.*
    FROM cohort_data cd
    WHERE
        (search IS NULL OR LOWER(cd.name_for_search) LIKE '%' || LOWER(search) || '%' OR LOWER(cd.description_for_search) LIKE '%' || LOWER(search) || '%')
        AND (filter_simulation_ids IS NULL OR cd.simulation_ids && filter_simulation_ids)
        AND (filter_profile_ids IS NULL OR cd.profile_ids && filter_profile_ids)
        AND (filter_department_ids IS NULL OR cd.department_ids::text[] && filter_department_ids::text[])
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (fc.cohort_id,
             fc.names_id, fc.name,
             fc.descriptions_id, fc.description,
             fc.is_inactive,
             fc.department_ids, fc.departments,
             fc.simulation_ids, fc.simulations,
             fc.simulation_position_ids, fc.simulation_positions,
             fc.simulation_availability_ids, fc.simulation_availability,
             fc.profile_ids, fc.profiles,
             fc.profile_persona_ids, fc.profile_personas
            )::types.q_export_cohorts_v4_row
            ORDER BY fc.updated_at DESC NULLS LAST
        ) FROM filtered_cohorts fc),
        '{}'::types.q_export_cohorts_v4_row[]
    ) as rows
FROM params
$$;
