-- Complete image generation by creating upload and linking to image
-- Parameters: $1=image_id (uuid), $2=file_path (text), $3=mime_type (text), $4=file_size (bigint)
-- Returns: upload_id (uuid)
WITH upload_row AS (
    INSERT INTO uploads (file_path, mime_type, size, created_at, updated_at)
    VALUES ($2::text, $3::text, $4::bigint, NOW(), NOW())
    RETURNING id
),
link_upload AS (
    INSERT INTO image_uploads (image_id, upload_id, active, created_at, updated_at)
    SELECT $1::uuid, upload_row.id, TRUE, NOW(), NOW()
    FROM upload_row
    ON CONFLICT (image_id, upload_id)
    DO UPDATE SET active = EXCLUDED.active, updated_at = NOW()
),
update_image AS (
    UPDATE images
    SET completed = TRUE,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id
)
SELECT upload_row.id AS upload_id
FROM upload_row;
