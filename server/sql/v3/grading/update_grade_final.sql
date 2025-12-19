-- Update grade record with final values
-- Parameters: $1=grade_id (uuid), $2=description (text), $3=passed (boolean), $4=score (integer)
-- Returns: grade_id (uuid as text)
UPDATE grades 
SET description = $2::text,
    passed = $3::boolean,
    score = $4::integer,
    updated_at = NOW()
WHERE id = $1::uuid
RETURNING id::text

