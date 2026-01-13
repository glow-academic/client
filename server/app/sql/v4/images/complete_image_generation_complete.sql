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
    INSERT INTO uploads (file_path, mime_type, size, created_at, updated_at)
    VALUES (file_path, mime_type, file_size, NOW(), NOW())
    RETURNING id
),
link_upload AS (
    INSERT INTO image_uploads (image_id, upload_id, active, created_at, updated_at)
    SELECT image_id, upload_row.id, TRUE, NOW(), NOW()
    FROM upload_row
    ON CONFLICT (image_id, upload_id)
    DO UPDATE SET active = EXCLUDED.active, updated_at = NOW()
),
update_image AS (
    UPDATE images_resource
    SET completed = TRUE,
        updated_at = NOW()
    WHERE id = image_id
    RETURNING id
)
SELECT upload_row.id AS upload_id
FROM upload_row
$$;