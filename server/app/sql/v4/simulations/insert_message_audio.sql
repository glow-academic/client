-- Insert message_audio link
-- Parameters: $1=message_id, $2=upload_id
INSERT INTO message_audio (message_id, upload_id, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, NOW(), NOW());

