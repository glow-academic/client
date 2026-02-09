-- Provider save access check
-- Returns user role and provider context for Python permission logic
-- Parameters: (profile_id, provider_id)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_provider_save_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_provider_save_access_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_check_provider_save_access_v4(
    profile_id uuid,
    provider_id uuid DEFAULT NULL
)
RETURNS TABLE (
    user_role text,
    user_department_ids uuid[],
    provider_department_ids uuid[],
    model_usage_count int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        provider_id AS provider_id
),
user_profile AS (
    SELECT role
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
user_departments AS (
    SELECT COALESCE(
        ARRAY_AGG(DISTINCT pd.department_id) FILTER (WHERE pd.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
provider_departments AS (
    SELECT COALESCE(
        ARRAY_AGG(pd.department_id ORDER BY pd.created_at) FILTER (WHERE pd.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN provider_departments_junction pd ON pd.provider_id = x.provider_id AND pd.active = true
    WHERE x.provider_id IS NOT NULL
),
model_usage AS (
    SELECT COALESCE(
        (
            SELECT COUNT(DISTINCT pmj.model_id)::int
            FROM provider_models_junction pmj
            WHERE pmj.provider_id = (SELECT provider_id FROM params)
        ),
        0
    ) as model_usage_count
)
SELECT
    up.role::text as user_role,
    ud.department_ids as user_department_ids,
    COALESCE((SELECT department_ids FROM provider_departments), ARRAY[]::uuid[]) as provider_department_ids,
    (SELECT model_usage_count FROM model_usage) as model_usage_count
FROM params x
CROSS JOIN user_profile up
CROSS JOIN user_departments ud;
$$;
