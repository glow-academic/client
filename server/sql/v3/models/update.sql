UPDATE models SET
    provider_id = $2,
    name = $3,
    description = $4,
    active = $5,
    custom_model = $6,
    image_model = $7,
    input_ppm = $8,
    output_ppm = $9,
    updated_at = NOW()
WHERE id = $1

