-- Get message counts for multiple chats (batch query)
-- Parameters: $1=chat_ids (uuid[])
-- Returns: chat_id, message_count
SELECT rc.chat_id, COUNT(*) as message_count
FROM messages m
JOIN message_runs mr ON mr.message_id = m.id
JOIN chat_runs rc ON rc.run_id = mr.run_id
WHERE rc.chat_id = ANY($1::uuid[])
GROUP BY rc.chat_id

