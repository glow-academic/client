SELECT COUNT(*) as usage_count
FROM simulation_attempts
WHERE simulation_id = $1

