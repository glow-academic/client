-- Parameter Save Access Check
-- Returns user role, user departments, and parameter state
-- for Python to compute save permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_parameter_save_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_parameter_save_access_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_check_parameter_save_access_v4(
    profile_id uuid,
    parameter_id uuid DEFAULT NULL
)
RETURNS TABLE (
    user_role text,
    user_department_ids text[],
    parameter_department_ids text[],
    active_scenario_count bigint
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
user_dept AS (
    SELECT COALESCE(
        ARRAY_AGG(pd.department_id::text) FILTER (WHERE pd.department_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
parameter_dept AS (
    SELECT
        CASE
            WHEN (SELECT parameter_id FROM params) IS NULL THEN NULL::text[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(pd.department_id::text)
                 FROM parameter_departments_junction pd
                 WHERE pd.parameter_id = (SELECT parameter_id FROM params) AND pd.active = true),
                ARRAY[]::text[]
            )
        END as department_ids
),
parameter_scenario_count AS (
    SELECT COALESCE(COUNT(DISTINCT spf.scenario_id), 0) as active_scenario_count
    FROM params x
    LEFT JOIN parameter_fields_resource pfr ON pfr.parameter_id = x.parameter_id AND pfr.active = true
    LEFT JOIN scenario_parameter_fields_junction spf ON spf.parameter_field_id = pfr.id AND spf.active = true
    WHERE x.parameter_id IS NOT NULL
)
SELECT
    up.role::text as user_role,
    ud.department_ids as user_department_ids,
    (SELECT department_ids FROM parameter_dept) as parameter_department_ids,
    COALESCE((SELECT active_scenario_count FROM parameter_scenario_count), 0) as active_scenario_count
FROM params x
CROSS JOIN user_profile up
CROSS JOIN user_dept ud;
$$;
