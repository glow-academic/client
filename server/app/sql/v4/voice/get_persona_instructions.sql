-- Get persona instructions only (not full system prompts) for personas in a chat
-- Parameters: $1=chat_id (uuid)
-- Returns: persona_id, persona_name, instructions for each persona
SELECT 
    p.id::text as persona_id,
    p.name as persona_name,
    COALESCE(p.instructions, '') as instructions
FROM chats c
JOIN scenario_personas sp ON sp.scenario_id = c.scenario_id AND sp.active = true
JOIN personas p ON p.id = sp.persona_id
WHERE c.id = $1::uuid
  AND p.active = true
ORDER BY p.name

