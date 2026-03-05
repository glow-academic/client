-- Access check for cohort get (lightweight)
-- Returns user context + cohort access context only
-- Group ID creation moved to Python (this query is now STABLE)

-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_cohort_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_cohort_access_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_cohort_access_v4(
    profile_id uuid,
    cohort_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    draft_group_id uuid DEFAULT NULL,
    draft_version int DEFAULT NULL
)
RETURNS TABLE (
    cohort_exists boolean,
    effective_draft_version int,
    group_id uuid,


    -- Cohort state for Python permission logic
    cohort_department_ids uuid[],
    usage_count int
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT profile_id, cohort_id, draft_id
),
-- Check if cohort exists
cohort_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT cohort_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM cohort_artifact WHERE id = (SELECT cohort_id FROM params))::boolean
        END as cohort_exists
),
-- Get cohort departments (for access check)
cohort_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(cd.departments_id ORDER BY cd.created_at) FILTER (WHERE cd.departments_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN cohort_departments_junction cd ON cd.cohort_id = x.cohort_id AND cd.active = true
    WHERE x.cohort_id IS NOT NULL
),
-- Get usage count (profile_cohort links for disabled_reason)
usage_count_data AS (
    SELECT COUNT(DISTINCT cpj.profile_id)::int as usage_count
    FROM params x
    LEFT JOIN cohort_profiles_junction cpj ON cpj.cohort_id = x.cohort_id AND cpj.active = true
    WHERE x.cohort_id IS NOT NULL
)
SELECT
    -- Basic metadata
    (SELECT cohort_exists FROM cohort_exists_check) as cohort_exists,
    draft_version as effective_draft_version,
    draft_group_id as group_id,

    -- Cohort state for Python permission logic
    COALESCE((SELECT department_ids FROM cohort_departments_data), ARRAY[]::uuid[]) as cohort_department_ids,
    COALESCE((SELECT usage_count FROM usage_count_data), 0) as usage_count
FROM params x;
$$;
