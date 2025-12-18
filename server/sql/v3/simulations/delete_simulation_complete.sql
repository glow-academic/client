-- Delete simulation with existence and usage checks in a single transaction
-- Parameters: $1=simulationId, $2=profile_id (uuid)
-- Returns: simulation_id, title, usage_count, deleted, actor_name (or no rows if simulation doesn't exist)
-- If usage_count > 0, simulation is not deleted (caller should raise 400 error)
-- If no rows returned, simulation doesn't exist (caller should raise 404 error)
WITH actor_profile AS (
    SELECT 
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
simulation_info AS (
    -- Check if simulation exists and get usage count
    SELECT 
        s.id,
        s.title,
        (SELECT COUNT(*) FROM cohort_simulations WHERE simulation_id = s.id) as usage_count
    FROM simulations s
    WHERE s.id = $1::uuid
),
delete_simulation AS (
    -- Delete simulation only if it exists and is not in use
    DELETE FROM simulations
    WHERE id IN (
        SELECT id FROM simulation_info WHERE usage_count = 0
    )
    RETURNING id::text as simulation_id
)
-- Return simulation info and usage count (even if not deleted, so caller can determine error)
SELECT 
    si.id::text as simulation_id,
    si.title,
    si.usage_count,
    CASE WHEN ds.simulation_id IS NOT NULL THEN true ELSE false END as deleted,
    ap.actor_name
FROM simulation_info si
LEFT JOIN delete_simulation ds ON ds.simulation_id = si.id::text
CROSS JOIN actor_profile ap

