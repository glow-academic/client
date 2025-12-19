-- Get message counts for multiple chats (batch query)
-- Parameters: $1=chat_ids (uuid[])
-- Returns: chat_id, message_count
SELECT c.id AS chat_id, COUNT(*) as message_count
FROM chats c
JOIN groups g ON g.id = c.group_id
JOIN group_runs gr ON gr.group_id = g.id
JOIN runs r ON r.id = gr.run_id
JOIN message_runs mr ON mr.run_id = r.id
JOIN messages m ON m.id = mr.message_id
WHERE c.id = ANY($1::uuid[])
GROUP BY c.id

