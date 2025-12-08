-- Insert image_uploads junction table record
-- Parameters: $1=image_id, $2=upload_id
-- Returns: image_id, upload_id
INSERT INTO image_uploads (image_id, upload_id, active, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, true, NOW(), NOW())
ON CONFLICT (image_id, upload_id) DO UPDATE SET
    active = true,
    updated_at = NOW()
RETURNING image_id::text, upload_id::text;

