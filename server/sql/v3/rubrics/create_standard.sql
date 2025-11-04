INSERT INTO standards (
    standard_group_id,
    name,
    description,
    points
)
VALUES (
    $1,
    $2,
    $3,
    $4
)
RETURNING id

