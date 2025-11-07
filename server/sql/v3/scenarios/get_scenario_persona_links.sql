-- Get scenario's active persona links
-- Parameters: $1=scenario_id (uuid)
-- Returns: persona_ids (text array)
SELECT ARRAY_AGG(persona_id::text ORDER BY persona_id) as persona_ids
FROM scenario_personas
WHERE scenario_id = $1::uuid AND active = true

