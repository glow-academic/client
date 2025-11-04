INSERT INTO standard_groups (
    rubric_id,
    name,
    short_name,
    description,
    points,
    pass_points
)
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
)
RETURNING id

