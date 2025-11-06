-- Delete simulation with existence and usage checks in a single transaction
-- Parameters: $1=simulationId
-- Returns: simulation_id, title, and usage_count (or no rows if simulation doesn't exist)
-- If usage_count > 0, simulation is not deleted (caller should raise 400 error)
-- If no rows returned, simulation doesn't exist (caller should raise 404 error)
WITH simulation_info AS (
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
    CASE WHEN ds.simulation_id IS NOT NULL THEN true ELSE false END as deleted
FROM simulation_info si
LEFT JOIN delete_simulation ds ON ds.simulation_id = si.id::text

