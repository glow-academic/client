-- Update scenario name
-- Parameters: $1=scenario_id (uuid), $2=name (text)
-- Returns: scenario_id, name
UPDATE scenarios
SET name = $2::text,
    updated_at = NOW()
WHERE id = $1::uuid
RETURNING id as scenario_id, name

