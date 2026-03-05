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
    parameter_department_ids text[],
    active_scenario_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        parameter_id AS parameter_id
),
parameter_dept AS (
    SELECT COALESCE(
        ARRAY_AGG(pd.departments_id::text) FILTER (WHERE pd.departments_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN parameter_departments_junction pd ON pd.parameter_id = x.parameter_id AND pd.active = true
),
-- Count active scenario links only - used for delete check
parameter_scenario_links AS (
    SELECT COALESCE(COUNT(DISTINCT spf.scenario_id), 0) as active_count
    FROM params x
    LEFT JOIN parameter_fields_resource pfr ON pfr.parameter_id = x.parameter_id AND pfr.active = true
    LEFT JOIN scenario_parameter_fields_junction spf ON spf.parameter_fields_id = pfr.id
    LEFT JOIN scenario_flags_junction sf ON sf.scenario_id = spf.scenario_id
    LEFT JOIN flags_resource f ON sf.flags_id = f.id AND f.type = 'scenario_active' AND f.value = true
    WHERE x.parameter_id IS NOT NULL AND f.id IS NOT NULL
)
SELECT
    (SELECT department_ids FROM parameter_dept) as parameter_department_ids,
    COALESCE((SELECT active_count FROM parameter_scenario_links), 0) as active_scenario_count
FROM params x
$$;

