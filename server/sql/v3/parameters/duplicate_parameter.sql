INSERT INTO parameters (
    name,
    description,
    numerical,
    active,
    document_parameter,
    practice_parameter
)
VALUES (
    $1 || ' Copy',
    $2,
    $3,
    false,
    $4,
    $5
)
RETURNING id

