-- Update chat created_at timestamp with existence check in a single transaction
-- Parameters: $1=createdAt (timestamp), $2=chatId
-- Returns: chat_id if updated, or no rows if chat doesn't exist
-- Anti-cheat:
--   1. Only allows reset when no user messages exist yet
--   2. Only allows reset ONCE by checking created_at still matches the original
--      (attempt_chats.created_at is set in the same transaction and never changes)
WITH chat_exists AS (
    SELECT sc.id, sc.created_at
    FROM simulation_chats sc
    WHERE sc.id = $2::uuid
),
update_chat AS (
    UPDATE simulation_chats sc
    SET created_at = $1
    FROM chat_exists ce
    WHERE sc.id = ce.id
      AND NOT EXISTS (
          SELECT 1 FROM simulation_messages sm
          WHERE sm.chat_id = $2::uuid AND sm.type = 'query'
      )
      AND EXISTS (
          SELECT 1 FROM attempt_chats ac
          WHERE ac.chat_id = $2::uuid
            AND ABS(EXTRACT(EPOCH FROM (ce.created_at - ac.created_at))) < 2
      )
    RETURNING sc.id::text as chat_id
)
SELECT chat_id FROM update_chat

