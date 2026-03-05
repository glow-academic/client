-- Check scenario delete access - Returns context for Python permission checks

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_scenario_delete_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_scenario_delete_access_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_check_scenario_delete_access_v4(
    profile_id uuid,
    scenario_id uuid
)
RETURNS TABLE (
    scenario_exists boolean,
    scenario_name text,
    usage_count bigint,
    scenario_department_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS p_profile_id, scenario_id AS p_scenario_id
),
-- User context: actor_name comes from get_profile_context_internal() in Python
user_profile AS (
    SELECT COALESCE(r.role, 'member'::profile_type) as role,
           ''::text as actor_name
    FROM profile_roles_junction prj
    JOIN roles_resource r ON prj.role_id = r.id
    WHERE prj.profile_id = (SELECT profile_id FROM params)
    LIMIT 1
),
scenario_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM scenario_artifact WHERE id = (SELECT p_scenario_id FROM params)
    )::boolean as scenario_exists
),
scenario_name_data AS (
    SELECT n.name as scenario_name
    FROM scenario_names_junction sn
    JOIN names_resource n ON sn.names_id = n.id
    WHERE sn.scenario_id = (SELECT p_scenario_id FROM params)
    LIMIT 1
),
scenario_departments AS (
    SELECT ARRAY_AGG(sd.departments_id) as department_ids
    FROM scenario_departments_junction sd
    WHERE sd.scenario_id = (SELECT p_scenario_id FROM params)
      AND sd.active = true
),
-- Get the scenarios_resource.id for this scenario_artifact
scenario_resource AS (
    SELECT ssj.scenario_id
    FROM scenario_scenarios_junction ssj
    WHERE ssj.scenario_id = (SELECT p_scenario_id FROM params)
    LIMIT 1
),
usage_check AS (
    SELECT (
        -- Active simulation links via denormalized simulations_resource.scenario_ids + per-simulation flag check
        SELECT COUNT(*)
        FROM simulations_resource sim_r
        JOIN simulation_simulations_junction ssj_bridge ON ssj_bridge.simulation_id = sim_r.id
        WHERE (SELECT scenarios_id FROM scenario_resource) = ANY(sim_r.scenario_ids)
          AND EXISTS (
              SELECT 1
              FROM simulation_scenario_flags_junction ssf
              JOIN scenario_flags_resource sfr ON ssf.scenario_flags_id = sfr.id
              JOIN flags_resource f ON sfr.flag_id = f.id
              WHERE ssf.simulation_id = ssj_bridge.simulation_id
                AND sfr.scenario_id = (SELECT scenarios_id FROM scenario_resource)
                AND f.type = 'scenario_active'
                AND f.value = true
          )
    ) + (
        SELECT COUNT(*) FROM attempt_chat_mv msc
        WHERE msc.scenario_id = (SELECT scenarios_id FROM scenario_resource)
    ) as usage_count
)
SELECT
    (SELECT scenario_exists FROM scenario_exists_check),
    snd.scenario_name::text,
    (SELECT usage_count FROM usage_check) as usage_count,
    sd.department_ids as scenario_department_ids
FROM user_profile up
CROSS JOIN scenario_departments sd
CROSS JOIN scenario_name_data snd;
$$;

