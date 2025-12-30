-- Finalize voice simulation messages and runs
-- Parameters:
--   $1=chat_id (uuid)
--   $2=run_id (uuid)
-- Returns: success (boolean), final_content (text)
--
-- This function:
-- 1. Finalizes all incomplete assistant messages for the run
-- 2. Marks run as complete
-- 3. Returns success status
WITH params AS (
    SELECT $1::uuid as chat_id, $2::uuid as run_id
),
-- Finalize all incomplete assistant messages for this run
finalize_messages AS (
    UPDATE messages
    SET completed = true,
        updated_at = NOW()
    FROM params p
    JOIN message_runs mr ON mr.message_id = messages.id
    WHERE mr.run_id = p.run_id
      AND messages.role = 'assistant'
      AND messages.completed = false
    RETURNING messages.id as message_id, messages.id
),
-- Mark run as complete
complete_run AS (
    UPDATE runs
    SET completed = true,
        updated_at = NOW()
    FROM params p
    WHERE runs.id = p.run_id
      AND runs.completed = false
    RETURNING id as run_id
)
SELECT 
    (SELECT EXISTS(SELECT 1 FROM complete_run)) as success,
    (SELECT COUNT(*)::text FROM finalize_messages) as messages_finalized

