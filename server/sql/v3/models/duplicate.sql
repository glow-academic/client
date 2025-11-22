WITH source_model AS (
    SELECT 
        name,
        description,
        active,
        image_model,
        input_ppm,
        output_ppm,
        provider
    FROM models
    WHERE id = $1
)
INSERT INTO models (
    provider,
    name,
    description,
    active,
    image_model,
    input_ppm,
    output_ppm
)
SELECT 
    sm.provider,
    sm.name,
    sm.description || ' Copy',
    sm.active,
    sm.image_model,
    sm.input_ppm,
    sm.output_ppm
FROM source_model sm
RETURNING id

