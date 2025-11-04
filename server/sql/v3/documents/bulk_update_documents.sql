UPDATE documents SET
    type = $2,
    department_id = $3,
    updated_at = NOW()
WHERE id = ANY($1)

