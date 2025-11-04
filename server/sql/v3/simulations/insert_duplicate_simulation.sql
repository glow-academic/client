INSERT INTO simulations (
    title,
    description,
    active,
    practice_simulation,
    rubric_id
)
VALUES (
    $1 || ' Copy',
    $2,
    false,
    false,
    $3
)
RETURNING id

