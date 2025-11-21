-- Get model detail with provider mapping
-- Parameters: $1 = model_id (uuid)
-- Returns: model fields + provider_mapping (jsonb) + valid_provider_ids (array)

WITH model_data AS (
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
),
valid_providers AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                p.id::text,
                jsonb_build_object(
                    'name', p.name,
                    'description', COALESCE(p.description, '')
                )
            ),
            '{}'::jsonb
        ) as provider_mapping,
        array_agg(p.id::text ORDER BY p.name) as provider_ids
    FROM providers p
)
SELECT 
    m.*,
    vp.provider_mapping,
    vp.provider_ids as valid_provider_ids
FROM model_data m
CROSS JOIN valid_providers vp

