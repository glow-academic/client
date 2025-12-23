-- Duplicate model with profile_id for auditing
-- Parameters: $1 = model_id (uuid), $2 = profile_id (uuid)
WITH actor_profile AS (
    SELECT 
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
source_model AS (
    SELECT 
        name,
        description,
        active,
        provider_id
    FROM models
    WHERE id = $1
)
INSERT INTO models (
    provider_id,
    name,
    description,
    active
)
SELECT 
    sm.provider_id,
    sm.name,
    sm.description || ' Copy',
    sm.active
FROM source_model sm
RETURNING id, (SELECT name FROM source_model) as original_name, (SELECT actor_name FROM actor_profile) as actor_name

