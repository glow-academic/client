-- Create assistant message, link to run, and create branch from developer (or system if no developer)
-- Parameters: $1=content (text), $2=run_id (uuid), $3=parent_message_id (uuid - developer or system message)
-- Returns: message_id, created_at
-- Creates message, links to run, and creates message_tree branch
WITH assistant_message AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    VALUES ('assistant'::message_role, true, false, NOW(), NOW())
    RETURNING id, created_at, updated_at
),
insert_content AS (
    INSERT INTO message_content (message_id, idx, content, created_at, updated_at)
    SELECT id, 0, $1::text, created_at, updated_at
    FROM assistant_message
),
link_to_run AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT am.id, $2::uuid, NOW(), NOW()
    FROM assistant_message am
    ON CONFLICT (message_id, run_id) 
    DO UPDATE SET updated_at = NOW()
),
create_branch AS (
    INSERT INTO message_tree (parent_id, child_id, active, created_at, updated_at)
    SELECT $3::uuid, am.id, true, NOW(), NOW()
    FROM assistant_message am
    WHERE $3::uuid IS NOT NULL
    ON CONFLICT (parent_id, child_id) 
    DO UPDATE SET 
        active = true,
        updated_at = NOW()
)
SELECT id, created_at FROM assistant_message

