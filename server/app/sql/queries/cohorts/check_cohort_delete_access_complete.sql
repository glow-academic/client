-- Cohort Delete Access Check
-- Returns cohort state for Python to compute delete permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_cohort_delete_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_cohort_delete_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_cohort_delete_access_v4(
    profile_id uuid,
    cohort_id uuid
)
RETURNS TABLE (
    -- Cohort state for Python permission logic
    cohort_exists boolean,
    cohort_department_ids text[],
    usage_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_auth_profile_internal() in Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        cohort_id AS cohort_id
),
-- Check if cohort exists
cohort_check AS (
    SELECT EXISTS(
        SELECT 1 FROM cohort_artifact c WHERE c.id = (SELECT cohort_id FROM params)
    ) as cohort_exists
),
-- Get cohort departments
cohort_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(cd.departments_id::text) FILTER (WHERE cd.departments_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN cohort_departments_junction cd ON cd.cohort_id = x.cohort_id
),
-- Count profile links (usage)
-- NOTE: Must use COUNT(column) not COUNT(*) with LEFT JOIN, as COUNT(*)
-- counts the NULL row when there are no matches
profile_links AS (
    SELECT COUNT(cpj.profile_id)::bigint as total_links
    FROM params x
    LEFT JOIN cohort_profiles_junction cpj ON cpj.cohort_id = x.cohort_id AND cpj.active = true
)
SELECT
    (SELECT cohort_exists FROM cohort_check) as cohort_exists,
    (SELECT department_ids FROM cohort_departments_data) as cohort_department_ids,
    (SELECT total_links FROM profile_links) as usage_count
FROM params x
$$;
