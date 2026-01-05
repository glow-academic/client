DROP FUNCTION IF EXISTS api_insert_image_v4(text);
CREATE OR REPLACE FUNCTION api_insert_image_v4(
    name text
)
RETURNS TABLE (
    id uuid
)
LANGUAGE sql
AS $$
WITH tool_call AS (
    INSERT INTO calls (call_id, tool_id, completed, created_at, updated_at)
    VALUES (concat('image:', uuidv7()::text), NULL, FALSE, NOW(), NOW())
    RETURNING id
),
insert_image AS (
    INSERT INTO images (name, active, completed, tool_call_id, created_at, updated_at)
    SELECT api_insert_image_v4.name, TRUE, FALSE, tool_call.id, NOW(), NOW()
    FROM tool_call
    RETURNING id
)
SELECT id FROM insert_image
$$;