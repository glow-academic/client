-- Duplicate model with profile_id for auditing
-- Parameters: $1 = model_id (uuid), $2 = profile_id (uuid)
WITH source_model AS (
    SELECT 
        name,
        description,
        active,
        provider
    FROM models
    WHERE id = $1
)
INSERT INTO models (
    provider,
    name,
    description,
    active
)
SELECT 
    sm.provider,
    sm.name,
    sm.description || ' Copy',
    sm.active
FROM source_model sm
RETURNING id

