-- Link image to scenario via junction table
-- Parameters: $1=scenario_id (uuid), $2=image_id (uuid), $3=active (boolean, default true)
INSERT INTO scenario_images (scenario_id, image_id, active, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, COALESCE($3, true), NOW(), NOW())
ON CONFLICT (scenario_id, image_id) DO UPDATE SET
    active = COALESCE($3, true),
    updated_at = NOW()

