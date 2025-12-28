-- Create user message and link to run, create branch from latest message
-- Parameters: $1=chat_id (uuid), $2=message_content (text), $3=run_id (uuid)
-- Returns: message_id (uuid), created_at (timestamptz), parent_message_id (uuid, nullable)
-- Creates message, links to run, and creates branch from latest message if exists
WITH new_message AS (
    INSERT INTO messages (role, completed, created_at)
    VALUES ('user'::message_role, true, NOW())
    RETURNING id, created_at, updated_at
),
insert_content AS (
    INSERT INTO message_content (message_id, idx, content, created_at, updated_at)
    SELECT id, 0, $2::text, created_at, updated_at
    FROM new_message
),
link_to_run AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT nm.id, $3::uuid, nm.created_at, nm.updated_at
    FROM new_message nm
    ON CONFLICT (message_id, run_id) DO UPDATE SET updated_at = NOW()
),
latest_message AS (
    SELECT m.id as parent_id
    FROM chats c
    JOIN chat_groups cg ON cg.chat_id = c.id
    JOIN groups g ON g.id = cg.group_id
    JOIN group_runs gr ON gr.group_id = g.id
    JOIN runs r ON r.id = gr.run_id
    JOIN message_runs mr ON mr.run_id = r.id
    JOIN messages m ON m.id = mr.message_id
    WHERE m.role IN ('user', 'assistant', 'system', 'developer')
      AND c.id = $1::uuid
    ORDER BY m.created_at DESC
    LIMIT 1
),
create_branch AS (
    INSERT INTO message_tree (parent_id, child_id, active, created_at, updated_at)
    SELECT 
        lm.parent_id,
        nm.id as child_id,
        true,
        nm.created_at,
        nm.updated_at
    FROM new_message nm
    CROSS JOIN latest_message lm
    WHERE lm.parent_id IS NOT NULL
    AND lm.parent_id != nm.id  -- Prevent self-references
    ON CONFLICT (parent_id, child_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    nm.id as message_id,
    nm.created_at,
    lm.parent_id
FROM new_message nm
LEFT JOIN latest_message lm ON true
