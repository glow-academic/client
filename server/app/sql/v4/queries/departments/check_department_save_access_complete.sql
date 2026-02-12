-- Department Save Access Check
-- Returns user role and department state for Python to compute save permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_department_save_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_department_save_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_department_save_access_v4(
    profile_id uuid,
    department_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Department state for Python permission logic
    department_usage_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        department_id AS department_id
),
-- Get department usage count (for update mode)
department_usage AS (
    SELECT
        CASE
            WHEN (SELECT department_id FROM params) IS NULL THEN 0::bigint
            ELSE (
                (SELECT COUNT(*) FROM profile_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true) +
                (SELECT COUNT(*) FROM simulation_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true) +
                (SELECT COUNT(*) FROM scenario_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true) +
                (SELECT COUNT(*) FROM persona_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true) +
                (SELECT COUNT(*) FROM document_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true) +
                (SELECT COUNT(*) FROM cohort_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true)
            )::bigint
        END as usage_count
)
SELECT
    (SELECT usage_count FROM department_usage) as department_usage_count
FROM params x
$$;

