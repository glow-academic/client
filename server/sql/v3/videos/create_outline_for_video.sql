-- Create outline and link it to video and optionally to run
-- Parameters: $1 = video_id (uuid), $2 = outline_name (text), $3 = outline_text (text), $4 = run_id (uuid, nullable)
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
),
link_outline_to_run AS (
    -- Link outline to run if run_id provided
    INSERT INTO outline_runs (outline_id, run_id, created_at, updated_at)
    SELECT 
        no.outline_id,
        $4::uuid,
        NOW(),
        NOW()
    FROM new_outline no
    WHERE $4::uuid IS NOT NULL
    ON CONFLICT (outline_id, run_id) DO NOTHING
)
SELECT outline_id FROM new_outline;

