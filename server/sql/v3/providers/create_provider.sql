INSERT INTO providers (
    name,
    description,
    api_key
)
VALUES (
    $1,
    $2,
    $3
)
RETURNING id

