-- Mark assistant message as completed and update content
-- Parameters: $1=content (text), $2=completed (boolean), $3=message_id (uuid)
UPDATE assistant_messages 
SET content = $1::text, completed = $2::bool 
WHERE id = $3::uuid

