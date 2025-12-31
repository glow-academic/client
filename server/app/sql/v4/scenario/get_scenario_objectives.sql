-- Get objectives for a scenario
-- Parameters: $1=scenario_id (uuid)
-- Returns: objective_id, idx
SELECT 
    so.objective_id,
    so.idx
FROM scenario_objectives so
WHERE so.scenario_id = $1::uuid
ORDER BY so.idx;

