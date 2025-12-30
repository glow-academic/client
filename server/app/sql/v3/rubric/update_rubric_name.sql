-- Update rubric name
-- Parameters: $1=rubric_id (uuid), $2=name (text)
-- Returns: rubric_id, name
UPDATE rubrics
SET name = $2::text,
    updated_at = NOW()
WHERE id = $1::uuid
RETURNING id as rubric_id, name

