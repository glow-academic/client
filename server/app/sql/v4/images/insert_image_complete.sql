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
    INSERT INTO calls (external_call_id, tool_id, run_id, template_id, arguments_raw, completed, created_at, updated_at)
    VALUES (concat('image:', uuidv7()::text), NULL, NULL, NULL, '', FALSE, NOW(), NOW())
    RETURNING id
),
insert_image AS (
    INSERT INTO images (name, active, completed, created_at, updated_at)
    SELECT api_insert_image_v4.name, TRUE, FALSE, NOW(), NOW()
    FROM tool_call
    RETURNING id
)
SELECT id FROM insert_image
$$;