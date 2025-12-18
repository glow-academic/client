-- Get message counts for multiple chats (batch query)
-- Parameters: $1=chat_ids (uuid[])
-- Returns: chat_id, message_count
SELECT cm.chat_id, COUNT(*) as message_count
FROM messages m
JOIN chat_messages cm ON cm.message_id = m.id
WHERE cm.chat_id = ANY($1::uuid[])
GROUP BY cm.chat_id

