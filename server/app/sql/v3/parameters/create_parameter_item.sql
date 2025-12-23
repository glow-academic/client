INSERT INTO parameter_items (
    parameter_id,
    name,
    description,
    value
)
VALUES (
    $1,
    $2,
    $3,
    $4
)
RETURNING id

