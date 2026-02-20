-- Delete scenario with existence and usage checks
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_delete_scenario_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_scenario_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- If any other object depends on them, this will ERROR and stop the migration (good)
-- No composite types needed for this simple endpoint

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_delete_scenario_v4(
    scenario_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    scenario_exists boolean,
    scenario_id uuid,
    name text,
    usage_count bigint,
    deleted boolean,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT scenario_id AS scenario_id, profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        p.id as resolved_profile_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
scenario_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM scenario_artifact WHERE id = (SELECT scenario_id FROM params)
    )::boolean as scenario_exists
),
usage_check AS (
    SELECT (
        SELECT COUNT(*)
        FROM simulation_scenarios_junction ss
        WHERE ss.scenario_id = x.scenario_id
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
        -- Count chats using this scenario via scenario_scenarios_junction
        SELECT COUNT(*) FROM chat_resolved_mv msc
        JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = msc.scenario_id
        WHERE ssj.scenario_id = x.scenario_id
    ) as usage_count
    FROM params x
),
scenario_info AS (
    -- Check if scenario exists and get name
    SELECT 
        s.id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1),
        uc.usage_count
    FROM params x
    JOIN scenario_artifact s ON s.id = x.scenario_id
    CROSS JOIN usage_check uc
),
delete_scenario AS (
    -- Delete scenario only if it exists and is not in use
    DELETE FROM scenario_artifact
    WHERE id IN (
        SELECT id FROM scenario_info WHERE usage_count = 0
    )
    RETURNING id
)
-- Return scenario info (even if not deleted, so caller can determine error)
SELECT 
    sec.scenario_exists::boolean as scenario_exists,
    si.id as scenario_id,
    si.name::text as name,
    si.usage_count::bigint as usage_count,
    CASE WHEN ds.id IS NOT NULL THEN true ELSE false END as deleted,
    ap.actor_name::text as actor_name
FROM scenario_exists_check sec
LEFT JOIN scenario_info si ON sec.scenario_exists = true
LEFT JOIN delete_scenario ds ON ds.id = si.id
CROSS JOIN actor_profile ap
$$;
