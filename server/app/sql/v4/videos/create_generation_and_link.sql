-- Create generation record, link to video and run
-- Parameters: $1=video_id (uuid), $2=file_path (text), $3=mime_type (text),
--             $4=upload_id (uuid), $5=active (boolean), $6=run_id (uuid)
-- Returns: generation_id (uuid)
WITH params AS (
    SELECT
        $1::uuid as video_id,
        $2::text as file_path,
        $3::text as mime_type,
        $4::uuid as upload_id,
        $5::boolean as active,
        $6::uuid as run_id
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
FROM insert_generation;
