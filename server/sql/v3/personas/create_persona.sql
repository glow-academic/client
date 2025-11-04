INSERT INTO personas (
    name,
    description,
    active,
    color,
    icon,
    model_id,
    reasoning,
    temperature
)
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    COALESCE($7::reasoning_effort, 'none'::reasoning_effort),
    $8
)
RETURNING id

