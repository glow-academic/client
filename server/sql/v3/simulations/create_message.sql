-- Create a message (without run_id - link via message_runs junction table)
-- Parameters: $1=role (message_role: 'user' or 'assistant'), $2=content (text), $3=completed (boolean), $4=created_at (timestamptz, optional)
-- Returns: id and created_at
-- If $4 is NULL, uses NOW()
WITH new_message AS (
    INSERT INTO messages (role, completed, created_at)
    VALUES ($1::message_role, $3::bool, COALESCE($4::timestamptz, NOW()))
    RETURNING id, created_at, updated_at
),
insert_content AS (
    INSERT INTO message_content (message_id, idx, content, created_at, updated_at)
    SELECT id, 0, $2::text, created_at, updated_at
    FROM new_message
)
SELECT id, created_at FROM new_message

