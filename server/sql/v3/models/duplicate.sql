-- Duplicate model with profile_id for auditing
-- Parameters: $1 = model_id (uuid), $2 = profile_id (uuid or "guest-profile-id")
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
source_model AS (
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

