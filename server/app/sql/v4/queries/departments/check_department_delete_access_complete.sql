-- Department Delete Access Check
-- Returns user role and department state for Python to compute delete permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_department_delete_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_department_delete_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_department_delete_access_v4(
    profile_id uuid,
    department_id uuid
)
RETURNS TABLE (
    -- Department state for Python permission logic
    total_usage bigint
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
-- Count total usage across all entity types
usage_summary AS (
    SELECT (
        (SELECT COUNT(*) FROM simulation_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true) +
        (SELECT COUNT(*) FROM scenario_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true) +
        (SELECT COUNT(*) FROM persona_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true) +
        (SELECT COUNT(*) FROM document_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true) +
        (SELECT COUNT(*) FROM cohort_departments_junction WHERE department_id = (SELECT department_id FROM params) AND active = true)
    )::bigint as total_usage
)
SELECT
    (SELECT total_usage FROM usage_summary) as total_usage
FROM params x
$$;

