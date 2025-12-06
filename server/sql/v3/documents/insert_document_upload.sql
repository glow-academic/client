-- Insert document_uploads junction record
-- Parameters: $1=document_id (uuid), $2=upload_id (uuid), $3=active (boolean)
-- Links a document to a regular upload (not a template upload)
INSERT INTO document_uploads (document_id, upload_id, active, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, $3, NOW(), NOW())
ON CONFLICT (document_id, upload_id) DO UPDATE SET
    active = EXCLUDED.active,
    updated_at = NOW();

