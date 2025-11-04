INSERT INTO rubrics (
    name,
    description,
    active,
    points,
    pass_points
)
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5
)
RETURNING id

