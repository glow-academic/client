-- Create a new key with department links
-- Parameters: $1=name, $2=key (encrypted), $3=description, $4=active, $5=department_ids (text array, nullable), $6=profile_id (uuid, required)
-- Returns: key_id, key_masked, actor_name
-- profile_id is always a UUID (required in request body)
WITH user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $6::uuid
),
validate_create_permissions AS (
    -- Validate department permissions for create operation
    SELECT validate_department_create_permissions(
        up.role::text,
        $5::text[]
    ) as validation_passed
    FROM user_profile up
),
actor_profile AS (
    SELECT 
        $6::uuid as resolved_profile_id,
        up.actor_name
    FROM user_profile up
),
new_key AS (
    INSERT INTO keys (
        name,
        key,
        description,
        active
    )
    VALUES ($1, $2, $3, $4)
    RETURNING id::text as key_id, key
),
link_departments AS (
    -- NOTE: department_keys table was removed in migration 74
    -- Keys are now linked to departments through settings (setting_provider_keys, setting_auth_keys)
    -- This CTE is kept for compatibility but does nothing
    -- TODO: Reimplement department linking through settings if needed
    SELECT 1 WHERE false
)
SELECT 
    nk.key_id,
    CASE 
        WHEN LENGTH(nk.key) > 4 THEN LEFT(nk.key, 4) || '****'
        ELSE '****'
    END as key_masked,
    ap.actor_name
FROM new_key nk
CROSS JOIN actor_profile ap
