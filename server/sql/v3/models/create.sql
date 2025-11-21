INSERT INTO models (
    provider_id,
    name,
    description,
    active,
    custom_model,
    image_model,
    input_ppm,
    output_ppm
)
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8
)
RETURNING id

