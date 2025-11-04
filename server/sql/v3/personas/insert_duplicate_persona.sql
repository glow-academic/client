INSERT INTO personas (
    name,
    description,
    temperature,
    reasoning,
    model_id,
    color,
    icon,
    active
)
VALUES (
    $1 || ' Copy',
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    false
)
RETURNING id

