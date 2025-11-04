DELETE FROM app_logs
WHERE id = ANY($1::int[])
RETURNING id

