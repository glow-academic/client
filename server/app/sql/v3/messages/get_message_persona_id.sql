-- Get persona_id for a message
-- Parameters: $1=message_id (uuid)
-- Returns: persona_id (uuid)
SELECT persona_id FROM message_personas 
WHERE message_id = $1::uuid 
LIMIT 1

