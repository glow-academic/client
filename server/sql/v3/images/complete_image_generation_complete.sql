-- Complete image generation: create upload, link to image, and mark image as completed
-- Parameters: $1=image_id (uuid), $2=file_path (text), $3=mime_type (text), $4=file_size (bigint)
-- Returns: upload_id (text)
-- Creates upload record, links via image_uploads junction table, and marks image as completed
WITH create_upload AS (
    -- Create upload record
    INSERT INTO uploads (file_path, mime_type, size, created_at, updated_at)
    VALUES ($2, $3, $4, NOW(), NOW())
    RETURNING id
),
link_image_upload AS (
    -- Link upload to image via junction table
    INSERT INTO image_uploads (image_id, upload_id, active, created_at, updated_at)
    SELECT $1::uuid, cu.id, true, NOW(), NOW()
    FROM create_upload cu
    ON CONFLICT (image_id, upload_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
    RETURNING upload_id
),
update_image AS (
    -- Mark image as completed
    UPDATE images
    SET completed = true,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id
)
SELECT cu.id::text as upload_id
FROM create_upload cu
CROSS JOIN link_image_upload liu
CROSS JOIN update_image ui

