-- Get top N objectives for scenario ordered by idx
-- Parameters: $1=scenario_id (uuid), $2=limit (integer)
-- Returns: idx, objective
SELECT idx, objective
FROM scenario_objectives
WHERE scenario_id = $1::uuid
ORDER BY idx ASC
LIMIT $2::int

