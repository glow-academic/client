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
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
scenario_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM scenarios WHERE id = (SELECT scenario_id FROM params)
    )::boolean as scenario_exists
),
scenario_info AS (
    -- Check if scenario exists and get name
    SELECT 
        s.id,
        (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1),
        (SELECT COUNT(*) FROM simulation_scenarios WHERE scenario_id = s.id AND active = true) as usage_count
    FROM scenarios s
    WHERE s.id = (SELECT scenario_id FROM params)
),
delete_scenario AS (
    -- Delete scenario only if it exists and is not in use
    DELETE FROM scenarios
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