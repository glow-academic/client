-- Update chat's scenario_id
-- Parameters: $1=chat_id (uuid), $2=scenario_id (uuid)
UPDATE chats
SET scenario_id = $2::uuid, updated_at = NOW()
WHERE id = $1::uuid

