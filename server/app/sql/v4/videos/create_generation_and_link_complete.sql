-- Create generation record, link to video and run
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_generation_and_link_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_generation_and_link_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_create_generation_and_link_v4(
    video_id uuid,
    file_path text,
    mime_type text,
    upload_id uuid,
    active boolean,
    run_id uuid
)
RETURNS TABLE (
    generation_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        api_create_generation_and_link_v4.video_id as video_id,
        api_create_generation_and_link_v4.file_path as file_path,
        api_create_generation_and_link_v4.mime_type as mime_type,
        api_create_generation_and_link_v4.upload_id as upload_id,
        api_create_generation_and_link_v4.active as active,
        api_create_generation_and_link_v4.run_id as run_id
),
insert_upload AS (
    INSERT INTO uploads_entry (file_path, mime_type, size, created_at, updated_at)
    SELECT file_path, mime_type, 0, NOW(), NOW()
    FROM params
    WHERE upload_id IS NULL
    RETURNING id as new_upload_id
),
final_upload_id AS (
    SELECT COALESCE((SELECT upload_id FROM params), (SELECT new_upload_id FROM insert_upload LIMIT 1)) as upload_id
),
mark_video AS (
    UPDATE videos_resource
    SET completed = TRUE,
        upload_id = (SELECT upload_id FROM final_upload_id),
        updated_at = NOW()
    WHERE id = (SELECT video_id FROM params)
)
SELECT fi.upload_id as generation_id
FROM final_upload_id fi
$$;