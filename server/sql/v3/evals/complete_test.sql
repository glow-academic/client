-- Mark test as completed
-- Parameters: $1=test_id (uuid)
UPDATE tests SET completed = true, updated_at = NOW()
WHERE id = $1::uuid

