SELECT COUNT(*)::integer as usage_count
FROM scenario_personas
WHERE persona_id = $1 AND active = true

