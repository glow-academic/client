-- Update scenario generated flag
-- Parameters: $1=scenario_id (uuid), $2=generated (boolean)
UPDATE scenarios
SET generated = $2::boolean, updated_at = NOW()
WHERE id = $1::uuid

