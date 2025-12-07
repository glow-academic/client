-- Create a message (without run_id - link via message_runs junction table)
-- Parameters: $1=role (message_role: 'user' or 'assistant'), $2=content (text), $3=completed (boolean), $4=created_at (timestamptz, optional)
-- Returns: id and created_at
-- If $4 is NULL, uses NOW()
INSERT INTO messages (role, content, completed, created_at)
VALUES ($1::message_role, $2::text, $3::bool, COALESCE($4::timestamptz, NOW()))
RETURNING id, created_at

