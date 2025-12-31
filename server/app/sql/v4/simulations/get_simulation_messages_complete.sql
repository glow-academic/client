-- Get all messages for a chat using tree traversal
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_simulation_messages_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_simulation_messages_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_simulation_messages_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types for composite structures
CREATE TYPE types.q_get_simulation_messages_v4_message AS (
    id text,
    chat_id text,
    role text,
    content text,
    created_at timestamptz,
    completed boolean,
    updated_at timestamptz,
    audio text,
    upload_id text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION socket_get_simulation_messages_v4(
    chat_id uuid
)
RETURNS TABLE (
    messages types.q_get_simulation_messages_v4_message[]
)
LANGUAGE sql
STABLE
AS $$
WITH RECURSIVE message_path AS (
    -- Base case: Start from latest messages (no active children in message_tree)
    SELECT 
        m.id, 
        c.id AS chat_id, 
        m.role, 
        mc.content, 
        m.created_at, 
        m.completed, 
        m.updated_at,
        m.audio,
        0 as depth,
        m.id as path_root_id
    FROM chats c
    JOIN chat_groups cg ON cg.chat_id = c.id
    JOIN groups g ON g.id = cg.group_id
    JOIN group_runs gr ON gr.group_id = g.id
    JOIN runs r ON r.id = gr.run_id
    JOIN message_runs mr ON mr.run_id = r.id
    JOIN messages m ON m.id = mr.message_id
    LEFT JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
    WHERE c.id = $1::uuid
      AND NOT EXISTS (
          SELECT 1 FROM message_tree mt 
          WHERE mt.parent_id = m.id AND mt.active = true
      )
    
    UNION ALL
    
    -- Recursive case: Traverse up the tree following parent links
    SELECT 
        m.id, 
        c.id AS chat_id, 
        m.role, 
        mc.content, 
        m.created_at, 
        m.completed, 
        m.updated_at,
        m.audio,
        mp.depth + 1 as depth,
        mp.path_root_id
    FROM messages m
    LEFT JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
    JOIN message_tree mt ON mt.child_id = m.id AND mt.active = true
    JOIN message_path mp ON mp.id = mt.parent_id
    JOIN message_runs mr ON mr.message_id = m.id
    JOIN runs r ON r.id = mr.run_id
    JOIN group_runs gr ON gr.run_id = r.id
    JOIN groups g ON g.id = gr.group_id
    JOIN chat_groups cg ON cg.group_id = g.id
    JOIN chats c ON c.id = cg.chat_id
    
    -- Prevent infinite loops (safety limit)
    WHERE mp.depth < 1000
      AND c.id = $1::uuid
),
-- Include messages without parents (backward compatibility for existing messages)
messages_without_parents AS (
    SELECT 
        m.id, 
        c.id AS chat_id, 
        m.role, 
        mc.content, 
        m.created_at, 
        m.completed, 
        m.updated_at,
        m.audio,
        -1 as depth,  -- Negative depth to sort before tree messages
        m.id as path_root_id
    FROM chats c
    JOIN chat_groups cg ON cg.chat_id = c.id
    JOIN groups g ON g.id = cg.group_id
    JOIN group_runs gr ON gr.group_id = g.id
    JOIN runs r ON r.id = gr.run_id
    JOIN message_runs mr ON mr.run_id = r.id
    JOIN messages m ON m.id = mr.message_id
    LEFT JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
    WHERE c.id = $1::uuid
      AND NOT EXISTS (
          SELECT 1 FROM message_tree mt 
          WHERE mt.child_id = m.id AND mt.active = true
      )
      AND NOT EXISTS (
          SELECT 1 FROM message_path mp 
          WHERE mp.id = m.id
      )
),
-- Combine tree-traversed messages and messages without parents
all_messages AS (
    SELECT * FROM message_path
    UNION ALL
    SELECT * FROM messages_without_parents
),
-- Select distinct messages (in case of multiple paths), ordered by conversation flow
-- Order by depth first to maintain tree structure, then created_at for chronological order within same depth
-- The tree traversal ensures we get all messages in the active conversation path
distinct_messages AS (
    SELECT DISTINCT ON (am.id)
        am.id::text,
        am.chat_id::text,
        am.role,
        am.content,
        am.created_at,
        am.completed,
        am.updated_at,
        am.audio,
        ma.upload_id::text as upload_id
    FROM all_messages am
    LEFT JOIN message_audio ma ON ma.message_id = am.id
    ORDER BY am.id, am.depth DESC, am.created_at
)
SELECT 
    ARRAY_AGG(
        (dm.id, dm.chat_id, dm.role, dm.content, dm.created_at, dm.completed, dm.updated_at, dm.audio, dm.upload_id)::types.q_get_simulation_messages_v4_message
        ORDER BY dm.created_at
    ) as messages
FROM distinct_messages dm
$$;

COMMIT;
