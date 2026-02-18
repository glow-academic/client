-- Complete image generation by creating upload, images_entry, and linking to images_resource
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Creates images_entry + images_images_connection (entry ↔ resource bridge)

-- 1) Drop function first
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

-- 2) Recreate function (creates images_entry + images_images_connection)
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
insert_image_entry AS (
    INSERT INTO images_entry (upload_id, active, generated, mcp)
    SELECT upload_row.id, true, true, false
    FROM upload_row
    RETURNING id AS image_entry_id, upload_id AS entry_upload_id
),
link_image AS (
    INSERT INTO images_images_connection (image_id, images_id)
    SELECT iie.image_entry_id, socket_complete_image_generation_v4.image_id
    FROM insert_image_entry iie
    RETURNING image_id
)
SELECT upload_row.id AS upload_id
FROM upload_row
$$;
