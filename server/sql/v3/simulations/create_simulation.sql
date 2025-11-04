INSERT INTO simulations (
    title,
    description,
    active,
    practice_simulation,
    rubric_id
)
VALUES ($1, $2, $3, $4, $5)
RETURNING id

