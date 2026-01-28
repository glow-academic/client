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
    actor_name text,
    scenario_exists boolean,
    scenario_name text,
    usage_count bigint,
    user_role text,
    user_department_ids uuid[],
    scenario_department_ids uuid[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS p_profile_id, scenario_id AS p_scenario_id
),
user_profile AS (
    SELECT vp.actor_name, vp.role::text as user_role
    FROM view_user_profile_context vp
    WHERE vp.profile_id = (SELECT p_profile_id FROM params)
),
user_departments AS (
    SELECT ARRAY_AGG(pd.department_id) as department_ids
    FROM profile_departments_junction pd
    WHERE pd.profile_id = (SELECT p_profile_id FROM params)
      AND pd.active = true
),
scenario_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM scenario_artifact WHERE id = (SELECT p_scenario_id FROM params)
    )::boolean as scenario_exists
),
scenario_name_data AS (
    SELECT n.name as scenario_name
    FROM scenario_names_junction sn
    JOIN names_resource n ON sn.name_id = n.id
    WHERE sn.scenario_id = (SELECT p_scenario_id FROM params)
    LIMIT 1
),
scenario_departments AS (
    SELECT ARRAY_AGG(sd.department_id) as department_ids
    FROM scenario_departments_junction sd
    WHERE sd.scenario_id = (SELECT p_scenario_id FROM params)
      AND sd.active = true
),
usage_check AS (
    SELECT (
        SELECT COUNT(*)
        FROM simulation_scenarios_junction ss
        WHERE ss.scenario_id = (SELECT p_scenario_id FROM params)
          AND EXISTS (
              SELECT 1
              FROM simulation_scenario_flags_junction ssf
              JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id
              JOIN flags_resource f ON sfr.flag_id = f.id
              WHERE ssf.simulation_id = ss.simulation_id
                AND sfr.scenario_id = ss.scenario_id
                AND f.name = 'scenario_active'
                AND ssf.value = true
          )
    ) + (
        SELECT COUNT(*) FROM simulation_chats_scenarios_connection gcsc
        JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = gcsc.scenarios_id
        WHERE ssj.scenario_id = (SELECT p_scenario_id FROM params)
    ) + (
        SELECT COUNT(*) FROM simulation_chats_scenarios_connection pcsc
        JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = pcsc.scenarios_id
        WHERE ssj.scenario_id = (SELECT p_scenario_id FROM params)
    ) + (
        SELECT COUNT(*)
        FROM scenario_tree_junction st
        WHERE (st.parent_id = (SELECT p_scenario_id FROM params)
            OR st.child_id = (SELECT p_scenario_id FROM params))
          AND st.parent_id != st.child_id
    ) as usage_count
)
SELECT
    up.actor_name::text,
    (SELECT scenario_exists FROM scenario_exists_check),
    snd.scenario_name::text,
    (SELECT usage_count FROM usage_check) as usage_count,
    up.user_role::text,
    ud.department_ids as user_department_ids,
    sd.department_ids as scenario_department_ids
FROM user_profile up
CROSS JOIN user_departments ud
CROSS JOIN scenario_departments sd
CROSS JOIN scenario_name_data snd;
$$;
