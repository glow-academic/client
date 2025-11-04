WITH source_provider AS (
    SELECT 
        p.name,
        p.description,
        p.api_key,
        pe.base_url
    FROM providers p
    LEFT JOIN provider_endpoints pe ON pe.provider_id = p.id AND pe.active = true
    WHERE p.id = $1
),
new_provider AS (
    INSERT INTO providers (
        name,
        description,
        api_key
    )
    SELECT 
        sp.name,
        sp.description || ' Copy',
        sp.api_key
    FROM source_provider sp
    RETURNING id as provider_id
),
new_endpoint AS (
    INSERT INTO provider_endpoints (provider_id, base_url)
    SELECT np.provider_id, sp.base_url
    FROM new_provider np
    CROSS JOIN source_provider sp
    WHERE sp.base_url IS NOT NULL
),
source_models AS (
    SELECT 
        name,
        description,
        active,
        custom_model,
        image_model,
        input_ppm,
        output_ppm
    FROM models
    WHERE provider_id = $1
    ORDER BY created_at
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
    (SELECT provider_id FROM new_provider),
    name,
    description || ' Copy',
    active,
    custom_model,
    image_model,
    input_ppm,
    output_ppm
FROM source_models
RETURNING (SELECT provider_id FROM new_provider) as provider_id

