-- Mark simulation message as completed
-- Parameters: $1=message_id (uuid)
UPDATE messages 
SET completed = true 
WHERE id = $1::uuid

