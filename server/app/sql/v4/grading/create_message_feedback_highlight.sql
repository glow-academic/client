-- Insert message feedback highlight items
-- Parameters: $1=message_feedback_id (uuid), $2=highlights (jsonb array with objects containing: section)
-- Creates multiple highlight records using jsonb_array_elements
INSERT INTO message_feedback_highlight 
(message_feedback_id, idx, section, created_at)
SELECT 
    $1::uuid,
    (row_number() OVER ()) - 1 as idx,
    (highlight_item->>'section')::text,
    NOW()
FROM jsonb_array_elements($2::jsonb) as highlight_item

