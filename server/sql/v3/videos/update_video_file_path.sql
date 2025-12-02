-- Update video file path by creating a new generation and deactivating old ones
-- Parameters: $1=video_id, $2=file_path, $3=mime_type
WITH deactivate_old AS (
    -- Deactivate all existing generations for this video
    UPDATE video_generations
    SET active = FALSE, updated_at = NOW()
    WHERE video_id = $1::uuid AND active = TRUE
),
new_generation AS (
    -- Create new active generation
    INSERT INTO video_generations (video_id, file_path, mime_type, active, created_at, updated_at)
    VALUES ($1::uuid, $2, $3, TRUE, NOW(), NOW())
    RETURNING video_id::uuid as video_id
)
SELECT video_id FROM new_generation

