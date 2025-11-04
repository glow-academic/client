SELECT COUNT(*) as usage_count
FROM simulation_scenarios
WHERE scenario_id = $1 AND active = true

