-- Parameter Delete Access Check
-- Returns user role and parameter state for Python to compute delete permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_parameter_delete_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_parameter_delete_access_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_check_parameter_delete_access_v4(
    profile_id uuid,
    parameter_id uuid
)
RETURNS TABLE (
    user_role text,
    parameter_department_ids text[],
    total_scenario_links bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        parameter_id AS parameter_id
),
user_profile AS (
    SELECT role
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
parameter_dept AS (
    SELECT COALESCE(
        ARRAY_AGG(pd.department_id::text) FILTER (WHERE pd.department_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN parameter_departments_junction pd ON pd.parameter_id = x.parameter_id AND pd.active = true
),
-- Count ALL scenario links (active or not) - used for delete check
parameter_scenario_links AS (
    SELECT COALESCE(COUNT(DISTINCT spf.scenario_id), 0) as total_scenario_links
    FROM params x
    LEFT JOIN parameter_fields_resource pfr ON pfr.parameter_id = x.parameter_id AND pfr.active = true
    LEFT JOIN scenario_parameter_fields_junction spf ON spf.parameter_field_id = pfr.id
    WHERE x.parameter_id IS NOT NULL
)
SELECT
    up.role::text as user_role,
    (SELECT department_ids FROM parameter_dept) as parameter_department_ids,
    COALESCE((SELECT total_scenario_links FROM parameter_scenario_links), 0) as total_scenario_links
FROM params x
CROSS JOIN user_profile up;
$$;
