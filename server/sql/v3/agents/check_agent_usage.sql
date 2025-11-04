SELECT COUNT(*) as usage_count
FROM agent_departments
WHERE agent_id = $1::uuid AND active = true

