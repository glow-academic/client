-- Delete policy (soft delete by setting active = false)
-- Parameters: $1 = policy_id (uuid)

UPDATE policies
SET active = false, updated_at = NOW()
WHERE id = $1::uuid
RETURNING id::text as policy_id

