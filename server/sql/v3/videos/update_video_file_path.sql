-- Update video file path by creating a new generation and deactivating old ones
-- Parameters: $1=video_id, $2=file_path, $3=mime_type
WITH deactivate_old AS (
    -- Deactivate all existing generations for this video
    UPDATE video_generations
    SET active = FALSE, updated_at = NOW()
    WHERE video_id = $1::uuid AND active = TRUE
),
create_generation AS (
    -- Create new generation (standalone table)
    INSERT INTO generations (file_path, mime_type, active, created_at, updated_at)
    VALUES ($2, $3, TRUE, NOW(), NOW())
    RETURNING id::uuid as generation_id
),
link_generation AS (
    -- Link generation to video via junction table
    INSERT INTO video_generations (video_id, generation_id, active, created_at, updated_at)
    SELECT $1::uuid, cg.generation_id, TRUE, NOW(), NOW()
    FROM create_generation cg
    RETURNING video_id::uuid as video_id
)
SELECT video_id FROM link_generation

