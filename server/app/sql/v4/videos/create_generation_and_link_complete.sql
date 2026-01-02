-- Create generation record, link to video and run
-- Converted to PostgreSQL function

BEGIN;

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
        video_id as video_id,
        file_path as file_path,
        mime_type as mime_type,
        upload_id as upload_id,
        active as active,
        run_id as run_id
),
deactivate_existing AS (
    UPDATE video_generations
    SET active = FALSE,
        updated_at = NOW()
    WHERE video_id = (SELECT video_id FROM params)
),
insert_generation AS (
    INSERT INTO generations (file_path, mime_type, upload_id, active, created_at, updated_at)
    SELECT file_path, mime_type, upload_id, active, NOW(), NOW()
    FROM params
    RETURNING id
),
link_video AS (
    INSERT INTO video_generations (video_id, generation_id, active, created_at, updated_at)
    SELECT p.video_id, g.id, p.active, NOW(), NOW()
    FROM params p
    CROSS JOIN insert_generation g
    ON CONFLICT (video_id, generation_id)
    DO UPDATE SET active = EXCLUDED.active, updated_at = NOW()
),
link_upload AS (
    INSERT INTO video_uploads (video_id, upload_id, active, created_at, updated_at)
    SELECT p.video_id, p.upload_id, p.active, NOW(), NOW()
    FROM params p
    ON CONFLICT (video_id, upload_id)
    DO UPDATE SET active = EXCLUDED.active, updated_at = NOW()
),
link_run AS (
    INSERT INTO generation_runs (generation_id, run_id, created_at, updated_at)
    SELECT g.id, p.run_id, NOW(), NOW()
    FROM params p
    CROSS JOIN insert_generation g
    ON CONFLICT (generation_id, run_id) DO NOTHING
),
mark_video AS (
    UPDATE videos
    SET completed = TRUE,
        updated_at = NOW()
    WHERE id = (SELECT video_id FROM params)
)
SELECT id as generation_id
FROM insert_generation
$$;

COMMIT;

