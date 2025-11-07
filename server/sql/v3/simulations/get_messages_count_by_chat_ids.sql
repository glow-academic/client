-- Get message counts for multiple chats (batch query)
-- Parameters: $1=chat_ids (uuid[])
-- Returns: chat_id, message_count
SELECT chat_id, COUNT(*) as message_count
FROM simulation_messages
WHERE chat_id = ANY($1::uuid[])
GROUP BY chat_id

