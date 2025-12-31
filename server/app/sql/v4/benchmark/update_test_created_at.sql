-- Update test created_at timestamp
-- Parameters: $1=created_at (timestamp), $2=test_id (uuid)
-- Returns: test_id (text)
UPDATE tests SET created_at = $1, updated_at = NOW()
WHERE id = $2::uuid
RETURNING id::text as test_id

