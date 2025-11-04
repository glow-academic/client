INSERT INTO scenario_objectives (scenario_id, idx, objective)
SELECT $1, idx, objective
FROM scenario_objectives
WHERE scenario_id = $2

