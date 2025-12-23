-- Get message role and created_at timestamp
-- Parameters: $1=message_id (uuid)
-- Returns: role (message_role), created_at (timestamp)
SELECT role, created_at FROM messages WHERE id = $1::uuid

