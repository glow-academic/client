-- Update image completion status
-- Parameters: $1=image_id (uuid), $2=completed (boolean)
UPDATE images
SET completed = $2::boolean,
    updated_at = NOW()
WHERE id = $1::uuid;
