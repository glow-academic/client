-- Mark simulation message as completed, optionally updating content
-- Parameters: $1=final_content (text, nullable), $2=message_id (uuid)
-- If final_content is NULL, only marks as completed. If provided, updates content and marks as completed.
UPDATE messages 
SET completed = true 
WHERE id = $2::uuid;

-- Update content in message_content if provided (or keep existing if NULL)
UPDATE message_content 
SET 
    content = COALESCE($1::text, content),
    updated_at = NOW()
WHERE message_id = $2::uuid AND idx = 0

