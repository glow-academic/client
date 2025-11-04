SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id) as persona_ids
FROM scenario_personas 
WHERE scenario_id = $1 AND active = true

