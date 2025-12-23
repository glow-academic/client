-- Link a video to a scenario
-- Parameters: $1 = scenario_id (uuid), $2 = video_id (uuid), $3 = active (boolean)
-- Creates or updates scenario_videos junction table entry
-- Note: Only one video can be active per scenario (enforced by unique partial index)

-- First, deactivate any existing active videos for this scenario
UPDATE scenario_videos
SET active = false, updated_at = NOW()
WHERE scenario_id = $1::uuid AND active = true;

-- Then insert/update the new video link
INSERT INTO scenario_videos (scenario_id, video_id, active, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, $3::boolean, NOW(), NOW())
ON CONFLICT (scenario_id, video_id) DO UPDATE SET
    active = EXCLUDED.active,
    updated_at = NOW()
RETURNING video_id;

