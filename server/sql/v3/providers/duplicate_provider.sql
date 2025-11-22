WITH source_provider AS (
    SELECT 
        p.name,
        p.description,
        (SELECT k.key FROM models m
         JOIN model_keys mk ON mk.model_id = m.id AND mk.active = true
         JOIN keys k ON k.id = mk.key_id AND k.active = true AND k.type = 'api'
         WHERE m.provider_id = p.id
         LIMIT 1) as api_key,
        pe.base_url
    FROM providers p
    LEFT JOIN provider_endpoints pe ON pe.provider_id = p.id AND pe.active = true
    WHERE p.id = $1
),
source_provider_key AS (
    -- Get the key_id for the source provider's first model
    SELECT mk.key_id
    FROM models m
    JOIN model_keys mk ON mk.model_id = m.id AND mk.active = true
    WHERE m.provider_id = $1
    LIMIT 1
),
new_provider AS (
    INSERT INTO providers (
        name,
        description
    )
    SELECT 
        sp.name || ' Copy',
        sp.description
    FROM source_provider sp
    RETURNING id as provider_id
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
),
duplicate_models AS (
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
        np.provider_id,
        sm.name,
        sm.description || ' Copy',
        sm.active,
        sm.custom_model,
        sm.image_model,
        sm.input_ppm,
        sm.output_ppm
    FROM new_provider np
    CROSS JOIN source_models sm
    RETURNING id as model_id
),
link_keys_to_new_models AS (
    -- Link the key to new models if a key exists
    INSERT INTO model_keys (model_id, key_id, active)
    SELECT dm.model_id, spk.key_id, true
    FROM duplicate_models dm
    CROSS JOIN source_provider_key spk
    WHERE spk.key_id IS NOT NULL
),
new_endpoint AS (
    INSERT INTO provider_endpoints (provider_id, base_url)
    SELECT np.provider_id, sp.base_url
    FROM new_provider np
    CROSS JOIN source_provider sp
    WHERE sp.base_url IS NOT NULL
)
SELECT provider_id FROM new_provider

