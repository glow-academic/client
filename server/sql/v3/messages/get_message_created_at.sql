-- Get message created_at timestamp
-- Parameters: $1=message_id (uuid)
-- Returns: created_at (timestamp)
SELECT created_at FROM messages WHERE id = $1::uuid

