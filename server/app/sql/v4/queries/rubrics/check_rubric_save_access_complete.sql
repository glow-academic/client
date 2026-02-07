-- Rubric Save Access Check
-- Returns user role, user departments, and rubric state for Python to compute save permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_rubric_save_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_rubric_save_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_rubric_save_access_v4(
    profile_id uuid,
    rubric_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- User context for Python permission logic
    user_role text,
    user_department_ids text[],
    -- Rubric state for Python permission logic (NULL for create mode)
    rubric_department_ids text[],
    active_simulation_count bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        rubric_id AS rubric_id
),
-- Get user profile info
user_profile AS (
    SELECT role
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Get user's departments
user_departments AS (
    SELECT COALESCE(ARRAY_AGG(rd.department_id::text ORDER BY rd.created_at), ARRAY[]::text[]) as department_ids
    FROM params x
    LEFT JOIN profile_departments_junction rd ON rd.profile_id = x.profile_id AND rd.active = true
),
-- Get rubric departments (for update mode)
rubric_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(rd.department_id::text) FILTER (WHERE rd.department_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN rubric_departments_junction rd ON rd.rubric_id = x.rubric_id AND rd.active = true
    WHERE x.rubric_id IS NOT NULL
),
-- Count active simulation links
rubric_active_simulations AS (
    SELECT COALESCE(
        (SELECT COUNT(DISTINCT ss.simulation_id)
         FROM simulation_scenarios_junction ss
         JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
         JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
         WHERE srr.rubric_id = (SELECT rubric_id FROM params)
           AND EXISTS (
               SELECT 1 FROM simulation_scenario_flags_junction ssf
               JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id
               JOIN flags_resource f ON sfr.flag_id = f.id
               WHERE ssf.simulation_id = ss.simulation_id
                 AND sfr.scenario_id = ss.scenario_id
                 AND f.name = 'scenario_active'
                 AND ssf.value = true
           )
        ),
        0
    )::bigint as count
)
SELECT
    up.role::text as user_role,
    ud.department_ids as user_department_ids,
    (SELECT department_ids FROM rubric_departments_data) as rubric_department_ids,
    (SELECT count FROM rubric_active_simulations) as active_simulation_count
FROM params x
CROSS JOIN user_profile up
CROSS JOIN user_departments ud;
$$;
