UPDATE models SET
    provider = $2::provider,
    name = $3,
    description = $4,
    active = $5,
    image_model = $6,
    input_ppm = $7,
    output_ppm = $8,
    updated_at = NOW()
WHERE id = $1

