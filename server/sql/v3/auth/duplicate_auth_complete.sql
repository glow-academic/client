-- Duplicate auth with items and values in a single transaction
-- Parameters: $1=source_auth_id, $2=profile_id (uuid)
WITH actor_profile AS (
    SELECT 
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
WITH source_auth AS (
    SELECT id, name, description, active
    FROM auth
    WHERE id = $1::uuid
),
new_auth AS (
    INSERT INTO auth (
        name,
        description,
        active
    )
    SELECT 
        name || ' (Copy)',
        description,
        active
    FROM source_auth
    RETURNING id::text as auth_id
),
source_items AS (
    SELECT 
        ai.name,
        ai.description,
        ai.value
    FROM source_auth sa
    JOIN auth_items ai ON ai.auth_id = sa.id
),
new_items AS (
    INSERT INTO auth_items (
        auth_id,
        name,
        description,
        value
    )
    SELECT 
        na.auth_id::uuid,
        si.name,
        si.description,
        si.value
    FROM new_auth na
    CROSS JOIN source_items si
    RETURNING id::text as item_id
)
SELECT 
    na.auth_id,
    sa.name as original_name,
    ap.actor_name
FROM new_auth na
CROSS JOIN source_auth sa
CROSS JOIN actor_profile ap

