INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
SELECT DISTINCT mr.message_id, $1::uuid, NOW(), NOW()
FROM message_runs mr
WHERE mr.run_id = $2::uuid
  AND EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = mr.message_id
        AND m.role IN ('system', 'developer')
  )
ON CONFLICT (message_id, run_id)
DO UPDATE SET updated_at = NOW()
