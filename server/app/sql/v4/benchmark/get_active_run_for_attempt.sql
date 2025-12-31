SELECT tr.run_id::text as run_id, t.id::text as test_id
FROM attempt_tests at
JOIN tests t ON t.id = at.test_id
JOIN test_runs tr ON tr.test_id = t.id
WHERE at.attempt_id = $1::uuid
  AND t.completed = false
ORDER BY t.created_at DESC
LIMIT 1
