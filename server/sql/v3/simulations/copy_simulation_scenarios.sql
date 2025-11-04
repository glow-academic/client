INSERT INTO simulation_scenarios (simulation_id, scenario_id, active, position)
SELECT $1, scenario_id, active, position
FROM simulation_scenarios
WHERE simulation_id = $2

