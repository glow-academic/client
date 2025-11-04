UPDATE providers SET
    name = $2,
    description = $3,
    updated_at = NOW()
WHERE id = $1

