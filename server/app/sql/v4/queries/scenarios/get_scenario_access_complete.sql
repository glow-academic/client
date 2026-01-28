-- Access check for scenario get (lightweight)
-- Returns user context + scenario access context only

-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_scenario_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_access_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_scenario_access_v4(
    profile_id uuid,
    scenario_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    actor_name text,
    user_role text,
    user_department_ids uuid[],
    scenario_department_ids uuid[],
    scenario_exists boolean
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id, scenario_id, draft_id
),
user_profile AS (
    SELECT actor_name, role
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM profile_departments_junction pd
    WHERE pd.profile_id = (SELECT profile_id FROM params)
      AND pd.active = true
),
scenario_departments AS (
    SELECT DISTINCT sd.department_id
    FROM scenario_departments_junction sd
    WHERE sd.scenario_id = (SELECT scenario_id FROM params)
      AND sd.active = true
)
SELECT
    up.actor_name,
    up.role::text as user_role,
    COALESCE(ARRAY_AGG(DISTINCT ud.department_id), ARRAY[]::uuid[]) as user_department_ids,
    CASE
        WHEN (SELECT scenario_id FROM params) IS NULL THEN ARRAY[]::uuid[]
        ELSE COALESCE(ARRAY_AGG(DISTINCT sd.department_id), ARRAY[]::uuid[])
    END as scenario_department_ids,
    CASE
        WHEN (SELECT scenario_id FROM params) IS NULL THEN NULL::boolean
        ELSE EXISTS(
            SELECT 1 FROM scenario_artifact sa WHERE sa.id = (SELECT scenario_id FROM params)
        )::boolean
    END as scenario_exists
FROM user_profile up
LEFT JOIN user_departments ud ON TRUE
LEFT JOIN scenario_departments sd ON TRUE
GROUP BY up.actor_name, up.role;
$$;
