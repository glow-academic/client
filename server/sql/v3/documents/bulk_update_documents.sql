UPDATE documents SET
    type = $2,
    updated_at = NOW()
WHERE id = ANY($1)

