-- Check simulation delete access - Returns context for Python permission checks
-- Used before delete operation to validate permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_simulation_delete_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_simulation_delete_access_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_check_simulation_delete_access_v4(
    profile_id uuid,
    simulation_id uuid
)
RETURNS TABLE (
    simulation_exists boolean,
    simulation_name text,
    simulation_department_ids uuid[],
    cohort_usage_count int,
    user_role text,
    user_department_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS p_profile_id,
        simulation_id AS p_simulation_id
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
-- Check if simulation exists
simulation_exists_check AS (
    SELECT EXISTS(SELECT 1 FROM simulation_artifact WHERE id = (SELECT p_simulation_id FROM params))::boolean as simulation_exists
),
-- Get simulation name
simulation_name_data AS (
    SELECT n.name as simulation_name
    FROM simulation_names_junction sn
    JOIN names_resource n ON sn.names_id = n.id
    WHERE sn.simulation_id = (SELECT p_simulation_id FROM params)
    LIMIT 1
),
-- Get simulation's department IDs
simulation_departments AS (
    SELECT ARRAY_AGG(sd.department_id) as department_ids
    FROM simulation_departments_junction sd
    WHERE sd.simulation_id = (SELECT p_simulation_id FROM params)
      AND sd.active = true
),
-- Get cohort usage count for the simulation
cohort_usage AS (
    SELECT COUNT(DISTINCT cs.cohort_id)::int as usage_count
    FROM cohort_simulations_junction cs
    WHERE cs.simulation_id = (SELECT p_simulation_id FROM params)
      AND cs.active = true
),
-- Get user's department IDs
user_departments AS (
    SELECT COALESCE(ARRAY_AGG(pd.department_id), ARRAY[]::uuid[]) as department_ids
    FROM profile_departments_junction pd
    WHERE pd.profile_id = (SELECT p_profile_id FROM params)
      AND pd.active = true
)
SELECT
    (SELECT simulation_exists FROM simulation_exists_check),
    snd.simulation_name::text,
    sd.department_ids as simulation_department_ids,
    COALESCE(cu.usage_count, 0)::int as cohort_usage_count,
    up.role::text as user_role,
    ud.department_ids as user_department_ids
FROM user_profile up
CROSS JOIN simulation_departments sd
CROSS JOIN cohort_usage cu
CROSS JOIN simulation_name_data snd
CROSS JOIN user_departments ud;
$$;

