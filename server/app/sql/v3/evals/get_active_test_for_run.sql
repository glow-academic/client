SELECT t.id::text as test_id, t.completed
FROM tests t
JOIN attempt_tests at ON at.test_id = t.id
WHERE at.attempt_id = $1::uuid
  AND t.trace_id = $2
  AND t.completed = false
LIMIT 1
