-- Update message content with final content
-- Parameters: $1=final_content (text), $2=message_id (uuid)
UPDATE message_content 
SET 
    content = $1::text,
    updated_at = NOW()
WHERE message_id = $2::uuid AND idx = 0

