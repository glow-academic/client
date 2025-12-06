-- Create generation and link to video and optionally to run
-- Parameters: $1=video_id (uuid), $2=file_path (text), $3=mime_type (text), $4=upload_id (uuid), $5=active (boolean), $6=run_id (uuid, nullable)
-- Returns: generation_id (uuid)

WITH deactivate_previous AS (
    -- Deactivate all existing generations for this video if new one is active
    UPDATE video_generations
    SET active = false, updated_at = NOW()
    WHERE video_id = $1::uuid
      AND active = true
      AND $5 = true
),
existing_generation AS (
    -- Check if generation already exists
    SELECT id as generation_id
    FROM generations
    WHERE upload_id = $4::uuid
    LIMIT 1
),
create_generation AS (
    -- Create generation if it doesn't exist
    INSERT INTO generations (file_path, mime_type, upload_id, active, created_at, updated_at)
    SELECT 
        $2::text,
        $3::text,
        $4::uuid,
        $5,
        NOW(),
        NOW()
    WHERE NOT EXISTS (SELECT 1 FROM existing_generation)
    RETURNING id as generation_id
),
generation_id AS (
    SELECT generation_id FROM existing_generation
    UNION ALL
    SELECT generation_id FROM create_generation
),
link_to_video AS (
    -- Link generation to video
    INSERT INTO video_generations (video_id, generation_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        gi.generation_id,
        $5,
        NOW(),
        NOW()
    FROM generation_id gi
    ON CONFLICT (video_id, generation_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
    RETURNING generation_id
),
link_to_run AS (
    -- Link generation to run if run_id provided
    INSERT INTO generation_runs (generation_id, run_id, created_at, updated_at)
    SELECT 
        ltv.generation_id,
        $6::uuid,
        NOW(),
        NOW()
    FROM link_to_video ltv
    WHERE $6::uuid IS NOT NULL
    ON CONFLICT (generation_id, run_id) DO NOTHING
    RETURNING generation_id
)
SELECT generation_id FROM link_to_video LIMIT 1;

