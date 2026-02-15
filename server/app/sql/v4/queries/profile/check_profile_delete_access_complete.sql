-- Profile Delete Access Check
-- Returns user role and target profile state for Python to compute delete permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_profile_delete_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_profile_delete_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_profile_delete_access_v4(
    profile_id uuid,
    target_profile_id uuid
)
RETURNS TABLE (
    -- Target profile state for Python permission logic
    target_department_ids text[],
    target_is_self boolean,
    profile_name text,
    target_role text,
    active_cohort_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        target_profile_id AS target_profile_id
),
-- Get target profile departments
target_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(pd.department_id::text) FILTER (WHERE pd.department_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN profile_departments_junction pd ON pd.profile_id = x.target_profile_id AND pd.active = true
),
-- Get target profile name for response message
profile_name_data AS (
    SELECT n.name
    FROM params x
    JOIN profile_names_junction pn ON pn.profile_id = x.target_profile_id
    JOIN names_resource n ON n.id = pn.name_id
    LIMIT 1
),
-- Get target profile role
target_role_data AS (
    SELECT r.role::text as role
    FROM params x
    JOIN profile_roles_junction prj ON prj.profile_id = x.target_profile_id
    JOIN roles_resource r ON r.id = prj.role_id
    LIMIT 1
),
-- Count active cohort links
cohort_links AS (
    SELECT COUNT(cp.profile_id)::bigint as active_count
    FROM params x
    LEFT JOIN profile_cohorts_junction cp ON cp.profile_id = x.target_profile_id AND cp.active = true
)
SELECT
    (SELECT department_ids FROM target_departments_data) as target_department_ids,
    ((SELECT profile_id FROM params) = (SELECT target_profile_id FROM params)) as target_is_self,
    (SELECT name FROM profile_name_data) as profile_name,
    (SELECT role FROM target_role_data) as target_role,
    (SELECT active_count FROM cohort_links) as active_cohort_count
FROM params x
$$;

