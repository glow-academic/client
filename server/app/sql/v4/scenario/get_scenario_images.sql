-- Get images for a scenario
-- Parameters: $1=scenario_id (uuid)
-- Returns: image_id, active
SELECT 
    si.image_id,
    si.active
FROM scenario_images si
WHERE si.scenario_id = $1::uuid
  AND si.active = true;

