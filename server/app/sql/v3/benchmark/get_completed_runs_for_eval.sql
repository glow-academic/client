SELECT run_id::text as run_id
FROM eval_runs
WHERE eval_id = $1::uuid
  AND completed = true
