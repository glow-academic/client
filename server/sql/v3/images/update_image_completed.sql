-- Update image completed status
-- Parameters: $1=image_id, $2=completed
UPDATE images
SET completed = $2,
    updated_at = NOW()
WHERE id = $1::uuid;

