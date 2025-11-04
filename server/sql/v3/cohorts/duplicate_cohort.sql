INSERT INTO cohorts (
    title,
    description,
    active
)
VALUES (
    $1 || ' Copy',
    $2,
    false
)
RETURNING id

