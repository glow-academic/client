-- Create basic video record with tool call
-- Parameters: $1=name (text), $2=length_seconds (integer)
-- Returns: id (uuid)
WITH tool_call AS (
    INSERT INTO tool_calls (call_id, tool_id, completed, created_at, updated_at)
    VALUES (concat('video:', uuidv7()::text), NULL, FALSE, NOW(), NOW())
    RETURNING id
),
insert_video AS (
    INSERT INTO videos (
        name,
        length_seconds,
        active,
        image_enabled,
        completed,
        tool_call_id,
        created_at,
        updated_at
    )
    SELECT $1::text, $2::integer, TRUE, TRUE, FALSE, tool_call.id, NOW(), NOW()
    FROM tool_call
    RETURNING id
)
SELECT id FROM insert_video;
