-- Link a video to a scenario
-- Parameters: $1 = scenario_id (uuid), $2 = video_id (uuid), $3 = active (boolean)
-- Creates or updates scenario_videos junction table entry
-- Note: Only one video can be active per scenario (enforced by unique partial index)
-- Returns: video_id (text)
WITH link_video AS (
    UPDATE scenario_videos
    SET active = false, updated_at = NOW()
    WHERE scenario_id = $1::uuid AND active = true
),
insert_video AS (
    INSERT INTO scenario_videos (scenario_id, video_id, active, created_at, updated_at)
    VALUES ($1::uuid, $2::uuid, $3::boolean, NOW(), NOW())
    ON CONFLICT (scenario_id, video_id) DO UPDATE SET
        active = EXCLUDED.active,
        updated_at = NOW()
    RETURNING video_id::text
)
SELECT video_id FROM insert_video;

