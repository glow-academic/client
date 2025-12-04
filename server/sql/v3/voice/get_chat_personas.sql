-- Get all personas for a chat's scenario
-- Parameters: $1=chat_id (uuid)
-- Returns: persona_id, persona_name for all active personas linked to the scenario
SELECT 
    p.id::text as persona_id,
    p.name as persona_name
FROM chats c
JOIN scenario_personas sp ON sp.scenario_id = c.scenario_id AND sp.active = true
JOIN personas p ON p.id = sp.persona_id
WHERE c.id = $1::uuid
  AND p.active = true
ORDER BY p.name

