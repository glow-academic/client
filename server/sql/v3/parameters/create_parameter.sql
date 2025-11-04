INSERT INTO parameters (
    name,
    description,
    numerical,
    active,
    document_parameter,
    practice_parameter
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

