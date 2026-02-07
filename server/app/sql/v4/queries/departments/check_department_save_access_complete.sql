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
    -- User context for Python permission logic
    user_role text,
    user_department_ids uuid[],
    -- Department state for Python permission logic
    department_usage_count bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        department_id AS department_id
),
-- Get user profile info
user_profile AS (
    SELECT role
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Get user's departments
user_departments AS (
    SELECT COALESCE(
        ARRAY_AGG(DISTINCT pd.department_id) FILTER (WHERE pd.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
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
    up.role::text as user_role,
    ud.department_ids as user_department_ids,
    (SELECT usage_count FROM department_usage) as department_usage_count
FROM params x
CROSS JOIN user_profile up
CROSS JOIN user_departments ud;
$$;
