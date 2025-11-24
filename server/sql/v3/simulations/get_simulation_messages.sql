-- Get all messages for a simulation chat using tree traversal
-- Parameters: $1=chat_id (uuid)
-- Returns: id, chat_id, type, content, created_at, completed, updated_at
-- Traverses backwards from latest messages (no active children) up the tree to root
-- Handles backward compatibility: messages without parents are included and ordered by created_at
WITH RECURSIVE message_path AS (
    -- Base case: Start from latest messages (no active children in message_tree)
    SELECT 
        id, 
        chat_id, 
        type, 
        content, 
        created_at, 
        completed, 
        updated_at,
        0 as depth,
        id as path_root_id
    FROM simulation_messages
    WHERE chat_id = $1::uuid
      AND NOT EXISTS (
          SELECT 1 FROM message_tree mt 
          WHERE mt.parent_id = simulation_messages.id AND mt.active = true
      )
    
    UNION ALL
    
    -- Recursive case: Traverse up the tree following parent links
    SELECT 
        sm.id, 
        sm.chat_id, 
        sm.type, 
        sm.content, 
        sm.created_at, 
        sm.completed, 
        sm.updated_at,
        mp.depth + 1 as depth,
        mp.path_root_id
    FROM simulation_messages sm
    JOIN message_tree mt ON mt.child_id = sm.id AND mt.active = true
    JOIN message_path mp ON mp.id = mt.parent_id
    
    -- Prevent infinite loops (safety limit)
    WHERE mp.depth < 1000
),
-- Include messages without parents (backward compatibility for existing messages)
messages_without_parents AS (
    SELECT 
        id, 
        chat_id, 
        type, 
        content, 
        created_at, 
        completed, 
        updated_at,
        -1 as depth,  -- Negative depth to sort before tree messages
        id as path_root_id
    FROM simulation_messages
    WHERE chat_id = $1::uuid
      AND NOT EXISTS (
          SELECT 1 FROM message_tree mt 
          WHERE mt.child_id = simulation_messages.id AND mt.active = true
      )
      AND NOT EXISTS (
          SELECT 1 FROM message_path mp 
          WHERE mp.id = simulation_messages.id
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
    type,
    content,
    created_at,
    completed,
    updated_at
FROM all_messages
ORDER BY id, created_at

