-- Get model detail with provider enum
-- Parameters: $1 = model_id (uuid)
-- Returns: model fields + provider enum value

SELECT 
    name,
    description,
    active,
    image_model,
    input_ppm,
    output_ppm,
    provider::text as provider
FROM models
WHERE id = $1

