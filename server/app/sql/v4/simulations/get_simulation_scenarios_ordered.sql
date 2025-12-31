-- Get simulation's scenarios with position ordering
-- Parameters: $1=simulation_id (uuid)
-- Returns: scenario_id, position
SELECT scenario_id, position 
FROM simulation_scenarios 
WHERE simulation_id = $1::uuid
ORDER BY position

