-- Update message created_at timestamp (for ordering)
-- Parameters: $1=created_at (timestamp), $2=message_id (uuid)
UPDATE messages
SET created_at = $1::timestamp + INTERVAL '1 millisecond'
WHERE id = $2::uuid

