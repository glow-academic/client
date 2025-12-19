-- Get messages with audio upload information for a chat
-- Parameters: $1=chat_id (uuid), $2=message_ids[] (uuid array)
-- Returns: message_id, upload_id, file_path, mime_type, size
SELECT 
    m.id::text as message_id,
    ma.upload_id::text as upload_id,
    u.file_path,
    u.mime_type,
    u.size
FROM messages m
JOIN message_audio ma ON ma.message_id = m.id
JOIN uploads u ON u.id = ma.upload_id
JOIN message_runs mr ON mr.message_id = m.id
JOIN runs r ON r.id = mr.run_id
JOIN group_runs gr ON gr.group_id = r.id
JOIN groups g ON g.id = gr.group_id
JOIN chats c ON c.group_id = g.id
WHERE c.id = $1::uuid
  AND m.id = ANY($2::uuid[])

