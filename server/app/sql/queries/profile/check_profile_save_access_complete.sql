-- Profile Save Access Check
-- Returns user role, user departments, and target profile state for Python to compute save permissions
-- For update mode: returns user_role, user_department_ids, target_department_ids, target_is_self
-- For create mode: returns user_role, user_department_ids (target fields NULL/empty)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_profile_save_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_profile_save_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_profile_save_access_v4(
    profile_id uuid,
    input_profile_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Target profile state for Python permission logic (NULL/empty for create mode)
    target_department_ids text[],
    target_is_self boolean
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        input_profile_id AS input_profile_id
),
-- Get target profile departments (for update mode)
target_departments AS (
    SELECT COALESCE(
        ARRAY_AGG(pd.departments_id::text) FILTER (WHERE pd.departments_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN profile_departments_junction pd ON pd.profile_id = x.input_profile_id AND pd.active = true
    WHERE x.input_profile_id IS NOT NULL
)
SELECT
    COALESCE((SELECT department_ids FROM target_departments), ARRAY[]::text[]) as target_department_ids,
    ((SELECT profile_id FROM params) = (SELECT input_profile_id FROM params)) as target_is_self
FROM params x
$$;

