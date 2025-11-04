DELETE FROM app_feedback
WHERE id = ANY($1::int[])
RETURNING id

