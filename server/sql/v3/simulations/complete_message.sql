-- Mark simulation message as completed, optionally updating content
-- Parameters: $1=final_content (text, nullable), $2=message_id (uuid)
-- If final_content is NULL, only marks as completed. If provided, updates content and marks as completed.
UPDATE messages 
SET 
    content = COALESCE($1::text, content),
    completed = true 
WHERE id = $2::uuid

