-- Update simulation message content during streaming
-- Parameters: $1=content (text), $2=message_id (uuid)
-- Updates primary content (idx=0) in message_content table
UPDATE message_content 
SET content = $1::text, updated_at = NOW()
WHERE message_id = $2::uuid AND idx = 0

