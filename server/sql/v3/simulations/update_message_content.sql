-- Update simulation message content during streaming
-- Parameters: $1=content (text), $2=message_id (uuid)
UPDATE simulation_messages 
SET content = $1::text 
WHERE id = $2::uuid

