-- Field Save Access Check
-- Returns user role, user departments, and field state for Python to compute save permissions
-- For update mode: returns user_role, user_department_ids, field_department_ids
-- For create mode: returns user_role, user_department_ids (field fields NULL)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_field_save_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_field_save_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_field_save_access_v4(
    profile_id uuid,
    field_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- User context for Python permission logic
    user_role text,
    user_department_ids text[],
    -- Field state for Python permission logic (NULL for create mode)
    field_department_ids text[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        field_id AS field_id
),
-- Get user profile info
user_profile AS (
    SELECT role
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Get user's departments
user_departments AS (
    SELECT COALESCE(ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at), ARRAY[]::text[]) as department_ids
    FROM params x
    LEFT JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Get field departments (for update mode)
field_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(fd.department_id::text) FILTER (WHERE fd.department_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN field_departments_junction fd ON fd.field_id = x.field_id AND fd.active = true
    WHERE x.field_id IS NOT NULL
)
SELECT
    up.role::text as user_role,
    ud.department_ids as user_department_ids,
    (SELECT department_ids FROM field_departments_data) as field_department_ids
FROM params x
CROSS JOIN user_profile up
CROSS JOIN user_departments ud;
$$;
