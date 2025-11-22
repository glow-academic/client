INSERT INTO models (
    provider,
    name,
    description,
    active,
    image_model,
    input_ppm,
    output_ppm
)
VALUES (
    $1::provider,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7
)
RETURNING id

