-- Get persona_id for a message from message_personas junction table
-- Parameters: $1=message_id (uuid)
-- Returns: persona_id (uuid) or NULL if no persona linked
SELECT persona_id::text as persona_id
FROM message_personas
WHERE message_id = $1::uuid
LIMIT 1

