UPDATE cohorts SET
    title = $2,
    description = $3,
    active = $4,
    updated_at = NOW()
WHERE id = $1

