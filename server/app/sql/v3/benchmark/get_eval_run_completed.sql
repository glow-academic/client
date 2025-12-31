SELECT completed
FROM eval_runs
WHERE eval_id = $1::uuid
  AND run_id = $2::uuid
