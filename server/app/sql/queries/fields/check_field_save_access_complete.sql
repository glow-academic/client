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
    -- Field state for Python permission logic (NULL for create mode)
    field_department_ids text[]
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        field_id AS field_id
),
-- Get field departments (for update mode)
field_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(fd.departments_id::text) FILTER (WHERE fd.departments_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN field_departments_junction fd ON fd.field_id = x.field_id AND fd.active = true
    WHERE x.field_id IS NOT NULL
)
SELECT
    (SELECT department_ids FROM field_departments_data) as field_department_ids
FROM params x
$$;

