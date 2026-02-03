-- Check if chat_id is general (simple query, not function)
-- $1 = chat_id
SELECT EXISTS (
    SELECT 1
    FROM view_simulation_chats_entry c
    JOIN view_simulation_attempts_entry a ON a.id = c.attempt_id
    WHERE c.id = $1
      AND a.practice IS FALSE
) as is_general;
