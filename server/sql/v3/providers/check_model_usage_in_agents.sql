SELECT COUNT(*) as usage_count
FROM agents
WHERE model_id = $1

