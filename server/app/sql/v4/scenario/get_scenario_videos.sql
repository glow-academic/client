-- Get videos for a scenario
-- Parameters: $1=scenario_id (uuid)
-- Returns: video_id, active
SELECT 
    sv.video_id,
    sv.active
FROM scenario_videos sv
WHERE sv.scenario_id = $1::uuid
  AND sv.active = true;

