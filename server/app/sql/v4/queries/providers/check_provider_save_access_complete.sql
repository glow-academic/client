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
    provider_department_ids uuid[],
    model_usage_count int
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        provider_id AS provider_id
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
            SELECT COUNT(DISTINCT mr.id)::int
            FROM provider_providers_junction ppj
            JOIN models_resource mr ON mr.provider_id = ppj.providers_id AND mr.active = true
            WHERE ppj.provider_id = (SELECT provider_id FROM params)
        ),
        0
    ) as model_usage_count
)
SELECT
    COALESCE((SELECT department_ids FROM provider_departments), ARRAY[]::uuid[]) as provider_department_ids,
    (SELECT model_usage_count FROM model_usage) as model_usage_count
FROM params x
$$;

