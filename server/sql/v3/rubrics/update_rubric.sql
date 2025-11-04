UPDATE rubrics SET
    name = $2,
    description = $3,
    active = $4,
    points = $5,
    pass_points = $6,
    updated_at = NOW()
WHERE id = $1

