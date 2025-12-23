-- Link a message to a persona via message_personas junction table
-- Parameters: $1=message_id (uuid), $2=persona_id (uuid)
-- Returns: message_id, persona_id, created_at, updated_at
-- Note: If link already exists, it will be updated
INSERT INTO message_personas (message_id, persona_id, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, NOW(), NOW())
ON CONFLICT (message_id, persona_id) 
DO UPDATE SET 
    updated_at = NOW()
RETURNING message_id, persona_id, created_at, updated_at

