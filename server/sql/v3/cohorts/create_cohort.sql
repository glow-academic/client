INSERT INTO cohorts (
    title,
    description,
    active
)
VALUES (
    $1,
    $2,
    $3
)
RETURNING id

