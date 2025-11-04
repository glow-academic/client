UPDATE models SET
    name = $2,
    description = $3,
    active = $4,
    custom_model = $5,
    image_model = $6,
    input_ppm = $7,
    output_ppm = $8,
    updated_at = NOW()
WHERE id = $1

