-- Get top N objectives for scenario ordered by idx
-- Parameters: $1=scenario_id (uuid), $2=limit (integer)
-- Returns: idx, objective
SELECT so.idx, o.objective
FROM scenario_objectives so
JOIN objectives o ON o.id = so.objective_id
WHERE so.scenario_id = $1::uuid
ORDER BY so.idx ASC
LIMIT $2::int

