-- Create a message (without run_id - link via message_runs junction table)
-- Parameters: $1=role (message_role: 'user' or 'assistant'), $2=content (text), $3=completed (boolean)
-- Returns: id and created_at
INSERT INTO messages (role, content, completed, created_at)
VALUES ($1::message_role, $2::text, $3::bool, NOW())
RETURNING id, created_at

