-- Link a document to a video
-- Parameters: $1 = video_id (uuid), $2 = document_id (uuid), $3 = active (boolean)
-- Creates or updates video_documents junction table entry

INSERT INTO video_documents (video_id, document_id, active, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, $3::boolean, NOW(), NOW())
ON CONFLICT (video_id, document_id) DO UPDATE SET
    active = EXCLUDED.active,
    updated_at = NOW()
RETURNING document_id;
