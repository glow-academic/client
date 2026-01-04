-- Create cohort with departments, profiles, and simulations in single query (DHH style)
-- Converted to function
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_cohort_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_cohort_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_cohort_v4(
    title text,
    description text,
    active boolean,
    department_ids text[],
    profile_ids text[],
    simulation_ids text[],
    profile_id uuid
)
RETURNS TABLE (
    cohort_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        title AS title,
        COALESCE(NULLIF(description, ''), '') AS description,
        active AS active,
        COALESCE(department_ids, ARRAY[]::text[]) AS department_ids,
        COALESCE(profile_ids, ARRAY[]::text[]) AS profile_ids,
        COALESCE(simulation_ids, ARRAY[]::text[]) AS simulation_ids,
        profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        x.profile_id AS resolved_profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
new_cohort AS (
    -- Create cohort
    INSERT INTO cohorts (
        title,
        description,
        active
    )
    SELECT x.title, x.description, x.active
    FROM params x
    RETURNING id
),
link_departments AS (
    -- Link departments if provided (array may be empty)
    INSERT INTO cohort_departments (cohort_id, department_id, active, created_at, updated_at)
    SELECT 
        nc.id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_cohort nc
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.department_ids) as dept_id
    WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
    ON CONFLICT (cohort_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_profiles AS (
    -- Link profiles if provided (array may be empty)
    INSERT INTO cohort_profiles (cohort_id, profile_id, active)
    SELECT 
        nc.id,
        pid::uuid,
        true
    FROM new_cohort nc
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.profile_ids) as pid
    WHERE COALESCE(array_length(x.profile_ids, 1), 0) > 0
    ON CONFLICT (cohort_id, profile_id) DO UPDATE SET
        active = true
),
simulations_with_order AS (
    -- Prepare simulations with position based on array order
    SELECT 
        simulation_id::uuid,
        ROW_NUMBER() OVER () as position
    FROM params x
    CROSS JOIN UNNEST(x.simulation_ids) as simulation_id
    WHERE COALESCE(array_length(x.simulation_ids, 1), 0) > 0
),
link_simulations AS (
    -- Link simulations with position if provided (array may be empty)
    INSERT INTO cohort_simulations (cohort_id, simulation_id, active, position)
    SELECT 
        nc.id,
        swo.simulation_id,
        true,
        swo.position
    FROM new_cohort nc
    CROSS JOIN simulations_with_order swo
)
-- Return cohort ID and actor name
SELECT 
    nc.id as cohort_id,
    ap.actor_name
FROM new_cohort nc
CROSS JOIN actor_profile ap
$$;