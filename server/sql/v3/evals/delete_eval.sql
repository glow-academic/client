-- Delete eval (cascades to junction table and grades via FK)
-- Parameters: $1=eval_id
-- Returns: success boolean

DELETE FROM evals
WHERE id = $1::uuid
RETURNING id::text as eval_id

