INSERT INTO rubrics (
    name,
    description,
    active,
    points,
    pass_points
)
VALUES (
    $1 || ' Copy',
    $2,
    false,
    $3,
    $4
)
RETURNING id

