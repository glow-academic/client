-- Delete scenario with existence and usage checks in a single transaction
-- Parameters: $1=scenarioId, $2=profile_id (uuid, required)
-- Returns: scenario_id, name, usage_count, deleted (boolean), actor_name
-- profile_id is always a UUID (required in request body)
actor_profile AS (
    SELECT 
        $2::uuid as resolved_profile_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
scenario_info AS (
    -- Check if scenario exists and get name
    SELECT 
        s.id,
        s.name,
        (SELECT COUNT(*) FROM simulation_scenarios WHERE scenario_id = s.id AND active = true) as usage_count
    FROM scenarios s
    WHERE s.id = $1::uuid
),
delete_scenario AS (
    -- Delete scenario only if it exists and is not in use
    DELETE FROM scenarios
    WHERE id IN (
        SELECT id FROM scenario_info WHERE usage_count = 0
    )
    RETURNING id::text as scenario_id, name
)
-- Return scenario info (even if not deleted, so caller can determine error)
SELECT 
    si.id::text as scenario_id,
    si.name,
    si.usage_count,
    CASE WHEN ds.scenario_id IS NOT NULL THEN true ELSE false END as deleted,
    ap.actor_name
FROM scenario_info si
LEFT JOIN delete_scenario ds ON ds.scenario_id = si.id::text
CROSS JOIN actor_profile ap

