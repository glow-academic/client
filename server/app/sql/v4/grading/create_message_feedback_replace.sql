-- Insert message feedback replace items
-- Parameters: $1=message_feedback_id (uuid), $2=replaces (jsonb array with objects containing: section, replace)
-- Creates multiple replace records using jsonb_array_elements
INSERT INTO message_feedback_replace 
(message_feedback_id, idx, section, replace, created_at)
SELECT 
    $1::uuid,
    (row_number() OVER ()) - 1 as idx,
    (replace_item->>'section')::text,
    (replace_item->>'replace')::text,
    NOW()
FROM jsonb_array_elements($2::jsonb) as replace_item

