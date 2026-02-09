-- Provider delete access check
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
        WHERE proname = 'api_check_provider_delete_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_provider_delete_access_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_check_provider_delete_access_v4(
    profile_id uuid,
    provider_id uuid
)
RETURNS TABLE (
    user_role text,
    provider_department_ids uuid[],
    model_usage_count int,
    provider_name text
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
provider_departments AS (
    SELECT COALESCE(
        ARRAY_AGG(pd.department_id ORDER BY pd.created_at) FILTER (WHERE pd.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN provider_departments_junction pd ON pd.provider_id = x.provider_id AND pd.active = true
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
),
provider_name_data AS (
    SELECT n.name
    FROM params x
    JOIN provider_names_junction pn ON pn.provider_id = x.provider_id
    JOIN names_resource n ON n.id = pn.name_id
    LIMIT 1
)
SELECT
    up.role::text as user_role,
    COALESCE((SELECT department_ids FROM provider_departments), ARRAY[]::uuid[]) as provider_department_ids,
    (SELECT model_usage_count FROM model_usage) as model_usage_count,
    (SELECT name FROM provider_name_data) as provider_name
FROM params x
CROSS JOIN user_profile up;
$$;
