-- Complete image generation by creating upload and linking to image
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_complete_image_generation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_complete_image_generation_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_complete_image_generation_v4(
    image_id uuid,
    file_path text,
    mime_type text,
    file_size bigint
)
RETURNS TABLE (
    upload_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH upload_row AS (
    INSERT INTO uploads_entry (file_path, mime_type, size, created_at, updated_at)
    VALUES (file_path, mime_type, file_size, NOW(), NOW())
    RETURNING id
),
update_image AS (
    UPDATE images_resource
    SET completed = TRUE
    WHERE id = image_id
    RETURNING id
),
link_image_upload AS (
    INSERT INTO images_uploads_connection (images_id, upload_id, active, created_at, updated_at)
    SELECT image_id, upload_row.id, true, NOW(), NOW()
    FROM upload_row
    ON CONFLICT (images_id, upload_id) DO UPDATE SET active = true, updated_at = NOW()
    RETURNING images_id
)
SELECT upload_row.id AS upload_id
FROM upload_row
$$;