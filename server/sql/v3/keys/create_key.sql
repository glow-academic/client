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
        up.role,
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
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO department_keys (key_id, department_id, active, created_at, updated_at)
    SELECT 
        nk.key_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_key nk
    CROSS JOIN UNNEST($5::text[]) as dept_id
    WHERE COALESCE(array_length($5::text[], 1), 0) > 0
    ON CONFLICT (key_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
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
