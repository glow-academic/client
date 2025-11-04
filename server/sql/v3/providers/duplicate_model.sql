WITH source_model AS (
    SELECT 
        name,
        description,
        active,
        custom_model,
        image_model,
        input_ppm,
        output_ppm,
        provider_id
    FROM models
    WHERE id = $1
)
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
SELECT 
    sm.provider_id,
    sm.name,
    sm.description || ' Copy',
    sm.active,
    sm.custom_model,
    sm.image_model,
    sm.input_ppm,
    sm.output_ppm
FROM source_model sm
RETURNING id

