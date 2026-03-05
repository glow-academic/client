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
    -- Rubric state for Python permission logic (NULL for create mode)
    rubric_department_ids text[],
    active_simulation_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        rubric_id AS rubric_id
),
-- Get rubric departments (for update mode)
rubric_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(rd.departments_id::text) FILTER (WHERE rd.departments_id IS NOT NULL),
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
         JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubrics_id AND srr.scenario_id = ss.scenario_id
         WHERE srr.rubric_id = (SELECT rubric_id FROM params)
           AND EXISTS (
               SELECT 1 FROM simulation_scenario_flags_junction ssf
               JOIN scenario_flags_resource sfr ON ssf.scenario_flags_id = sfr.id
               JOIN flags_resource f ON sfr.flag_id = f.id
               WHERE ssf.simulation_id = ss.simulation_id
                 AND sfr.scenario_id = ss.scenario_id
                 AND f.type = 'scenario_active'
                 AND f.value = true
           )
        ),
        0
    )::bigint as count
)
SELECT
    (SELECT department_ids FROM rubric_departments_data) as rubric_department_ids,
    (SELECT count FROM rubric_active_simulations) as active_simulation_count
FROM params x
$$;

