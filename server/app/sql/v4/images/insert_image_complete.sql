-- Create image record with a tool call
-- Parameters: $1=name (text)
-- Returns: id (uuid)
WITH tool_call AS (
    INSERT INTO tool_calls (call_id, tool_id, completed, created_at, updated_at)
    VALUES (concat('image:', uuidv7()::text), NULL, FALSE, NOW(), NOW())
    RETURNING id
),
insert_image AS (
    INSERT INTO images (name, active, completed, tool_call_id, created_at, updated_at)
    SELECT $1::text, TRUE, FALSE, tool_call.id, NOW(), NOW()
    FROM tool_call
    RETURNING id
)
SELECT id FROM insert_image;
