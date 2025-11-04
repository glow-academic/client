UPDATE simulations SET
    title = $1,
    description = $2,
    active = $3,
    practice_simulation = $4,
    rubric_id = $5,
    updated_at = NOW()
WHERE id = $6

