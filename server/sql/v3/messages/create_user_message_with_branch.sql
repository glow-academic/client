-- Create user message, link to run, and create branch from parent message
-- Parameters: $1=content (text), $2=run_id (uuid), $3=parent_message_id (uuid - latest message from previous run)
-- Returns: message_id, created_at
-- Creates message, links to run, and creates message_tree branch
WITH user_message AS (
    INSERT INTO messages (role, content, completed, audio, created_at, updated_at)
    VALUES ('user'::message_role, $1::text, true, false, NOW(), NOW())
    RETURNING id, created_at
),
link_to_run AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT um.id, $2::uuid, NOW(), NOW()
    FROM user_message um
    ON CONFLICT (message_id, run_id) 
    DO UPDATE SET updated_at = NOW()
),
create_branch AS (
    INSERT INTO message_tree (parent_id, child_id, active, created_at, updated_at)
    SELECT $3::uuid, um.id, true, NOW(), NOW()
    FROM user_message um
    WHERE $3::uuid IS NOT NULL
    ON CONFLICT (parent_id, child_id) 
    DO UPDATE SET 
        active = true,
        updated_at = NOW()
)
SELECT id, created_at FROM user_message

