-- Create eval grade record
-- Parameters: $1=run_id, $2=eval_id (unused, kept for API compatibility), $3=description, $4=passed, $5=score, $6=time_taken, $7=rubric_id
-- Returns: grade_id
-- Note: eval_id removed from grades table - derive from test_runs → tests → attempt_tests → eval_attempts → evals

INSERT INTO grades 
(run_id, rubric_id, description, passed, score, time_taken, created_at)
SELECT 
    $1::uuid,
    $7::uuid,
    $3::text,
    $4::boolean,
    $5::numeric,
    $6::numeric,
    NOW()
WHERE ($2::uuid IS NOT NULL OR $2::uuid IS NULL)  -- Use $2 to help PostgreSQL infer type
RETURNING id::text as grade_id

