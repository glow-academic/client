-- Create a test eval
-- Parameters: $1 = department_id (UUID), $2 = profile_id (UUID), $3 = title (text, optional)
-- Returns: eval_id (UUID)
INSERT INTO evals(
    title,
    department_id,
    profile_id,
    active
)
VALUES (
    COALESCE($3, 'Test Eval'),
    $1::uuid,
    $2::uuid,
    true
)
RETURNING id;

