-- Update policy
-- Parameters: $1 = policy_id (uuid), $2 = name (text), $3 = description (text),
--            $4 = file_path (text), $5 = mime_type (text), $6 = active (boolean)

UPDATE policies
SET 
    name = $2,
    description = $3,
    file_path = $4,
    mime_type = $5,
    active = $6,
    updated_at = NOW()
WHERE id = $1::uuid
RETURNING id::text as policy_id, name

