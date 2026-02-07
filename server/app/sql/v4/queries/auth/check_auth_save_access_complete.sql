-- Auth Save Access Check
-- Returns user role for Python to compute save permissions
-- Auth is simpler than persona: no department-based access, just role-based

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_auth_save_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_auth_save_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_auth_save_access_v4(
    profile_id uuid,
    auth_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- User context for Python permission logic
    user_role text,
    user_department_ids uuid[],
    auth_exists boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        auth_id AS auth_id
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
-- Check if auth exists (for update mode)
auth_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT auth_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM auths_resource WHERE id = (SELECT auth_id FROM params))::boolean
        END as auth_exists
)
SELECT
    up.role::text as user_role,
    ud.department_ids as user_department_ids,
    (SELECT auth_exists FROM auth_exists_check) as auth_exists
FROM params x
CROSS JOIN user_profile up
CROSS JOIN user_departments ud;
$$;
