-- Get all messages for a chat using tree traversal
-- Parameters: $1=chat_id (uuid)
-- Returns: id, chat_id, role, content, created_at, completed, updated_at
-- Traverses backwards from latest messages (no active children) up the tree to root
-- Handles backward compatibility: messages without parents are included and ordered by created_at
WITH RECURSIVE message_path AS (
    -- Base case: Start from latest messages (no active children in message_tree)
    SELECT 
        m.id, 
        rc.chat_id, 
        m.role, 
        m.content, 
        m.created_at, 
        m.completed, 
        m.updated_at,
        0 as depth,
        m.id as path_root_id
    FROM messages m
    JOIN chat_runs rc ON rc.run_id = m.run_id
    WHERE rc.chat_id = $1::uuid
      AND NOT EXISTS (
          SELECT 1 FROM message_tree mt 
          WHERE mt.parent_id = m.id AND mt.active = true
      )
    
    UNION ALL
    
    -- Recursive case: Traverse up the tree following parent links
    SELECT 
        m.id, 
        rc.chat_id, 
        m.role, 
        m.content, 
        m.created_at, 
        m.completed, 
        m.updated_at,
        mp.depth + 1 as depth,
        mp.path_root_id
    FROM messages m
    JOIN message_tree mt ON mt.child_id = m.id AND mt.active = true
    JOIN message_path mp ON mp.id = mt.parent_id
    JOIN chat_runs rc ON rc.run_id = m.run_id
    
    -- Prevent infinite loops (safety limit)
    WHERE mp.depth < 1000
),
-- Include messages without parents (backward compatibility for existing messages)
messages_without_parents AS (
    SELECT 
        m.id, 
        rc.chat_id, 
        m.role, 
        m.content, 
        m.created_at, 
        m.completed, 
        m.updated_at,
        -1 as depth,  -- Negative depth to sort before tree messages
        m.id as path_root_id
    FROM messages m
    JOIN chat_runs rc ON rc.run_id = m.run_id
    WHERE rc.chat_id = $1::uuid
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
)
-- Select distinct messages (in case of multiple paths), ordered by conversation flow
-- Order by created_at to maintain chronological order
-- The tree traversal ensures we get all messages in the active conversation path
SELECT DISTINCT ON (id)
    id::text,
    chat_id::text,
    role,
    content,
    created_at,
    completed,
    updated_at
FROM all_messages
ORDER BY id, created_at

