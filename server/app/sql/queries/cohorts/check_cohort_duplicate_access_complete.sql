-- Check cohort duplicate access - Returns context for Python permission checks

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_cohort_duplicate_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_cohort_duplicate_access_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_check_cohort_duplicate_access_v4(
    profile_id uuid,
    cohort_id uuid
)
RETURNS TABLE (
    cohort_exists boolean,
    original_name text,
    cohort_department_ids text[]
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_auth_profile_internal() in Python
WITH params AS (
    SELECT
        profile_id AS p_profile_id,
        cohort_id AS p_cohort_id
),
-- Check if cohort exists
cohort_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM cohort_artifact WHERE id = (SELECT p_cohort_id FROM params)
    )::boolean as cohort_exists
),
-- Get cohort name
cohort_name_data AS (
    SELECT n.name as original_name
    FROM cohort_names_junction cn
    JOIN names_resource n ON cn.names_id = n.id
    WHERE cn.cohort_id = (SELECT p_cohort_id FROM params)
    LIMIT 1
),
-- Get cohort departments
cohort_departments AS (
    SELECT COALESCE(
        ARRAY_AGG(cd.department_id::text) FILTER (WHERE cd.department_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN cohort_departments_junction cd ON cd.cohort_id = x.p_cohort_id
)
SELECT
    (SELECT cohort_exists FROM cohort_exists_check),
    cnd.original_name::text,
    cd.department_ids as cohort_department_ids
FROM cohort_departments cd
CROSS JOIN cohort_name_data cnd;
$$;
