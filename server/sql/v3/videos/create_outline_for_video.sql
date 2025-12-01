-- Create outline and link it to video
-- Parameters: $1 = video_id (uuid), $2 = outline_name (text), $3 = outline_text (text)
-- Returns: outline_id (uuid)

WITH new_outline AS (
    INSERT INTO outlines (name, outline, created_at, updated_at)
    VALUES ($2, $3, NOW(), NOW())
    RETURNING id::uuid as outline_id
),
link_outline_to_video AS (
    INSERT INTO video_outlines (video_id, outline_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        no.outline_id,
        true,
        NOW(),
        NOW()
    FROM new_outline no
    ON CONFLICT (video_id, outline_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT outline_id FROM new_outline;

